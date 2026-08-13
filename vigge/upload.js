/**
 * ClipForge resumable uploader.
 *
 * Uploads straight from the browser to object storage using presigned part URLs.
 * The file never passes through our application server — that keeps a 60 GB upload
 * off our bandwidth bill and out of reach of an app-server compromise.
 *
 * Resume survives a closed tab: the uploadId and every completed part's ETag are
 * persisted to localStorage keyed by a file fingerprint, so returning to the page
 * continues where it stopped instead of starting a multi-gigabyte upload again.
 */
(function (global) {
  "use strict";

  const STORE = "cf.upload.";
  const MAX_RETRIES = 5;

  /** Fingerprint that survives a reload. Name+size+mtime is enough to be sure it is
   *  the same file, and costs nothing — hashing 60 GB in the browser would not. */
  function fingerprint(file) {
    return `${STORE}${file.name}|${file.size}|${file.lastModified}`;
  }

  function loadState(fp) {
    try { return JSON.parse(localStorage.getItem(fp) || "null"); } catch { return null; }
  }
  function saveState(fp, state) {
    try { localStorage.setItem(fp, JSON.stringify(state)); } catch { /* quota — proceed */ }
  }
  /**
   * Reads the recording's length without uploading a byte.
   *
   * The server needs a duration to size the credit hold — without one it cannot price
   * the job and refuses the source. This is only an ESTIMATE: the render box measures
   * the real file with ffprobe and corrects the hold before spending anything on it,
   * so a container that lies here costs nobody anything.
   *
   * Resolves null rather than rejecting. A browser that cannot decode the container
   * should not block an upload the render box would have handled fine.
   */
  function readDuration(file) {
    return new Promise((resolve) => {
      let url;
      const video = document.createElement("video");
      const done = (value) => {
        if (url) URL.revokeObjectURL(url);
        video.removeAttribute("src");
        resolve(value);
      };
      // Some containers never fire loadedmetadata; never hang the upload on it.
      const timer = setTimeout(() => done(null), 15000);
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        clearTimeout(timer);
        const d = video.duration;
        done(Number.isFinite(d) && d > 0 ? Math.round(d) : null);
      };
      video.onerror = () => { clearTimeout(timer); done(null); };
      try {
        url = URL.createObjectURL(file);
        video.src = url;
      } catch { clearTimeout(timer); done(null); }
    });
  }

  function clearState(fp) {
    try { localStorage.removeItem(fp); } catch { /* ignore */ }
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /**
   * PUT one part. Retries with exponential backoff and full jitter — a stalled part
   * on a two-hour upload is normal, and must not fail the whole job.
   */
  async function putPart(url, blob, onProgress, signal) {
    let attempt = 0;
    for (;;) {
      try {
        const etag = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", url, true);
          xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded);
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const tag = xhr.getResponseHeader("ETag");
              tag ? resolve(tag) : reject(new Error("storage returned no ETag"));
            } else {
              reject(new Error(`HTTP ${xhr.status}`));
            }
          };
          xhr.onerror = () => reject(new Error("network error"));
          xhr.onabort = () => reject(new Error("aborted"));
          if (signal) signal.addEventListener("abort", () => xhr.abort(), { once: true });
          xhr.send(blob);
        });
        return etag;
      } catch (err) {
        if (signal && signal.aborted) throw err;
        if (++attempt > MAX_RETRIES) {
          throw new Error(`part failed after ${MAX_RETRIES} retries: ${err.message}`);
        }
        // full jitter: avoids every stalled part retrying in lockstep
        await sleep(Math.random() * Math.min(30000, 2 ** attempt * 500));
      }
    }
  }

  /**
   * @param {File} file
   * @param {object} opts
   *   api        base path for the upload endpoints
   *   onProgress ({ sent, total, percent, partsDone, partsTotal })
   *   onStage    (text)
   *   signal     AbortSignal
   * @returns {Promise<{ sourceId: string, resumed: boolean }>}
   */
  async function upload(file, opts = {}) {
    const api = opts.api || "/api/upload";
    const onProgress = opts.onProgress || (() => {});
    const onStage = opts.onStage || (() => {});
    const signal = opts.signal;
    const fp = fingerprint(file);

    const post = async (path, body) => {
      const res = await fetch(api + path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        credentials: "same-origin",
        signal,
      });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try { detail = (await res.json()).error || detail; } catch { /* keep status */ }
        throw new Error(detail);
      }
      return res.json();
    };

    // ── resume, or begin ────────────────────────────────────────────────────
    let state = loadState(fp);
    const resumed = !!(state && state.uploadId);
    if (resumed) {
      onStage("Resuming where we stopped");
      // An upload started before the duration was persisted would reach /complete
      // without one and be rejected. Cheap to re-read; expensive to re-upload.
      if (state.durationS == null) {
        state.durationS = await readDuration(file);
        saveState(fp, state);
      }
    } else {
      onStage("Reading the recording");
      // Read the length first: it is needed at /complete, and a file the browser
      // cannot open at all is worth discovering now rather than after 40 GB.
      const durationS = await readDuration(file);

      onStage("Preparing upload");
      const begun = await post("/begin", {
        filename: file.name, bytes: file.size, type: file.type,
      });
      state = {
        uploadId: begun.uploadId, sourceId: begun.sourceId,
        key: begun.key, parts: begun.parts, done: {}, durationS,
      };
      saveState(fp, state);
    }

    // ── send the parts that are still missing ───────────────────────────────
    const total = file.size;
    const partsTotal = state.parts.length;
    let sent = Object.keys(state.done)
      .reduce((a, n) => a + (state.parts[n - 1].to - state.parts[n - 1].from), 0);

    onStage(`Uploading ${(total / 1024 ** 3).toFixed(2)} GB`);
    for (const part of state.parts) {
      if (state.done[part.partNumber]) continue;
      if (signal && signal.aborted) throw new Error("aborted");

      const base = sent;
      const etag = await putPart(
        part.url, file.slice(part.from, part.to),
        (loaded) => {
          const s = base + loaded;
          onProgress({
            sent: s, total, percent: Math.min(99, Math.round((s / total) * 100)),
            partsDone: Object.keys(state.done).length, partsTotal,
          });
        },
        signal,
      );

      state.done[part.partNumber] = etag;
      sent += part.to - part.from;
      saveState(fp, state);            // persist after every part — this is the resume point
      onProgress({
        sent, total, percent: Math.min(99, Math.round((sent / total) * 100)),
        partsDone: Object.keys(state.done).length, partsTotal,
      });
    }

    // ── finish ──────────────────────────────────────────────────────────────
    onStage("Finalising");
    await post("/complete", {
      sourceId: state.sourceId,
      uploadId: state.uploadId,
      durationS: state.durationS,
      parts: Object.entries(state.done)
        .map(([partNumber, etag]) => ({ partNumber: Number(partNumber), etag })),
    });

    clearState(fp);
    onProgress({ sent: total, total, percent: 100, partsDone: partsTotal, partsTotal });
    onStage("Upload complete");
    return { sourceId: state.sourceId, resumed };
  }

  /** Abandon an upload and release the storage its parts are holding. */
  async function abort(file, opts = {}) {
    const fp = fingerprint(file);
    const state = loadState(fp);
    if (!state) return;
    try {
      await fetch((opts.api || "/api/upload") + "/abort", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId: state.sourceId, uploadId: state.uploadId }),
        credentials: "same-origin",
      });
    } finally {
      clearState(fp);
    }
  }

  /** Is there an interrupted upload for this file? Lets the UI offer "resume". */
  function pending(file) {
    const s = loadState(fingerprint(file));
    return s ? { partsDone: Object.keys(s.done || {}).length, partsTotal: s.parts.length } : null;
  }

  global.CFUpload = { upload, abort, pending };
})(window);
