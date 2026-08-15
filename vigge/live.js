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
    const email = $("email"), pw = $("password"), err = $("err"), sent = $("sent"),
          addr = $("addr"), title = $("authTitle"), sub = $("authSub"),
          tabIn = $("tabIn"), tabUp = $("tabUp"), btn = $("submitBtn"),
          pwField = $("pwField"), pwHint = $("pwHint"), forgot = $("forgot"),
          note = $("signupNote");

    // The page's own mechanism, not `hidden`: `.sent{display:none}` / `.sent.on`.
    const showError = (m) => { err.textContent = m; err.style.display = "block"; };
    const hideError = () => { err.style.display = "none"; };
    const showSent = (to) => { addr.textContent = to; form.classList.add("off"); sent.classList.add("on"); };
    const back = $("back");
    if (back) back.onclick = () => { sent.classList.remove("on"); form.classList.remove("off"); email.focus(); };

    // signin | signup | recover — one form, three jobs, so nobody hunts for a
    // "create account" page that looks like a different product.
    let mode = new URLSearchParams(location.search).has("new") ? "signup" : "signin";
    const paint = () => {
      hideError();
      const up = mode === "signup", rec = mode === "recover";
      if (tabIn) tabIn.classList.toggle("b1", mode === "signin");
      if (tabUp) tabUp.classList.toggle("b1", up);
      if (pwField) pwField.style.display = rec ? "none" : "block";
      if (pwHint) pwHint.style.display = up ? "block" : "none";
      if (note) note.style.display = up ? "inline" : "none";
      const tosField = document.getElementById("tosField");
      if (tosField) tosField.style.display = up ? "flex" : "none";
      if (forgot) forgot.style.display = rec ? "none" : "inline";
      if (pw) pw.setAttribute("autocomplete", up ? "new-password" : "current-password");
      title.textContent = rec ? "Reset your password"
                        : up ? "Create your account" : "Sign in to ViggeClips";
      sub.textContent = rec ? "We email a one-time link that signs you in. Set a new password from your dashboard."
                       : "Two hours of clipping free every month.";
      btn.textContent = rec ? "Email me a link" : up ? "Create account" : "Sign in";
    };
    if (tabIn) tabIn.onclick = () => { mode = "signin"; paint(); };
    if (tabUp) tabUp.onclick = () => { mode = "signup"; paint(); };
    if (forgot) forgot.onclick = (e) => { e.preventDefault(); mode = "recover"; paint(); };
    paint();

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const value = email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        showError("Enter a valid email address."); email.focus(); return;
      }
      hideError();
      btn.disabled = true;
      const done = () => { btn.disabled = false; };

      try {
        if (mode === "recover") {
          const r = await json("/api/auth/request", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: value }),
          });
          // A 2xx means the request was accepted, and the screen must then look the
          // same whether or not that address has an account. Anything else means the
          // request did NOT land — saying "check your inbox" for that is the lie that
          // once left somebody refreshing an empty mailbox.
          if (r.ok) { showSent(value); return; }
          showError((r.body && r.body.message) ||
            `The server refused the request (HTTP ${r.status}). Nothing was sent.`);
          return;
        }

        // Värvningskoden reser med länken hela vägen till registreringen: den
        // sparas när besökaren landar (index.html), inte bara om de råkar
        // registrera sig i samma sekund.
        let ref = null;
        try { ref = localStorage.getItem("cf_ref") || null; } catch (e) {}
        const tos = document.getElementById("tos");
        if (mode === "signup" && tos && !tos.checked) {
          showError("Please confirm you are 16+ and accept the terms."); done(); return;
        }
        const path = mode === "signup" ? "/api/auth/register" : "/api/auth/signin";
        const r = await json(path, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: value, password: pw ? pw.value : "",
                                 ...(mode === "signup" && ref ? { ref } : {}) }),
        });
        if (r.ok) { location.href = mode === "signup" ? "/app.html?welcome=1" : "/app.html"; return; }
        showError((r.body && r.body.message) ||
          (r.status === 0 ? "Could not reach the server. Is it running?"
                          : `That did not work (HTTP ${r.status}).`));
      } catch {
        showError("Could not reach the server.");
      } finally { done(); }
    });
  }

  // ── the workspace ─────────────────────────────────────────────────────────
