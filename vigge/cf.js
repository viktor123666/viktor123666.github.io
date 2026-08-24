/* ViggeClips — shared behaviour: header state, scroll reveals, nav/footer injection.
   Every page loads this. Page-specific logic stays in the page. */
(function () {
  "use strict";

  // Synligt = det besökaren KOMMER hit för. Allt annat i rullgardinen: sex jämnstora
  // länkar konkurrerade med varandra och gjorde ingen av dem tydlig.
  const NAV = [
    ["/", "Overview"],
    ["/pricing.html", "Pricing"],
  ];
  // Fördjupningen. "How it works" i stället för "Engine" — det senare hette något
  // bara vi förstod, och sidan är den som faktiskt svarar på besökarens fråga.
  // Handlingsknapparna. Samma form som navlänkarna — skillnaden ska vara VAR man är,
  // inte vilken knapp någon en gång bestämde var viktigast.
  const ACT = [
    ["/app.html", "Create new video", null],
    ["/history.html", "Edited videos", null],
    ["/login.html", "Sign in", "navAuth"],
  ];
  const MORE = [
    ["/engine.html", "How it works"],
    ["/security.html", "Security"],
    ["/docs.html", "Guides"],
    ["/api-docs.html", "API"],
  ];
  const FOOT = [
    ["Product", [["/", "Overview"], ["/engine.html", "The engine"],
      ["/pricing.html", "Pricing"], ["/app.html", "Workspace"]]],
    ["Account", [["/login.html", "Sign in"], ["/account.html", "Dashboard"], ["/history.html", "History"]]],
    // Dokumentation och ändringslogg är PRODUKT, inte konto — de låg fel och gjorde
    // kontokolumnen till en skräplåda. Supportadressen hör hemma här, synlig: Stripe
    // kräver en supportväg på sajten, och en kund med en fråga ska inte behöva leta
    // i villkorstexten efter den.
    ["Support", [["/docs.html", "Documentation"], ["/changelog.html", "Changelog"],
      ["mailto:" + ["support", "vigge.pro"].join("@"), "Contact support"]]],
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
        // Rullgardinen: <details> i stället för eget JS. Den stänger sig själv på Esc,
        // fungerar med tangentbord och kräver ingen skriptbibliotek — en meny som
        // slutar fungera när ett skript fallerar är värre än ingen meny.
        '<details class="more"><summary tabindex="0">Documentation</summary><div class="mlist">' +
        MORE.map(([h, t]) => `<a href="${h}"${h === here ? ' aria-current="page"' : ""}>${t}</a>`).join("") +
        '</div></details>' +
        '</nav>' +
        '<div class="navgrp">' +
        // Alla tre bär samma kontur. Den som råkar vara sidan man står på får
        // aria-current, och CSS ger DEN fylld guld — en enda markering i headern.
        ACT.map(([h, t, id]) =>
          `<a class="b2 sm" href="${h}"${id ? ` id="${id}"` : ""}` +
          `${h === here ? ' aria-current="page"' : ""}>${t}</a>`).join("") +
        // Saldot. Tomt tills ett riktigt tal kommit — en platshållarsiffra i en
        // saldovisning är en lögn kunden fattar beslut på.
        '<a class="bal" id="navBal" href="/pricing.html" hidden></a>' +
        // Enkel utloggning. "Sign out everywhere" på kontosidan är en säkerhetsåtgärd
        // som dödar alla enheter — fel verktyg för "jag går härifrån nu".
        '<button class="signout" id="navOut" type="button" hidden ' +
        'title="Sign out on this device">Sign out</button>' +
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
          // href bytte efter att markeringen sattes — sätt om den, annars är
          // kontosidan den enda sida i headern som aldrig kan lysa.
          if (here === "/account.html") el.setAttribute("aria-current", "page");
          else el.removeAttribute("aria-current");
          el.title = me.email;
          paintBalance(me);
          const out = document.getElementById("navOut");
          if (out && !out.dataset.wired) {
            out.dataset.wired = "1";
            out.hidden = false;
            out.addEventListener("click", async () => {
              out.disabled = true;
              await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
              location.href = "/";
            });
          }
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
        // En rad, inte tre. Kontaktvägen flyttade upp till Support-kolumnen där den
        // hör hemma — adressen sätts fortfarande ihop i JS så skrapare inte hittar den
        // i HTML-källan.
        '<div class="end"><span>© 2026 ViggeClips by vigge.pro. All rights reserved.</span>'
        + '</div></div>';
    }

    // Rullgardinen öppnas på HOVER. Klick och tangentbord fungerar oförändrat —
    // <details> gör det av sig själv — så hover är ett tillägg, aldrig enda vägen in.
    // Vore det enda vägen hade menyn varit stängd för varje pekskärm.
    const dd = document.querySelector("header.cf details.more");
    if (dd) {
      let shut;
      const open = (on) => { clearTimeout(shut); if (on) dd.open = true;
                             else shut = setTimeout(() => { dd.open = false; }, 140); };
      dd.addEventListener("mouseenter", () => open(true));
      dd.addEventListener("mouseleave", () => open(false));
      // Utanför-klick och Esc: en meny som blir hängande öppen är sämre än ingen.
      document.addEventListener("click", (e) => {
        if (!dd.contains(e.target)) dd.open = false;
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") dd.open = false;
      });
    }

    // Saldot i headern, på varje sida. Klickbart: den som ser att tiden tar slut
    // ska vara ett klick från att fylla på, inte tvingas leta.
    function paintBalance(me) {
      const el = document.getElementById("navBal");
      if (!el || typeof me.minutes !== "number") return;
      const h = (m) => (m / 60 >= 10 ? Math.round(m / 60) : (m / 60).toFixed(1));
      const pro = me.plan === "pro";
      // Taket måste minst rymma saldot. Ett konto kan ha MER än periodens tilldelning
      // — kvarvarande gratistid vid uppgradering, en kompensation — och "102 of 100"
      // läser som ett räknefel även när båda talen är sanna.
      const total = Math.max(Number(me.minutes || 0),
                             Number(me.planMinutes || 0) + Number(me.topupMinutes || 0));
      el.hidden = false;
      el.classList.toggle("pro", pro);
      el.href = pro ? "/account.html" : "/pricing.html";
      el.innerHTML = '<i>' + (pro ? "PRO" : "FREE") + '</i>'
        + '<b>' + h(me.minutes) + '</b><s>/ ' + h(total) + ' h</s>';
      // Titeln bär det som inte får plats: när perioden vänder, och om den redan
      // är uppsagd. Ett uppsagt konto som ser normalt ut är en obehaglig överraskning.
      const when = me.periodEnd ? new Date(me.periodEnd).toLocaleDateString() : null;
      el.title = (pro ? "Pro" : "Free")
        + " — " + h(me.minutes) + " of " + h(total) + " hours left"
        + (when ? (me.cancelAtPeriodEnd
             ? "\nCancelled — Pro access continues until " + when
             : "\nRenews " + when) : "")
        + (pro ? "" : "\nClick to see Pro");
      if (me.cancelAtPeriodEnd) el.classList.add("ending");
    }

    // INFO-KNAPPARNA (2026-08-23). Varje <button class="infob" data-info="X">
    // visar/döljer #X. Kopplas HÄR så mönstret finns på alla sidor — poängrutan i
    // app.html hade sin egen kod, och nästa sida hade fått ännu en kopia.
    document.querySelectorAll("button.infob[data-info]").forEach((btn) => {
      const panel = document.getElementById(btn.dataset.info);
      if (!panel || btn.dataset.wired) return;
      btn.dataset.wired = "1";
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-controls", panel.id);
      btn.addEventListener("click", () => {
        const open = panel.hasAttribute("hidden");
        if (open) panel.removeAttribute("hidden"); else panel.setAttribute("hidden", "");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });

    // Står man på en sida som ligger INNE i rullgardinen ska menyn visa det — annars
    // finns ingen markering alls på fyra av sajtens sidor.
    const ddNow = document.querySelector("header.cf details.more");
    if (ddNow && ddNow.querySelector('.mlist a[aria-current]')) {
      ddNow.querySelector("summary").setAttribute("aria-current", "page");
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
