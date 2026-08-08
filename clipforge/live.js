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
      if (h) h.textContent = "VALD: " + chosen.name;
      if (pp) pp.textContent = mb + " MB — tryck »Start clipping« nedanför";
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
        const sub = await json("/api/jobs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sourceId }),
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
        render(r.body.clips || [], r.body.rejections || []);
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

    function render(clips, rejections) {
      if (clipGrid) {
        clipGrid.innerHTML = clips.map((c) =>
          `<figure class="clip"><figcaption>${
            String(c.idx)}. ${escapeHtml(c.title || "")} — ${
            Number(c.seconds).toFixed(0)}s</figcaption>${
            c.url ? `<video src="${escapeHtml(c.url)}" controls preload="none"></video>` : ""
          }</figure>`).join("");
      }
      if (whyList) {
        whyList.innerHTML = rejections.map((x) =>
          `<li><b>${clock(x.atS ?? x.at_s)}</b> ${escapeHtml(x.detail || "")}</li>`).join("");
      }
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
      if (!url) { alertLine("Klistra in en länk först."); return; }
      fetchBtn.disabled = true;
      try {
        const r = await json("/api/links/resolve", { method: "POST",
          headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
        if (!r.ok) {
          alertLine((r.body && r.body.error) || "Den länken stöds inte än."); return;
        }
        const meta = r.body || {};
        const mins = meta.durationS ? Math.round(meta.durationS / 60) + " min" : "okänd längd";
        // The API refuses without rightsConfirmed, and the page must not invent it:
        // the confirmation is the customer's own act, recorded server-side.
        const okGo = window.confirm(
          (meta.title || url) + "\n" + mins + "\n\n" +
          "Jag intygar att detta är mitt eget material, eller att jag har " +
          "rättighetsinnehavarens tillstånd att bearbeta det.");
        if (!okGo) return;
        const acc = await json("/api/links/accept", { method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url, rightsConfirmed: true }) });
        if (!acc.ok) {
          alertLine((acc.body && acc.body.error) || "Kunde inte ta emot länken."); return;
        }
        await fetchThenSubmit(acc.body.sourceId, meta.title || url);
      } finally { fetchBtn.disabled = false; }
    });

    /** The fetcher daemon downloads; we submit the moment the source turns ready. */
    async function fetchThenSubmit(sourceId, label) {
      panel("src", false); panel("run", true);
      if (runName) runName.textContent = label;
      show("Hämtar videon från källan…");
      for (let i = 0; i < 450; i++) {                     // up to ~30 min
        const sub = await json("/api/jobs", { method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sourceId }) });
        if (sub.ok) { jobId = sub.body.jobId; poll(); return; }
        const msg = (sub.body && sub.body.error) || "";
        const stillFetching = sub.status === 409 || /not ready|fetch/i.test(msg);
        if (!stillFetching) {
          panel("run", false); panel("src", true);
          alertLine(msg || "Hämtningen misslyckades."); return;
        }
        await new Promise((r) => setTimeout(r, 4000));
      }
      panel("run", false); panel("src", true);
      alertLine("Hämtningen tog för länge — ladda upp filen i stället.");
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
      const r = await json("/api/jobs");
      const latest = r.ok && r.body && r.body.jobs && r.body.jobs[0];
      if (!latest) return;
      if (latest.state === "queued" || latest.state === "running") {
        jobId = latest.id;
        panel("src", false); panel("run", true);
        show((latest.stage || latest.state) + " — " + (latest.progress || 0) + "%");
        poll();
        return;
      }
      const ageH = latest.finishedAt
        ? (Date.now() - new Date(latest.finishedAt).getTime()) / 3600000 : 999;
      if (ageH > 48) return;                       // old history is the dashboard's job
      if (latest.state === "done" && latest.clipCount > 0) {
        const d = await json("/api/jobs/" + latest.id);
        if (d.ok && d.body) {
          panel("src", false); panel("out", true);
          render(d.body.clips || [], d.body.rejections || []);
        }
        return;
      }
      if (latest.state === "failed") alertLine(latest.message || "");
    }

    refreshCredits();
    resumeLatest();
  }

  // ── account ───────────────────────────────────────────────────────────────
  async function wireAccount() {
    const r = await json("/api/auth/me");
    if (!r.ok || !r.body) return;
    document.querySelectorAll("[data-cf-email]").forEach((el) => {
      el.textContent = r.body.email;
    });
    document.querySelectorAll("[data-cf-credits]").forEach((el) => {
      el.textContent = (Number(r.body.minutes) / 60).toFixed(1);
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!(await live())) return;             // static host: leave the brochure alone
    document.documentElement.setAttribute("data-cf-live", "1");
    wireLogin();
    wireApp();
    wireAccount();
  });
})();
