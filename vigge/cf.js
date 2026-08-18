/* ViggeClips — shared behaviour: header state, scroll reveals, nav/footer injection.
   Every page loads this. Page-specific logic stays in the page. */
(function () {
  "use strict";

  const NAV = [
    ["/", "Overview"],
    ["/engine.html", "Engine"],
    ["/pricing.html", "Pricing"],
    ["/security.html", "Security"],
    ["/docs.html", "Docs"], ["/api-docs.html", "API"]
  ];
  const FOOT = [
    ["Product", [["/", "Overview"], ["/engine.html", "The engine"],
      ["/pricing.html", "Pricing"], ["/app.html", "Workspace"]]],
    ["Account", [["/login.html", "Sign in"], ["/account.html", "Dashboard"], ["/history.html", "History"],
      ["/docs.html", "Documentation"], ["/changelog.html", "Changelog"]]],
    ["Legal", [["/security.html", "Security"], ["/privacy.html", "Privacy"], ["/terms.html", "Terms"],
      ["/dpa.html", "Data processing"], ["/subprocessors.html", "Subprocessors"],
      ["/acceptable-use.html", "Acceptable use"], ["/dmca.html", "Copyright"]]],
    ["Use cases", [["/compare.html", "vs Opus Clip"], ["/clip-twitch-vods.html", "Clip Twitch VODs"],
      ["/clip-youtube-videos.html", "Clip YouTube"], ["/clip-kick-streams.html", "Clip Kick"]]],
  ];

  // #53 Fånga ?ref= på VILKEN sida som helst och spara den. Besökaren klickar
  // sällan "skapa konto" i samma andetag som de klickar vännens länk — utan detta
  // tappas värvningen tyst mellan förstasidan och registreringen.
  (function captureRef() {
    try {
      const c = new URLSearchParams(location.search).get("ref");
      if (c && /^[a-z0-9]{4,32}$/i.test(c)) {
        localStorage.setItem("cf_ref", c.toLowerCase());
        // #98 Affiliatespårningens första länk: landningen räknas per kod, så
        // rev-share har verklig data den dag betalningen slås på. Ingen identitet —
        // koden är källan, steget är händelsen.
        if (window.cfTrack) window.cfTrack("ref_landing", c.toLowerCase());
      }
    } catch (e) { /* privatläge: värvningen tappas, allt annat fungerar */ }
  })();

  /**
   * #85 Funnel: fyra mätpunkter, noll personuppgifter.
   *
   * Vi mäter STEGET, inte personen — ingen id, ingen fingerprint, ingen ip sparas
   * med raden. Det räcker gott för den enda fråga mätningen finns för: var tappar
   * vi folk mellan förstasidan och första klippet?
   */
  window.cfTrack = function (step, source) {
    try {
      fetch("/api/track", { method: "POST", keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ step, source: source || null }) }).catch(() => {});
    } catch (e) { /* mätning får aldrig märkas av besökaren */ }
  };

  (function trackPage() {
    const p = location.pathname;
    const step = p === "/" || p.endsWith("index.html") ? "visit_home"
               : p.endsWith("app.html") ? "visit_workspace"
               : p.endsWith("login.html") ? "visit_signup"
               : p.endsWith("pricing.html") ? "visit_pricing" : null;
    if (step) window.cfTrack(step, document.referrer ? "referred" : "direct");
  })();

  function cookieNote() {
    try {
      if (localStorage.getItem("cf_cookie_ok")) return;
    } catch (e) { return; }
    const bar = document.createElement("div");
    bar.className = "cfcookie";
    bar.innerHTML = '<span>We use one essential cookie to keep you signed in — no tracking, ' +
      'no ads. <a href="/privacy.html">Privacy</a>.</span>' +
      '<button type="button">Got it</button>';
    bar.querySelector("button").addEventListener("click", () => {
      try { localStorage.setItem("cf_cookie_ok", "1"); } catch (e) {}
      bar.remove();
    });
    document.body.appendChild(bar);
  }

  function mount() {
    cookieNote();
    const here = location.pathname.replace(/index\.html$/, "");

    // header
    const hd = document.querySelector("header.cf");
    if (hd && !hd.dataset.built) {
      hd.dataset.built = "1";
      hd.innerHTML = '<div class="w in">' +
        '<a class="mark" href="/">'
        + '<svg class="em" viewBox="0 0 100 100" aria-hidden="true">'
        + '<g fill="none" stroke-linecap="round" stroke-width="13.2">'
        + '<path d="M25.5 27.2 L50 74.2" stroke="#e9edf0"/>'
        + '<path d="M50 74.2 L74.5 27.2" stroke="#d9a531"/></g></svg>'
        + 'ViggeClips</a><nav>' +
        NAV.map(([h, t]) => `<a href="${h}"${h.replace(/index\.html$/, "") === here ? ' aria-current="page"' : ""}>${t}</a>`).join("") +
        '</nav>' +
        '<div class="navgrp">' +
        '<a class="b1 sm" href="/app.html">Create new video</a>' +
        '<a class="b2 sm" href="/history.html">Edited videos</a>' +
        '<a class="b2 sm" id="navAuth" href="/login.html">Sign in</a>' +
        '</div></div>';
    }

    // Auth-swappen bor HÄR, hos den som äger navigationen — den låg i live.js, och
    // startsidan laddar inte live.js, så inloggade möttes av "Sign in" på exakt den
    // sida de landar på först. Navigationen ska aldrig bero på en annan fils närvaro.
    (async () => {
      const el = document.getElementById("navAuth");
      if (!el) return;
      try {
        const r = await fetch("/api/auth/me", { credentials: "same-origin" });
        if (!r.ok) return;                       // utloggad: "Sign in" är sanningen
        const me = await r.json();
        if (me && me.email) {
          el.textContent = "Account";
          el.setAttribute("href", "/account.html");
          el.title = me.email;
          // Footern också: en inloggad kund ska aldrig se "Sign in" någonstans.
          document.querySelectorAll('footer.cf a[href="/login.html"]').forEach((a) => {
            a.textContent = "Sign out";
            a.setAttribute("href", "#");
            a.addEventListener("click", async (e) => {
              e.preventDefault();
              await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
              location.href = "/";
            });
          });
        }
      } catch { /* statiskt läge: lämna orört */ }
    })();

    // footer
    const ft = document.querySelector("footer.cf");
    if (ft && !ft.dataset.built) {
      ft.dataset.built = "1";
      ft.innerHTML = '<div class="w in">' +
        FOOT.map(([title, links]) =>
          `<div class="col"><span class="lbl">${title}</span>` +
          links.map(([h, t]) => `<a href="${h}">${t}</a>`).join("") + "</div>").join("") +
        '<div class="end"><span>© 2026 ViggeClips</span>' +
        '<span>Built in Sweden</span>' +
        '<span>Clip engine v5 · measured, not guessed</span></div></div>';
    }

    // sticky header state
    if (hd) {
      const on = () => hd.classList.toggle("on", scrollY > 20);
      on(); addEventListener("scroll", on, { passive: true });
    }

    // scroll reveals
    const els = document.querySelectorAll(".rv");
    if (els.length) {
      const io = new IntersectionObserver(es => es.forEach((e, i) => {
        if (e.isIntersecting) {
          setTimeout(() => e.target.classList.add("on"), i * 55);
          io.unobserve(e.target);
        }
      }), { threshold: .1, rootMargin: "0px 0px -6% 0px" });
      els.forEach(el => io.observe(el));
    }
  }

  // Ambient FX layer (2026-08-17): dust, light leaks, progress line, section glow.
  // Loaded here so every page has it and no page can forget it; fx.js itself
  // stands down under prefers-reduced-motion and when the tab is hidden.
  const FXV = (function () { try { const me = document.querySelector('script[src*="cf.js"]'); const m = /v=(\d+)/.exec(me ? me.getAttribute("src") : ""); return m ? m[1] : "202608170200"; } catch { return "202608170200"; } })();
  function fxLoad() {
    if (document.getElementById("fxjs")) return;
    const s = document.createElement("script"); s.id = "fxjs"; s.defer = true; s.src = "/fx.js?v=" + FXV;
    document.head.appendChild(s);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { mount(); fxLoad(); });
  } else { mount(); fxLoad(); }
})();
