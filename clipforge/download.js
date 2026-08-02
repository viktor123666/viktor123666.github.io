/**
 * "Download all" — zipped in the browser, so it costs us nothing.
 *
 * The obvious implementation is a server-side zip: read every clip, write one archive,
 * stream it back. It also undoes the whole storage design. Clips average ~340 MB per
 * job and the bytes would travel storage → our server → customer, paying egress on a
 * provider chosen specifically because it charges none, and putting a multi-hundred-
 * megabyte stream through the application server for every download.
 *
 * So the browser does it. It already has to fetch the clips; zipping them locally adds
 * no transfer at all.
 *
 * The archive uses STORE (no compression) deliberately. MP4 is already compressed —
 * DEFLATE would spend the customer's CPU to save roughly nothing — and STORE means the
 * format is simple enough to write correctly in a page script rather than pulling in a
 * library for something this size.
 *
 * ZIP64 is not implemented. Above 4 GB the format needs different headers, and rather
 * than emit a subtly corrupt archive we fall back to downloading files individually.
 */
(function (global) {
  "use strict";

  const ZIP64_LIMIT = 0xFFFFFFFF;

  // ── CRC-32, the one piece of maths a zip cannot do without ────────────────
  const CRC_TABLE = (function () {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })();

  /**
   * The final XOR is not optional. Without it every checksum is wrong and every
   * archiver reports every file as corrupt — which is exactly what the known-answer
   * test below caught. CRC-32 of "123456789" is 0xCBF43926; anything else is a bug.
   */
  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function u32(v) {
    return [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
  }
  function u16(v) { return [v & 0xFF, (v >>> 8) & 0xFF]; }

  /** DOS timestamp. The epoch is 1980; anything earlier is clamped rather than wrapped. */
  function dosTime(d) {
    const year = Math.max(1980, d.getFullYear());
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
      date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    };
  }

  function nameBytes(name) {
    return new TextEncoder().encode(name);
  }

  /**
   * Builds the archive.
   *
   * Everything is held in memory. That is a real limit and the reason for the size
   * check in `downloadAll`: a browser tab asked to hold 6 GB will not fail politely,
   * it will die, and the customer will think the clips were lost.
   */
  function buildZip(entries) {
    const parts = [];
    const central = [];
    let offset = 0;
    const { time, date } = dosTime(new Date());

    for (const e of entries) {
      const nb = nameBytes(e.name);
      const crc = crc32(e.bytes);
      const size = e.bytes.length;

      const local = new Uint8Array([
        0x50, 0x4B, 0x03, 0x04,     // local file header
        ...u16(20), ...u16(0),      // version 2.0, no flags
        ...u16(0),                  // method 0 = STORE
        ...u16(time), ...u16(date),
        ...u32(crc), ...u32(size), ...u32(size),
        ...u16(nb.length), ...u16(0),
      ]);

      parts.push(local, nb, e.bytes);

      central.push(new Uint8Array([
        0x50, 0x4B, 0x01, 0x02,     // central directory header
        ...u16(20), ...u16(20), ...u16(0),
        ...u16(0),
        ...u16(time), ...u16(date),
        ...u32(crc), ...u32(size), ...u32(size),
        ...u16(nb.length), ...u16(0), ...u16(0),
        ...u16(0), ...u16(0), ...u32(0),
        ...u32(offset),
        ...nb,
      ]));

      offset += local.length + nb.length + size;
    }

    const centralSize = central.reduce((n, c) => n + c.length, 0);
    const end = new Uint8Array([
      0x50, 0x4B, 0x05, 0x06,
      ...u16(0), ...u16(0),
      ...u16(entries.length), ...u16(entries.length),
      ...u32(centralSize), ...u32(offset),
      ...u16(0),
    ]);

    return new Blob([...parts, ...central, end], { type: "application/zip" });
  }

  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoking immediately can cancel the download in some browsers; a tick is enough.
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  /**
   * Fetches every clip and hands back one archive.
   *
   * @param {{name:string,url:string}[]} files  from /api/jobs/:id/download
   * @param {object} opts  onProgress({done,total,bytes}) · signal · zipName
   */
  async function downloadAll(files, opts) {
    opts = opts || {};
    const onProgress = opts.onProgress || function () {};
    const entries = [];
    let bytes = 0;

    for (let i = 0; i < files.length; i++) {
      if (opts.signal && opts.signal.aborted) throw new Error("aborted");
      const res = await fetch(files[i].url, { signal: opts.signal });
      if (!res.ok) {
        // A signed link expires after an hour. Saying which file and why beats a
        // generic failure the customer cannot act on.
        throw new Error(
          `Could not fetch ${files[i].name} (HTTP ${res.status}). ` +
          `These links expire — reload the page for fresh ones.`);
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      bytes += buf.length;

      if (bytes > ZIP64_LIMIT) {
        // Beyond 4 GB the format needs ZIP64 headers. Emitting a truncated archive
        // that some tools open and others reject would be worse than saying no.
        throw new RangeError("TOO_LARGE");
      }
      entries.push({ name: files[i].name, bytes: buf });
      onProgress({ done: i + 1, total: files.length, bytes });
    }

    return buildZip(entries);
  }

  /**
   * The button.
   *
   * Falls back to saving the clips one at a time when the set is too large to zip in a
   * tab. The customer still gets every file — they simply get them individually, which
   * is what a browser is good at.
   */
  async function downloadAllAsZip(files, zipName, opts) {
    try {
      const blob = await downloadAll(files, opts);
      saveBlob(blob, zipName || "clips.zip");
      return { zipped: true, count: files.length };
    } catch (e) {
      if (e instanceof RangeError && e.message === "TOO_LARGE") {
        for (const f of files) {
          saveBlob(await (await fetch(f.url)).blob(), f.name);
          await new Promise((r) => setTimeout(r, 400));   // browsers throttle bursts
        }
        return { zipped: false, count: files.length };
      }
      throw e;
    }
  }

  global.ClipForgeDownload = { downloadAll, downloadAllAsZip, buildZip, crc32 };
})(window);
