/* ViggeClips — shared behaviour: header state, scroll reveals, nav/footer injection.
   Every page loads this. Page-specific logic stays in the page. */
(function () {
  "use strict";

  const NAV = [
    ["/", "Overview"],
    ["/engine.html", "Engine"],
    ["/pricing.html", "Pricing"],
    ["/security.html", "Security"],
    ["/docs.html", "Docs"]
  ];
  const FOOT = [
    ["Product", [["/", "Overview"], ["/engine.html", "The engine"],
      ["/pricing.html", "Pricing"], ["/app.html", "Workspace"]]],
    ["Account", [["/login.html", "Sign in"], ["/account.html", "Dashboard"], ["/history.html", "History"],
      ["/docs.html", "Documentation"], ["/changelog.html", "Changelog"]]],
    ["Legal", [["/security.html", "Security"], ["/privacy.html", "Privacy"], ["/terms.html", "Terms"],
      ["/dpa.html", "Data processing"]]],
    // (no external-universe column: the product stands alone)
  ];

  function mount() {
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
        '<a class="b1 sm" href="/app.html">Create new video</a> ' +
        '<a class="b2 sm" href="/history.html" style="margin-left:.5rem">History</a>' +
        // Sign in lives at the far right, where every site puts it. live.js swaps it
        // to "Account" once a session answers, so it never invites someone who is
        // already signed in to sign in again.
        '<a class="b2 sm" id="navAuth" href="/login.html" style="margin-left:.5rem">Sign in</a>' +
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else { mount(); }
})();
