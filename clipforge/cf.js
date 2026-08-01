/* ClipForge — shared behaviour: header state, scroll reveals, nav/footer injection.
   Every page loads this. Page-specific logic stays in the page. */
(function () {
  "use strict";

  const NAV = [
    ["/clipforge/", "Overview"],
    ["/clipforge/engine.html", "Engine"],
    ["/clipforge/pricing.html", "Pricing"],
    ["/clipforge/security.html", "Security"],
    ["/clipforge/docs.html", "Docs"]
  ];
  const FOOT = [
    ["Product", [["/clipforge/", "Overview"], ["/clipforge/engine.html", "The engine"],
      ["/clipforge/pricing.html", "Pricing"], ["/clipforge/app.html", "Workspace"]]],
    ["Account", [["/clipforge/login.html", "Sign in"], ["/clipforge/account.html", "Dashboard"],
      ["/clipforge/docs.html", "Documentation"], ["/clipforge/changelog.html", "Changelog"]]],
    ["Legal", [["/clipforge/security.html", "Security"], ["/clipforge/privacy.html", "Privacy"], ["/clipforge/terms.html", "Terms"],
      ["/clipforge/dpa.html", "Data processing"]]],
    ["Universe", [["/", "Scalelist Universe"], ["/cosmos", "The Cosmos"]]]
  ];

  function mount() {
    const here = location.pathname.replace(/index\.html$/, "");

    // header
    const hd = document.querySelector("header.cf");
    if (hd && !hd.dataset.built) {
      hd.dataset.built = "1";
      hd.innerHTML = '<div class="w in">' +
        '<a class="mark" href="/clipforge/"><s></s>ClipForge</a><nav>' +
        NAV.map(([h, t]) => `<a href="${h}"${h.replace(/index\.html$/, "") === here ? ' aria-current="page"' : ""}>${t}</a>`).join("") +
        '</nav>' +
        (hd.dataset.cta === "app"
          ? '<a class="b2 sm" href="/clipforge/account.html">Dashboard</a>'
          : '<a class="b1 sm" href="/clipforge/app.html">Start free</a>') +
        '</div>';
    }

    // footer
    const ft = document.querySelector("footer.cf");
    if (ft && !ft.dataset.built) {
      ft.dataset.built = "1";
      ft.innerHTML = '<div class="w in">' +
        FOOT.map(([title, links]) =>
          `<div class="col"><span class="lbl">${title}</span>` +
          links.map(([h, t]) => `<a href="${h}">${t}</a>`).join("") + "</div>").join("") +
        '<div class="end"><span>© 2026 Scalelist Universe</span>' +
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else { mount(); }
})();