/**
 * Fills every [data-cf-*] tile from /api/account/stats.
 *
 * The tiles ship as "—" and STAY "—" unless a real number arrives — a dash is
 * honest about not knowing, a mockup figure is a lie with confidence. (The page
 * once told a customer with zero jobs that 37 shorts had been delivered.)
 */
async function refreshStats() {
  const r = await json("/api/account/stats");
  if (!r.ok || !r.body) return;
  const put = (sel, v) => {
    for (const el of document.querySelectorAll(sel)) el.textContent = v;
  };
  const usedH = Number(r.body.usedPeriodMin || 0) / 60;
  put("[data-cf-used]", usedH.toFixed(1));
  put("[data-cf-shorts]", String(r.body.shortsDelivered ?? 0));
  put("[data-cf-jobs]", String(r.body.jobsTotal ?? 0));
  const freeH = Number(r.body.monthlyFreeMinutes || 120) / 60;
  const bar = document.querySelector("[data-cf-usagebar]");
  if (bar) bar.style.width =
    Math.min(100, Math.round((usedH / freeH) * 100)) + "%";
  put("[data-cf-usagelabel]",
      usedH.toFixed(1) + " OF " + freeH.toFixed(1) + " HOURS USED");
}

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

    // Pulsen: håller status-raden LEVANDE mellan poll-svaren. Steget kan stå på
    // samma procent i tio minuter (CPU-transkribering) — men räknaren tickar varje
    // sekund och snurran snurrar, så "stilla" aldrig ser ut som "dött".
    const pulse = { stage: null, pct: 0, eta: "", t0: 0, timer: null };

    function pulseRender() {
      if (!eta || !pulse.stage) return;
      const sec = Math.floor((Date.now() - pulse.t0) / 1000);
      const mm = String(Math.floor(sec / 60)).padStart(2, "0");
      const ss = String(sec % 60).padStart(2, "0");
      eta.innerHTML = '<span class="spin"></span>' +
        `${pulse.stage} — ${pulse.pct}% · ${mm}:${ss} in this step${pulse.eta}` +
        '<span class="mono" style="display:block;font-size:.68rem;color:var(--dim2);margin-top:.25rem">' +
        "STILL WORKING — LONG STEPS CAN SIT ON THE SAME PERCENT FOR MINUTES</span>";
    }

    function pulseSet(stage, pct, etaTxt) {
      if (pulse.stage !== stage) { pulse.stage = stage; pulse.t0 = Date.now(); }
      pulse.pct = pct; pulse.eta = etaTxt || "";
      if (!pulse.timer) pulse.timer = setInterval(pulseRender, 1000);
      pulseRender();
    }

    /**
     * #40 Avbryt: rutten har funnits sedan gren B, knappen har aldrig funnits.
     * En kund som laddat upp fel fil ska kunna ångra sig utan att mejla oss —
     * och utan att betala för en körning hen inte vill ha.
     */
    function showCancel(on) {
      let b = document.getElementById("cancelJob");
      if (!on) { if (b) b.remove(); return; }
      if (b || !eta) return;
      b = document.createElement("button");
      b.id = "cancelJob"; b.className = "b3 sm"; b.type = "button";
      b.style.cssText = "margin-top:.9rem;font-size:.68rem";
      b.textContent = "Cancel this job";
      b.addEventListener("click", async () => {
        if (b.dataset.armed !== "1") {
          // Två steg: ett oavsiktligt klick ska aldrig kasta 40 minuters arbete.
          b.dataset.armed = "1"; b.textContent = "Cancel — are you sure?";
          setTimeout(() => { if (b.isConnected) { b.dataset.armed = "0"; b.textContent = "Cancel this job"; } }, 5000);
          return;
        }
        b.disabled = true; b.textContent = "Cancelling…";
        const r = await json(`/api/jobs/${jobId}/cancel`, { method: "POST" });
        if (r.ok) { pulseStop(); show("Cancelled. Nothing was charged."); b.remove(); go.disabled = false; }
        else { b.disabled = false; b.textContent = "Cancel this job"; alertLine("Could not cancel — it may already be finished."); }
      });
      eta.parentNode.insertBefore(b, eta.nextSibling);
    }

    function pulseStop() {
      showCancel(false);
      if (pulse.timer) clearInterval(pulse.timer);
      pulse.timer = null; pulse.stage = null;
    }

    async function refreshCredits() {
      const r = await json("/api/auth/me");
      if (r.ok && r.body && cred) {
        cred.textContent = (Number(r.body.minutes) / 60).toFixed(1) + " h";
      }
      if (r.ok) refreshStats();          // the dashboard tiles, measured not mocked
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
      if (!r.ok) { pulseStop(); show("Lost track of that job."); go.disabled = false; return; }

      const job = r.body.job || {};
      const pct = Number(job.progress || 0);
      if (fill) fill.style.width = pct + "%";
      // The honest clock: measured on the CPU engine, a job takes about four times
      // the video's length. billedMinutes is set by the worker's own measurement
      // BEFORE the heavy stages, so the estimate is grounded, not guessed.
      const etaTxt = job.billedMinutes
        ? ` · ~${Math.max(1, Math.round(job.billedMinutes * 3 * (1 - pct / 100)))} min left`
        : "";
      pulseSet(job.stage || job.state, pct, etaTxt);
      showCancel(job.state === "running" || job.state === "queued");

      if (job.state === "done") {
        pulseStop();
        panel("run", false);
        panel("out", true);
        render(r.body.clips || [], r.body.rejections || [], job);
        showTranscript(r.body);
        go.disabled = false;
        return;
      }
      if (job.state === "failed" || job.state === "cancelled") {
        pulseStop();
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
        `<a class="gld" href="${body.transcriptTxtUrl || body.transcriptUrl}" download>.txt</a> · ` +
        `<a class="gld" href="#" id="copyTx">copy text</a></span>`);
      const cp = document.getElementById("copyTx");
      if (cp) cp.addEventListener("click", async (e) => {
        // Transkriptet återanvänds till videobeskrivningar och blogginlägg —
        // "ladda ner en fil och öppna den" är tre steg för mycket.
        e.preventDefault();
        try {
          const t = await (await fetch(body.transcriptTxtUrl || body.transcriptUrl)).text();
          await navigator.clipboard.writeText(t);
          cp.textContent = "copied ✓";
        } catch (err) { cp.textContent = "could not copy"; }
        setTimeout(() => { cp.textContent = "copy text"; }, 2500);
      });
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

    // Kundens YouTube-mål (om kopplat) — hämtas en gång, styr om →YouTube-knappen syns.
    let ytTarget = null;
    (async () => {
      const t = await json("/api/publish/targets");
      const arr = (t.ok && t.body && Array.isArray(t.body.targets)) ? t.body.targets : [];
      ytTarget = arr.find((x) => x.platform === "youtube") || null;
    })();

    if (clipGrid) clipGrid.addEventListener("click", async (ev) => {
      const b = ev.target.closest("[data-yt]");
      if (!b || !ytTarget) return;
      b.disabled = true; b.textContent = "Sending…";
      const r = await json("/api/publish", { method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clipId: b.dataset.yt, targetId: ytTarget.id,
                               title: b.dataset.ytTitle || undefined }) });
      if (r.ok) {
        // Ärligt om vad som händer: uppladdningen sker som PRIVATE — kunden
        // publicerar själv i sin Studio. Vi är bärare, inte megafon.
        b.textContent = "Queued ✓ private in your Studio";
      } else {
        b.disabled = false; b.textContent = "→ YouTube";
        alertLine((r.body && r.body.error) || "Could not queue the upload.");
      }
    });

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
              ${ytTarget ? `<button class="b1 sm" data-yt="${escapeHtml(c.id || "")}"
                      data-yt-title="${escapeHtml(c.title || "")}"
                      style="margin-top:.5rem;margin-left:.4rem;font-size:.66rem">→ YouTube</button>` : ""}
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
    // Varje läge är SYNLIGT: knappen visar aldrig ett dött ansikte. Spinnern och
    // statusraden bor precis under fältet — på mobilen är det enda ytan man ser.
    const urlIn = $("url"), fetchBtn = $("fetch"),
          fStatus = $("fetchStatus"), fConfirm = $("fetchConfirm"),
          fcTitle = $("fcTitle"), fcMeta = $("fcMeta"),
          fcGo = $("fcGo"), fcCancel = $("fcCancel");

    function fetchState(kind, msg) {
      if (!fStatus) return;
      fStatus.hidden = !msg;
      fStatus.style.color = kind === "err" ? "var(--warn)" : "var(--dim)";
      fStatus.innerHTML = (kind === "busy" ? '<span class="spin"></span>' : "") +
        String(msg || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    }

    if (fetchBtn && urlIn) fetchBtn.addEventListener("click", async () => {
      const url = urlIn.value.trim();
      if (!url) { fetchState("err", "Paste a link first."); return; }
      if (fConfirm) fConfirm.hidden = true;
      fetchBtn.disabled = true;
      fetchBtn.textContent = "Looking…";
      fetchState("busy", "Looking up the video…");
      try {
        const r = await json("/api/links/resolve", { method: "POST",
          headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
        if (!r.ok) {
          fetchState("err", (r.body && r.body.error) || "That link is not supported yet.");
          return;
        }
        const meta = r.body || {};
        const mins = meta.durationS ? Math.round(meta.durationS / 60) + " min" : "unknown length";
        fetchState("", "");
        // Rättighetsbekräftelsen är ett eget kort — window.confirm äts upp av vissa
        // mobilwebbläsare, och kunden ska SE titeln vi hittade innan något laddas ner.
        if (fcTitle) fcTitle.textContent = meta.title || url;
        if (fcMeta) fcMeta.textContent =
          mins + " · uses about " + (meta.estimatedMinutes || "?") + " min of your credits";
        if (fConfirm) fConfirm.hidden = false;

        const accept = async () => {
          fConfirm.hidden = true;
          fetchState("busy", "Queueing the download…");
          const acc = await json("/api/links/accept", { method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ url, rightsConfirmed: true }) });
          if (!acc.ok) {
            fetchState("err", (acc.body && acc.body.error) || "Could not accept that link.");
            return;
          }
          await fetchThenSubmit(acc.body.sourceId, meta.title || url);
        };
        if (fcGo) fcGo.onclick = accept;
        if (fcCancel) fcCancel.onclick = () => { fConfirm.hidden = true; fetchState("", ""); };
      } finally {
        fetchBtn.disabled = false;
        fetchBtn.textContent = "Fetch";
      }
    });

    /**
     * Kundens val, ETT ställe.
     *
     * Språk och klipplängd fanns i formuläret, i API:t och i databasen — men ingen
     * anropsplats skickade dem, så motorn körde alltid svenska/standardlängd. En
     * dropdown som inte gör något är en tyst lögn; nu läses de här, av alla.
     */
    function jobOptions() {
      const g = (id) => { const el = document.getElementById(id); return el ? el.value : undefined; };
      const o = { language: g("lang"), clipLength: g("len"), subtitleFont: g("font") };
      Object.keys(o).forEach((k) => { if (!o[k]) delete o[k]; });
      return o;
    }

    /** The fetcher daemon downloads; we submit the moment the source turns ready. */
    async function fetchThenSubmit(sourceId, label) {
      panel("src", false); panel("run", true);
      if (runName) runName.textContent = label;
      const t0 = Date.now();
      show("Downloading to our server…");
      for (let i = 0; i < 450; i++) {                     // up to ~30 min
        const sub = await json("/api/jobs", { method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sourceId, ...jobOptions() }) });
        if (sub.ok) { jobId = sub.body.jobId; poll(); return; }
        const msg = (sub.body && sub.body.error) || "";
        const stillFetching = sub.status === 409 || /not ready|fetch/i.test(msg);
        if (stillFetching) {
          show(`Downloading to our server… ${Math.round((Date.now() - t0) / 1000)}s`);
        }
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
            <td><a class="gld" href="/app.html?job=${j.id}">Open →</a>${
              j.state === "done" && j.clipCount > 0
                ? ` <button class="b1 sm" data-sched="${j.id}" data-n="${j.clipCount}"
                       style="margin-left:.5rem;white-space:nowrap">Schedule to YouTube</button>` : ""
            }</td>
          </tr>`).join("") || `<tr><td colspan="7">No jobs yet.</td></tr>`;

        // ── Schemalagd utspridning: klippen släpps av YouTube själv, utspritt ──
        // över dagar i kanalens bästa timmar — aldrig trettio shorts på en sekund.
        const targets = await json("/api/publish/targets");
        const ytAll = (targets.ok && targets.body && Array.isArray(targets.body.targets))
          ? targets.body.targets.filter((x) => x.platform === "youtube") : [];
        const yt = ytAll[0] || null;
        // #35 Sök + filter, rent i klienten: raderna finns redan här, och en
        // serverrundtur per tangenttryck vore slöseri för en lista i den här storleken.
        const q = document.getElementById("jobSearch");
        const f = document.getElementById("jobFilter");
        const applyFilter = () => {
          const needle = (q && q.value || "").toLowerCase().trim();
          const want = (f && f.value) || "";
          let shown = 0;
          tbody.querySelectorAll("tr").forEach((tr) => {
            if (!tr.querySelector("td")) return;
            const title = (tr.cells[0]?.textContent || "").toLowerCase();
            const state = (tr.querySelector(".stbadge")?.textContent || "").trim();
            const hit = (!needle || title.includes(needle)) && (!want || state === want);
            tr.style.display = hit ? "" : "none";
            if (hit) shown++;
          });
          // Ärligt tomläge: en tom tabell utan förklaring läses som "allt är borta".
          let none = document.getElementById("noMatch");
          if (!shown) {
            if (!none) {
              none = document.createElement("tr"); none.id = "noMatch";
              none.innerHTML = '<td colspan="7" style="color:var(--dim)">No jobs match that.</td>';
              tbody.appendChild(none);
            }
          } else if (none) { none.remove(); }
        };
        if (q) q.addEventListener("input", applyFilter);
        if (f) f.addEventListener("change", applyFilter);

        // Kortet överst på Edited videos: säg ärligt om kanalen är kopplad.
        const schedState = document.querySelector("[data-sched-state]");
        if (schedState) {
          if (yt) {
            schedState.style.color = "var(--gold2)";
            schedState.textContent = "CONNECTED: " + (yt.accountLabel || "your channel") +
              " — press Schedule to YouTube on a job below.";
          } else {
            schedState.innerHTML = 'NO CHANNEL CONNECTED YET — ' +
              '<a class="gld" href="/account.html">connect YouTube on your account page</a>' +
              ' first, then the buttons below go live.';
          }
        }

        tbody.addEventListener("click", async (ev) => {
          const b = ev.target.closest("[data-sched]");
          if (b && !b.dataset.busy) {
            if (!yt) {
              b.textContent = "Connect YouTube first";
              setTimeout(() => { b.textContent = "Schedule to YouTube"; }, 2500);
              return;
            }
            // Klicket öppnar TRE ärliga val i stället för att gissa åt kunden.
            const cell = b.parentElement;
            b.hidden = true;
            const box = document.createElement("span");
            box.className = "schedpick";
            // Flera kanaler? Välj kanal först — en specifik eller alla på en gång.
            // Samma video på flera kanaler kan YouTube se som dubbletter; valet är
            // kundens, och det ska vara ett VAL, aldrig en bieffekt.
            box.dataset.targets = JSON.stringify(
              ytAll.map((t) => ({ id: t.id, label: t.accountLabel || "channel" })));
            if (ytAll.length > 1 && !box.dataset.pickedTarget) {
              box.innerHTML =
                ytAll.map((t) => `<button class="b2 sm" data-ch="${String(t.id).replace(/[^a-z0-9-]/gi, "")}"
                   style="font-size:.62rem">${String(t.accountLabel || "channel").replace(/[&<>]/g, "")}</button>`).join("") +
                `<button class="b1 sm" data-ch="all" style="font-size:.62rem">All ${ytAll.length} channels</button>` +
                `<button class="b3 sm" data-ch="cancel" style="font-size:.62rem">✕</button>`;
              cell.appendChild(box);
              box.addEventListener("click", (e3) => {
                const c = e3.target.closest("[data-ch]");
                if (!c) return;
                if (c.dataset.ch === "cancel") { box.remove(); b.hidden = false; return; }
                box.dataset.pickedTarget = c.dataset.ch;
                renderModes();
              });
              return;
            }
            box.dataset.pickedTarget = box.dataset.pickedTarget || (yt ? yt.id : "");
            cell.appendChild(box);
            renderModes();
            function renderModes() { box.innerHTML =
              `<button class="b1 sm" data-mode="public_now" style="font-size:.62rem">Public now</button>` +
              `<button class="b2 sm" data-mode="hourly" style="font-size:.62rem">1/hour · starts in 1 h</button>` +
              `<button class="b2 sm" data-mode="daily" style="font-size:.62rem">3/day · 10·15·19</button>` +
              `<button class="b3 sm" data-mode="cancel" style="font-size:.62rem">✕</button>`; }
            box.addEventListener("click", async (e2) => {
              const m = e2.target.closest("[data-mode]");
              if (!m) return;
              if (m.dataset.mode === "cancel") { box.remove(); b.hidden = false; return; }
              box.querySelectorAll("button").forEach((x) => { x.disabled = true; });
              m.textContent = "Working…";
              // Vald kanal — eller ALLA: idempotensen i kön gör omkörningar ofarliga.
              const all = JSON.parse(box.dataset.targets || "[]");
              const picked = box.dataset.pickedTarget === "all"
                ? all.map((t) => t.id)
                : [box.dataset.pickedTarget || (yt && yt.id)].filter(Boolean);
              let r = { ok: false, body: {} };
              let total = 0;
              for (const tid of picked) {
                r = await json("/api/publish/schedule", { method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ jobId: b.dataset.sched, targetId: tid,
                                         perDay: 3, mode: m.dataset.mode }) });
                if (r.ok) total += (r.body.scheduled || []).length;
              }
              box.remove(); b.hidden = false; b.disabled = true; b.dataset.busy = "1";
              if (r.ok) {
                const k = total;
                const first = k && r.body.scheduled[0].publishAt
                  ? new Date(r.body.scheduled[0].publishAt) : null;
                b.textContent = !k ? "Already scheduled ✓"
                  : m.dataset.mode === "public_now"
                    ? `✓ ${k} uploading — live within minutes`
                    : `✓ ${k} scheduled — first ${first.toLocaleString("sv-SE",
                        { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
              } else {
                b.disabled = false; delete b.dataset.busy;
                b.textContent = "Schedule to YouTube";
                alert((r.body && r.body.error) || "Could not schedule.");
              }
            });
          }
        });
      }
    }
    wireTotp();
    wireChannels();
    wireVocabulary();
    wireReferral();
    wireAccountControl();

    document.querySelectorAll("[data-cf-email]").forEach((el) => {
      el.textContent = r.body.email;
    });
    document.querySelectorAll("[data-cf-credits]").forEach((el) => {
      el.textContent = (Number(r.body.minutes) / 60).toFixed(1);
    });
    refreshStats();                      // mätvärden till plattorna + usage-baren
  }

  /** Gren F: sessioner, utloggning överallt, radering (#62,#65). */
  async function wireAccountControl() {
    const list = document.getElementById("sessList");
    if (list) {
      const r = await json("/api/account/sessions");
      const ss = (r.ok && r.body && r.body.sessions) || [];
      list.textContent = ss.length
        ? `${ss.length} ACTIVE ${ss.length === 1 ? "SESSION" : "SESSIONS"} · ` +
          `THIS DEVICE SINCE ${new Date(ss[0].startedAt).toLocaleDateString("sv-SE")}`
        : "NO ACTIVE SESSIONS";
    }
    const all = document.getElementById("logoutAll");
    if (all) all.addEventListener("click", async () => {
      all.disabled = true; all.textContent = "Signing out…";
      const r = await json("/api/auth/logout-all", { method: "POST" });
      // Utloggning överallt loggar ut ÄVEN här — allt annat vore en halv sanning.
      if (r.ok) location.href = "/login.html";
      else { all.disabled = false; all.textContent = "Sign out everywhere"; }
    });

    const del = document.getElementById("delAcct");
    const box = document.getElementById("delBox");
    const conf = document.getElementById("delConfirm");
    const mail = document.getElementById("delEmail");
    const msg = document.getElementById("delMsg");
    if (del && box) del.addEventListener("click", () => { box.hidden = !box.hidden; });
    if (conf) conf.addEventListener("click", async () => {
      conf.disabled = true; msg.textContent = "Deleting…";
      const r = await json("/api/account/delete", { method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: (mail && mail.value) || "" }) });
      if (r.ok && r.body && r.body.deleted) { location.href = "/?deleted=1"; return; }
      conf.disabled = false;
      msg.textContent = (r.body && r.body.error) || "Could not delete the account.";
    });
  }

  /** #53 Värvningslänken: hämta, kopiera, visa ärlig statistik. */
  async function wireReferral() {
    const box = document.getElementById("refUrl");
    const btn = document.getElementById("refCopy");
    const stats = document.getElementById("refStats");
    if (!box) return;
    const r = await json("/api/account/referral");
    if (!r.ok || !r.body) return;
    box.value = r.body.url;
    if (stats) {
      // Ärligt även när det är noll: "0 joined" är information, en tom rad är tystnad.
      stats.textContent = `${r.body.joined} SIGNED UP · ${r.body.delivered} MADE CLIPS · ` +
        `${(r.body.minutesEarned / 60).toFixed(0)} HOURS EARNED`;
    }
    if (btn) btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(box.value);
        btn.textContent = "Copied ✓";
      } catch (e) { box.select(); btn.textContent = "Press Ctrl+C"; }
      setTimeout(() => { btn.textContent = "Copy link"; }, 2500);
    });
  }

  /** #16 Kundens ordlista: hämta, spara, säg ärligt vad som hände. */
  async function wireVocabulary() {
    const box = document.getElementById("vocab");
    const btn = document.getElementById("vocabSave");
    const msg = document.getElementById("vocabMsg");
    if (!box || !btn) return;
    const r = await json("/api/account/vocabulary");
    if (r.ok && r.body) box.value = r.body.vocabulary || "";
    btn.addEventListener("click", async () => {
      btn.disabled = true; msg.textContent = "Saving…";
      const s = await json("/api/account/vocabulary", { method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vocabulary: box.value }) });
      btn.disabled = false;
      if (s.ok) {
        // Servern trimmar och kapar — visa DET tillbaka, aldrig bara "sparat":
        // kunden ska se exakt vad motorn faktiskt kommer att använda.
        box.value = s.body.vocabulary || "";
        msg.textContent = box.value ? "SAVED — USED ON YOUR NEXT JOB" : "CLEARED";
      } else {
        msg.textContent = "COULD NOT SAVE";
      }
      setTimeout(() => { msg.textContent = ""; }, 4000);
    });
  }

  /** Kopplade kanaler på kontosidan: lista, koppla bort, och ärlig OAuth-status. */
  async function wireChannels() {
    const list = document.getElementById("channelsList");
    if (!list) return;

    // Utfallet av en OAuth-runda kommer hem som ?yt=… — säg det med ord.
    const line = document.getElementById("ytStatusLine");
    const yt = new URLSearchParams(location.search).get("yt");
    if (line && yt) {
      const msgs = {
        connected: ["var(--gold2)", "YouTube connected — finished clips can now be sent to your channel."],
        denied: ["var(--warn)", "The connection was cancelled or the link expired. Try again."],
        failed: ["var(--warn)", "Google refused the connection. Try again in a minute."],
      };
      const m = msgs[yt];
      if (m) { line.hidden = false; line.style.color = m[0]; line.textContent = m[1]; }
      history.replaceState(null, "", "/account.html");
    }

    const r = await json("/api/publish/targets");
    const targets = (r.ok && r.body && Array.isArray(r.body.targets)) ? r.body.targets
                  : (r.ok && Array.isArray(r.body)) ? r.body : [];
    if (!targets.length) {
      list.innerHTML = '<p class="mono" style="font-size:.78rem;color:var(--dim2)">' +
        "NO CHANNELS CONNECTED YET</p>";
      return;
    }
    // Multi-kanal är en funktion, inte en glömska: knappen finns kvar men säger
    // ärligt vad nästa klick gör. (Kopplingarna är unika per KANAL-id i databasen.)
    const connectBtn = document.querySelector('a[href="/api/publish/oauth/youtube/start"]');
    if (connectBtn) connectBtn.textContent = "Connect another YouTube channel";
    list.innerHTML = targets.map((t) => `
      <div style="display:flex;gap:.8rem;align-items:center;margin:.35rem 0">
        <b style="font-size:.9rem">${String(t.platformLabel || t.platform || "").replace(/[&<>]/g, "")}</b>
        <span class="mono" style="font-size:.78rem;color:var(--dim2)">${
          String(t.accountLabel || "").replace(/[&<>]/g, "")}</span>
        <button class="b3 sm" data-disconnect="${String(t.id).replace(/[^a-z0-9-]/gi, "")}"
                style="font-size:.66rem;margin-left:auto">Disconnect</button>
      </div>`).join("");
    list.querySelectorAll("[data-disconnect]").forEach((b) => {
      b.addEventListener("click", async () => {
        b.disabled = true;
        await json(`/api/publish/targets/${b.dataset.disconnect}/disconnect`, { method: "POST" });
        wireChannels();
      });
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

  /**
   * The header's sign-in button, told the truth about who is looking at it.
   *
   * cf.js renders "Sign in" because it runs before any session is known. A visitor
   * who IS signed in should not be invited to sign in again — that reads as "you are
   * logged out" and sends people round a loop they did not need.
   */
  async function wireNavAuth() {
    const el = document.getElementById("navAuth");
    if (!el) return;
    const r = await json("/api/auth/me");
    if (r.ok && r.body && r.body.email) {
      el.textContent = "Account";
      el.setAttribute("href", "/account.html");
      el.title = r.body.email;
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!(await live())) return;             // static host: leave the brochure alone
    document.documentElement.setAttribute("data-cf-live", "1");
    wireNavAuth();
    wireLogin();
    wireApp();
    wireAccount();
  });
})();
