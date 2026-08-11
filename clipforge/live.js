/**
 * The wire between the pages and the API.
 *
 * Everything either side of this file already existed. `upload.js` implements a
 * resumable multipart uploader; `server.ts` implements every endpoint it calls. They
 * were written against each other and **never connected** — no page loaded upload.js,
 * and `app.html` shipped with a sample-data animation instead. The uploader had never
 * run once, in any browser, against any server.
 *
 * So this file adds no behaviour of its own. It finds the controls that are already on
 * the page, calls the endpoints that already exist, and shows what comes back.
 *
 * Degrades on purpose: if `/api/healthz` does not answer, every page keeps its
 * demonstration exactly as it was. A visitor reading the brochure on a static host must
 * not see errors from an API that was never meant to be there.
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const json = async (url, opts) => {
    const r = await fetch(url, { credentials: "same-origin", ...opts });
    let body = null;
    try { body = await r.json(); } catch { /* empty body is legal */ }
    return { ok: r.ok, status: r.status, body };
  };

  /** Is there an API behind this page at all? */
  async function live() {
    try {
      const r = await fetch("/api/healthz", { credentials: "same-origin" });
      return r.ok;
    } catch { return false; }
  }

  /**
   * Removes every listener a page already attached to an element.
   *
   * The pages ship inline demo scripts — login.html switches to "Check your inbox" on
   * submit without asking anyone, because that was the whole point before there was an
   * API. Adding a second listener does not replace the first: both fire, the demo wins
   * the visuals, and a failed request still shows a confirmation.
   *
   * Somebody sat watching an inbox because of this. Cloning a node copies the markup
   * and not the listeners, so the demo is gone and the page has one owner.
   */
  function takeOver(el) {
    const fresh = el.cloneNode(true);
    el.parentNode.replaceChild(fresh, el);
    return fresh;
  }

  // ── sign in ───────────────────────────────────────────────────────────────
  function wireLogin() {
    let form = $("form");
    if (!form || !$("email")) return;
    form = takeOver(form);

    // Re-query AFTER the clone: the originals belong to a node no longer in the page.
    const email = $("email"), err = $("err"), sent = $("sent"), addr = $("addr");

    // The page's own mechanism, not `hidden`. `.sent{display:none}` / `.sent.on` and an
    // inline `display:none` on the error — setting `.hidden` moves nothing on screen.
    const showError = (msg) => { err.textContent = msg; err.style.display = "block"; };
    const hideError = () => { err.style.display = "none"; };
    const showSent = (to) => {
      addr.textContent = to;
      form.classList.add("off");
      sent.classList.add("on");
    };

    const back = $("back");
    if (back) back.onclick = () => {
      sent.classList.remove("on"); form.classList.remove("off"); email.focus();
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const value = email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        showError("Enter a valid email address.");
        email.focus();
        return;
      }
      hideError();

      let r;
      try {
        r = await json("/api/auth/request", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: value }),
        });
      } catch {
        r = { ok: false, status: 0, body: null };
      }

      // Two different things, and conflating them cost somebody a real wait.
      //
      // A 2xx means the server accepted the request, and THEN the screen must look
      // identical whether or not that address has an account — the endpoint is
      // deliberately silent about which addresses exist, and the page must not undo
      // that by rendering two outcomes.
      //
      // Anything else means the request did not land: the API is down, the key is
      // refused, the port is empty. None of that is a secret, and showing "check your
      // inbox" for it is a lie that leaves someone refreshing an inbox for a message
      // nobody ever tried to send. That is exactly what happened on 2026-08-03.
      if (r.ok) { showSent(value); return; }

      showError(r.status === 0
        ? "Could not reach the server. Is it running?"
        : (r.body && r.body.error)
          ? r.body.error
          : `The server refused the request (HTTP ${r.status}). Nothing was sent.`);
      console.warn("sign-in request failed", r.status, r.body);
    });
  }

  // ── the workspace ─────────────────────────────────────────────────────────
  function wireApp() {
    if (!$("file") || !$("go")) return;

    // Same takeover as the login page, for the same reason. app.html carries a 4.6 kB
    // demo that binds `$("go").onclick` and plays a scripted pipeline on a timer. It
    // assigns rather than adds, but a real upload alongside a fake animation is worse
    // than either — two progress stories about one file, and the invented one finishes
    // first.
    ["go", "pick", "fetch", "file", "drop", "again"].forEach((id) => {
      const el = $(id);
      if (el) takeOver(el);
    });

    const file = $("file"), pick = $("pick"), drop = $("drop"), go = $("go"),
          cred = $("cred"), gauge = $("gauge"), fill = $("fill"), eta = $("eta"),
          runName = $("runName"), clipGrid = $("clipGrid"), whyList = $("whyList");

    // The page's own `.hide` toggle. Setting `.hidden` leaves `display:none!important`
    // in place and the panel never appears — the exact mistake that made the sign-in
    // error invisible.
    const panel = (id, on) => { const e = $(id); if (e) e.classList.toggle("hide", !on); };

    // "Clip a video" must work BEFORE any delivery too — on the upload view it
    // simply brings you back to the form. render() upgrades it to a full reset.
    const navClip = $("again");
    if (navClip) navClip.onclick = () => {
      panel("out", false); panel("src", true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    let chosen = null;
    let jobId = null;

    const show = (msg) => { if (eta) eta.textContent = msg; };

    async function refreshCredits() {
      const r = await json("/api/auth/me");
      if (r.ok && r.body && cred) {
        cred.textContent = (Number(r.body.minutes) / 60).toFixed(1) + " h";
      }
      return r.ok;
    }

    // A drop that misses the zone by a pixel must not navigate the whole page into
    // the video file. Browsers do exactly that unless the WINDOW forbids it.
    window.addEventListener("dragover", (e) => e.preventDefault());
    window.addEventListener("drop", (e) => e.preventDefault());

    if (pick) pick.addEventListener("click", () => file.click());
    if (drop) {
      ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => {
        e.preventDefault(); drop.classList.add("hot");
      }));
      ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => {
        e.preventDefault(); drop.classList.remove("hot");
      }));
      drop.addEventListener("drop", (e) => {
        if (e.dataTransfer?.files?.[0]) { chosen = e.dataTransfer.files[0]; paint(); }
      });
    }
    file.addEventListener("change", () => {
      if (file.files?.[0]) { chosen = file.files[0]; paint(); }
    });

    function paint() {
      if (!chosen) return;
      const mb = (chosen.size / 1048576).toFixed(0);
      if (runName) runName.textContent = chosen.name;
      // Feedback where the user is LOOKING. The first version wrote its confirmation
      // into the hidden progress panel — so choosing a file appeared to do nothing,
      // reported as broken within one minute of the first real user touching it.
      const h = drop ? drop.querySelector("h2") : null;
      const pp = drop ? drop.querySelector("p") : null;
      if (h) h.textContent = "SELECTED: " + chosen.name;
      if (pp) pp.textContent = mb + " MB — press »Start clipping« below";
      if (go) {
        go.style.outline = "2px solid var(--gold)";
        go.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }

    go.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!chosen) { alertLine("Choose a file first."); return; }
      if (!window.CFUpload) { alertLine("Uploader not loaded."); return; }

      go.disabled = true;
      try {
        // The page's own panels: upload form away, progress panel in.
        panel("src", false);
        panel("run", true);
        show("Uploading…");

        const { sourceId } = await window.CFUpload.upload(chosen, {
          onProgress: (done, total) => {
            const pct = total ? Math.round((done / total) * 100) : 0;
            if (fill) fill.style.width = pct + "%";
            show(`Uploading… ${pct}%`);
          },
        });

        show("Queueing…");
        const fontSel = $("font");
        const sub = await json("/api/jobs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sourceId,
            subtitleFont: fontSel && fontSel.value !== "standard" ? fontSel.value : null,
          }),
        });
        if (!sub.ok) {
          panel("run", false);
          panel("src", true);
          alertLine(sub.body?.error || "The queue refused this job.");
          go.disabled = false;
          return;
        }
        jobId = sub.body.jobId;
        await refreshCredits();
        poll();
      } catch (ex) {
        panel("run", false);
        panel("src", true);
        alertLine(String(ex && ex.message ? ex.message : ex));
        go.disabled = false;
      }
    });

    async function poll() {
      if (!jobId) return;
      const r = await json(`/api/jobs/${jobId}`);
      if (!r.ok) { show("Lost track of that job."); go.disabled = false; return; }

      const job = r.body.job || {};
      const pct = Number(job.progress || 0);
      if (fill) fill.style.width = pct + "%";
      show(`${job.stage || job.state} — ${pct}%`);

      if (job.state === "done") {
        panel("run", false);
        panel("out", true);
        render(r.body.clips || [], r.body.rejections || [], job);
        showTranscript(r.body);
        go.disabled = false;
        return;
      }
      if (job.state === "failed" || job.state === "cancelled") {
        // `job.message` — the field the API actually sends. The first version read
        // `errorDetail`, a name from the DATABASE row that the view layer translates
        // away, so every failure rendered the generic fallback. A customer whose file
        // held no clip-worthy moments was told "did not finish" — which reads as OUR
        // crash, when the truthful sentence existed one field away.
        panel("run", false);
        panel("src", true);
        alertLine(job.message || "That job did not finish.");
        go.disabled = false;
        return;
      }
      setTimeout(poll, 4000);
    }

    /** The whole stream's words — a by-product worth more than any single clip. */
    function showTranscript(body) {
      const stats = $("outStats");
      if (!stats || !body || !body.transcriptUrl) return;
      const old = document.getElementById("trLinks");
      if (old) old.remove();
      stats.insertAdjacentHTML("beforeend",
        `<span class="t mono" id="trLinks" style="font-size:.78rem">FULL TRANSCRIPT ` +
        `<a class="gld" href="${body.transcriptUrl}" download>.srt</a> · ` +
        `<a class="gld" href="${body.transcriptTxtUrl || body.transcriptUrl}" download>.txt</a></span>`);
      showBonus(body);
    }

    /**
     * BONUS, at the very bottom, in the source's own format: the ORIGINAL video in
     * full with the transcript burned in. Only rendered when the worker actually
     * produced it — no empty promise slots.
     */
    function showBonus(body) {
      const out = $("out");
      const old = document.getElementById("bonusRow");
      if (old) old.remove();
      if (!out || !body.bonusUrl) return;
      out.insertAdjacentHTML("beforeend",
        `<div id="bonusRow" style="margin-top:2rem;border:1px solid var(--edge);padding:1.1rem 1.2rem">
           <span class="t mono" style="font-size:.7rem;color:var(--gold2);letter-spacing:.14em">BONUS</span>
           <p style="margin:.4rem 0 .8rem;font-size:.9rem">The full original video — untouched
           length, original format, subtitles burned in from the transcript.</p>
           <a class="b1" href="${body.bonusUrl}" download>Download full video (subtitled)</a>
         </div>`);
    }

    function render(clips, rejections, job) {
      // The page's OWN card anatomy — .th (9:16 stage), .sc (score badge), .mt (meta).
      // The first version invented its own <figure> markup, so the CSS matched nothing:
      // videos rendered at natural size, the grid warped, and the result looked broken
      // on the very first job a real user completed.
      if (clipGrid) {
        clipGrid.innerHTML = clips.map((c) => `
          <div class="clip">
            <div class="th">
              ${c.url ? `<video src="${escapeHtml(c.url)}" controls preload="metadata"
                                playsinline></video>` : ""}
              <span class="sc">${Number(c.score).toFixed(1)}</span>
            </div>
            <div class="mt">
              <b>${String(c.idx)}. ${escapeHtml(c.title || "Untitled")}</b>
              <span>${Number(c.seconds).toFixed(0)} s</span>
              <a class="b2 sm" href="${c.url ? escapeHtml(c.url) : "#"}"
                 download="short${String(c.idx).padStart(2, "0")}.mp4"
                 style="margin-top:.5rem;font-size:.66rem">Download</a>
              <button class="b2 sm" data-report="${escapeHtml(c.id || "")}"
                      style="margin-top:.5rem;margin-left:.4rem;font-size:.66rem">Report</button>
            </div>
          </div>`).join("");
      }

      // Rejections in the page's own row style, trimmed to what a human scans —
      // the full quotes made the list an unreadable wall on the first real render.
      if (whyList) {
        whyList.innerHTML = rejections.map((x) => {
          // No scores for clips that do not exist (Vigges order): the skipped list
          // shows WHEN and WHAT WAS SAID. The full reasoning stays in the tooltip.
          const raw = String(x.detail || "");
          const q = raw.search(/["“]/);
          const d = /^scored/i.test(raw) ? (q >= 0 ? raw.slice(q) : "") : raw;
          const short = d.length > 150 ? d.slice(0, 147) + "…" : d;
          return `<div class="wr" title="${escapeHtml(d)}"><b>${
            clock(x.atS ?? x.at_s)}</b> ${escapeHtml(short)}</div>`;
        }).join("");
      }

      // TRUE numbers where the demo showed invented ones ("83 % · 24/24 · 7 censored").
      const stats = $("outStats");
      if (stats) {
        const bits = [
          [clips.length, "clips"],
          [rejections.length, "skipped moments logged"],
        ];
        if (job && job.billedMinutes != null) bits.push([job.billedMinutes, "minutes charged"]);
        stats.innerHTML = bits.map(([v, l]) =>
          `<span class="t mono" style="font-size:.78rem;color:var(--dim)">${
            escapeHtml(String(l).toUpperCase())} <b class="gld">${escapeHtml(String(v))}</b></span>`).join("");
      }
      const outName = $("outName");
      if (outName) outName.textContent = (runName && runName.textContent) || `${clips.length} clips`;

      // "This was not good enough" — one sentence from the customer, straight into
      // clip_reports. The button confirms itself instead of pretending via a toast.
      clipGrid?.querySelectorAll("[data-report]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const reason = window.prompt("What was wrong with this clip?");
          if (!reason || !reason.trim()) return;
          const r = await json(`/api/clips/${btn.dataset.report}/report`, {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ reason: reason.trim() }),
          });
          btn.textContent = r.ok ? "Reported ✓" : (r.body?.error || "Could not send");
          if (r.ok) btn.disabled = true;
        });
      });

      // All three buttons are always present; GOLD marks where you are. A delivery
      // makes Download all the gold action; Clip a video steps back to outline.
      const dl = $("dlAll"), nav = $("again");
      if (dl) { dl.disabled = false; dl.classList.remove("b2"); dl.classList.add("b1"); }
      if (nav) { nav.classList.remove("b1"); nav.classList.add("b2"); }
      if (dl) dl.onclick = () => {
        // ONE archive with every clip of this stream, named after it (Vigges order).
        if (job && job.id) { window.location.href = `/api/jobs/${job.id}/download.zip`; return; }
        clips.forEach((c, i) => {           // fallback: per-clip when no job id exists
          if (!c.url) return;
          setTimeout(() => {
            const a = document.createElement("a");
            a.href = c.url; a.download = `short${String(c.idx).padStart(2, "0")}.mp4`;
            document.body.appendChild(a); a.click(); a.remove();
          }, i * 400);
        });
      };
      const again = $("again");
      if (again) again.onclick = () => {
        chosen = null; jobId = null;
        if (dl) { dl.classList.remove("b1"); dl.classList.add("b2"); }
        again.classList.remove("b2"); again.classList.add("b1");
        panel("out", false); panel("src", true);
        const h = drop ? drop.querySelector("h2") : null;
        const pp = drop ? drop.querySelector("p") : null;
        if (h) h.textContent = "Drop a stream file here";
        if (pp) pp.textContent = "MP4 · MKV · MOV · WEBM — UP TO 12 HOURS";
        if (go) go.style.outline = "";
        window.scrollTo({ top: 0, behavior: "smooth" });
      };

      show(`${clips.length} clips ready. ${rejections.length} moments logged as skipped.`);
    }

    /** A failure the customer must actually see, on the panel they are looking at. */
    function alertLine(msg) {
      let box = document.getElementById("cf-alert");
      if (!box) {
        box = document.createElement("p");
        box.id = "cf-alert";
        box.style.cssText = "color:var(--warn);margin:1rem 0 0;font-size:.9rem";
        go.parentNode.insertBefore(box, go.nextSibling);
      }
      box.textContent = msg;
    }

    const escapeHtml = (s) => String(s).replace(/[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const clock = (s) => {
      const t = Math.max(0, Math.round(Number(s) || 0));
      const m = Math.floor(t / 60);
      return `${m}:${String(t % 60).padStart(2, "0")}`;
    };

    // ── paste a link ────────────────────────────────────────────────────────
    const urlIn = $("url"), fetchBtn = $("fetch");
    if (fetchBtn && urlIn) fetchBtn.addEventListener("click", async () => {
      const url = urlIn.value.trim();
      if (!url) { alertLine("Paste a link first."); return; }
      fetchBtn.disabled = true;
      try {
        const r = await json("/api/links/resolve", { method: "POST",
          headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
        if (!r.ok) {
          alertLine((r.body && r.body.error) || "That link is not supported yet."); return;
        }
        const meta = r.body || {};
        const mins = meta.durationS ? Math.round(meta.durationS / 60) + " min" : "unknown length";
        // The API refuses without rightsConfirmed, and the page must not invent it:
        // the confirmation is the customer's own act, recorded server-side.
        const okGo = window.confirm(
          (meta.title || url) + "\n" + mins + "\n\n" +
          "I confirm this recording is my own content, or that I have the " +
          "rights holder's permission to process it.");
        if (!okGo) return;
        const acc = await json("/api/links/accept", { method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url, rightsConfirmed: true }) });
        if (!acc.ok) {
          alertLine((acc.body && acc.body.error) || "Could not accept that link."); return;
        }
        await fetchThenSubmit(acc.body.sourceId, meta.title || url);
      } finally { fetchBtn.disabled = false; }
    });

    /** The fetcher daemon downloads; we submit the moment the source turns ready. */
    async function fetchThenSubmit(sourceId, label) {
      panel("src", false); panel("run", true);
      if (runName) runName.textContent = label;
      show("Fetching the video from the source…");
      for (let i = 0; i < 450; i++) {                     // up to ~30 min
        const sub = await json("/api/jobs", { method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sourceId }) });
        if (sub.ok) { jobId = sub.body.jobId; poll(); return; }
        const msg = (sub.body && sub.body.error) || "";
        const stillFetching = sub.status === 409 || /not ready|fetch/i.test(msg);
        if (!stillFetching) {
          panel("run", false); panel("src", true);
          alertLine(msg || "The fetch failed."); return;
        }
        await new Promise((r) => setTimeout(r, 4000));
      }
      panel("run", false); panel("src", true);
      alertLine("The fetch took too long — upload the file instead.");
    }

    /**
     * On load, pick up whatever the account was last doing.
     *
     * The page PROMISES "close the tab if you like" — so reopening it must attach to
     * the job that kept running, not present an empty upload form as if nothing ever
     * happened. Found by the first real user: his job failed while the tab was open on
     * the form, and the page had no idea it had ever owned a job.
     */
    async function resumeLatest() {
      const wanted = new URLSearchParams(location.search).get("job");
      const r = await json("/api/jobs");
      const all = (r.ok && r.body && r.body.jobs) || [];
      const latest = wanted ? all.find((j) => j.id === wanted) : all[0];
      if (!latest) return;
      if (latest.state === "queued" || latest.state === "running") {
        jobId = latest.id;
        panel("src", false); panel("run", true);
        show((latest.stage || latest.state) + " — " + (latest.progress || 0) + "%");
        poll();
        return;
      }
      // A FINISHED job opens only when the link asked for it (?job=...). Auto-opening
      // the latest delivery hijacked every plain reload of the upload form straight
      // into the results view — reported by the first real user.
      if (!wanted) return;
      const ageH = latest.finishedAt
        ? (Date.now() - new Date(latest.finishedAt).getTime()) / 3600000 : 999;
      if (ageH > 48) return;                       // old history is the dashboard's job
      if (latest.state === "done" && latest.clipCount > 0) {
        const d = await json("/api/jobs/" + latest.id);
        if (d.ok && d.body) {
          panel("src", false); panel("out", true);
          render(d.body.clips || [], d.body.rejections || [], d.body.job);
          showTranscript(d.body);
        }
        return;
      }
      if (latest.state === "failed") alertLine(latest.message || "");
    }

    refreshCredits();
    resumeLatest();
  }

  // ── account ───────────────────────────────────────────────────────────────
  /**
   * Blanks the sample dashboard for a visitor who is not signed in.
   *
   * The private pages ship with demonstration numbers so they can be designed. Live,
   * a logged-out stranger was shown "you@example.com", 14.2 h of credit and four
   * delivered jobs — invented figures presented exactly like real account data.
   * Nobody is fooled for long, but a page that shows a stranger a fake balance is
   * the same lie as a demo that says "check your inbox" without sending anything.
   */
  function showSignedOut() {
    const body = document.getElementById("jobsBody");
    if (body) {
      body.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:2rem">` +
        `<a class="gld" href="/login.html">Sign in</a> to see your jobs.</td></tr>`;
    }
    document.querySelectorAll("[data-cf-email]").forEach((el) => { el.textContent = "—"; });
    document.querySelectorAll("[data-cf-credits]").forEach((el) => { el.textContent = "—"; });
    document.querySelectorAll(".stats .st b").forEach((el) => { el.textContent = "—"; });
    const card = document.getElementById("tfCard");
    if (card) card.style.display = "none";
  }

  async function wireAccount() {
    const r = await json("/api/auth/me");
    if (!r.ok || !r.body) { showSignedOut(); return; }

    // The history the first real user asked for: what ran, when, how long the
    // delivered clips are, and what it cost in tokens. Real rows replace the sample.
    const tbody = document.getElementById("jobsBody");
    if (tbody) {
      const jr = await json("/api/jobs");
      if (jr.ok && jr.body && Array.isArray(jr.body.jobs)) {
        const fmt = (sec) => {
          const t = Math.round(Number(sec) || 0);
          return t >= 60 ? Math.floor(t / 60) + " min " + (t % 60) + " s" : t + " s";
        };
        tbody.innerHTML = jr.body.jobs.map((j) => `
          <tr>
            <td>${(j.title || "—").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</td>
            <td>${new Date(j.createdAt).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}</td>
            <td>${j.clipCount ? fmt(j.clipSeconds) : "—"}</td>
            <td>${j.clipCount}</td>
            <td>${j.billedMinutes != null ? j.billedMinutes + " min" : "0"}</td>
            <td><span class="stbadge st-${j.state}">${j.state}</span></td>
            <td><a class="gld" href="/clipforge/app.html?job=${j.id}">Open →</a></td>
          </tr>`).join("") || `<tr><td colspan="7">No jobs yet.</td></tr>`;
      }
    }
    wireTotp();

    document.querySelectorAll("[data-cf-email]").forEach((el) => {
      el.textContent = r.body.email;
    });
    document.querySelectorAll("[data-cf-credits]").forEach((el) => {
      el.textContent = (Number(r.body.minutes) / 60).toFixed(1);
    });
  }

  /** The 2FA card on the dashboard: status → enable (secret shown once) → confirm. */
  async function wireTotp() {
    const card = $("tfCard");
    if (!card) return;
    const state = $("tfState"), setup = $("tfSetup"), secretEl = $("tfSecret"),
          uriEl = $("tfUri"), codeEl = $("tfCode"), btn = $("tfBtn"), msg = $("tfMsg");
    const fail = (t) => { msg.textContent = t; msg.style.display = "block"; };
    const st = await json("/api/auth/totp");
    if (!st.ok) return;                       // no session — leave the card hidden
    card.style.display = "block";
    let mode = st.body.enabled ? "on" : "off";

    const paint = () => {
      msg.style.display = "none";
      if (mode === "on") {
        state.textContent = "ON — your sign-in link asks for an authenticator code.";
        btn.textContent = "Disable 2FA";
        codeEl.style.display = "inline-block"; codeEl.placeholder = "code to disable";
        setup.style.display = "none";
      } else if (mode === "pending") {
        state.textContent = "Scan the secret, then confirm with the current code.";
        btn.textContent = "Confirm code";
        codeEl.style.display = "inline-block"; codeEl.placeholder = "000000";
        setup.style.display = "block";
      } else {
        state.textContent = "OFF — sign-in is the email link alone.";
        btn.textContent = "Enable 2FA";
        codeEl.style.display = "none";
        setup.style.display = "none";
      }
    };
    paint();

    btn.onclick = async () => {
      msg.style.display = "none";
      if (mode === "off") {
        const r = await json("/api/auth/totp/setup", { method: "POST" });
        if (!r.ok) return fail("Could not start setup.");
        secretEl.textContent = r.body.secret;
        uriEl.textContent = r.body.uri;
        mode = "pending"; paint(); codeEl.focus();
      } else if (mode === "pending") {
        const r = await json("/api/auth/totp/confirm", { method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: codeEl.value.trim() }) });
        if (!r.ok) return fail((r.body && r.body.error) || "Wrong code.");
        mode = "on"; codeEl.value = ""; paint();
      } else {
        const r = await json("/api/auth/totp/disable", { method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: codeEl.value.trim() }) });
        if (!r.ok) return fail((r.body && r.body.error) || "A current code is required.");
        mode = "off"; codeEl.value = ""; paint();
      }
    };
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!(await live())) return;             // static host: leave the brochure alone
    document.documentElement.setAttribute("data-cf-live", "1");
    wireLogin();
    wireApp();
    wireAccount();
  });
})();
