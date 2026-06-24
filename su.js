/* ============================================================
   SCALELIST UNIVERSE — SHARED SHELL  (su.js)
   Include after su.css:  <script defer src="/su.js"></script>
   Auto-injects: fonts (Cinzel + Inter), a starfield background, the universe
   top-nav (interconnects every page) and the canonical footer. This is what
   makes 20 independently-built pages feel like ONE world. Don't rebuild these.
   ============================================================ */
(function () {
  "use strict";

  // ---- fonts (CSP allows fonts.googleapis.com / gstatic) ----
  if (!document.getElementById("su-fonts")) {
    var f = document.createElement("link");
    f.id = "su-fonts"; f.rel = "stylesheet";
    f.href = "https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Inter:wght@400;500;700&display=swap";
    document.head.appendChild(f);
  }

  // ---- universe map (the interconnection) ----
  var LINKS = [
    ["/begin", "Begin"], ["/cosmos", "Cosmos"], ["/gallery", "Gallery"],
    ["/manga", "Manga"], ["/lineage", "Lineage"], ["/wiki", "Wiki"],
    ["/timeline", "Timeline"], ["/hadom", "HADOM"], ["/empire", "Empire"],
    ["/rankings", "Rankings"]
  ];
  var here = (location.pathname.replace(/\/$/, "") || "/").toLowerCase();

  function build() {
    // ----- starfield (drawn once; no animation loop = zero ongoing CPU) -----
    if (!document.getElementById("su-stars")) {
      var c = document.createElement("canvas");
      c.id = "su-stars";
      document.body.appendChild(c);
      var ctx = c.getContext("2d");
      function draw() {
        var w = c.width = innerWidth, h = c.height = innerHeight;
        ctx.clearRect(0, 0, w, h);
        var n = Math.min(220, Math.floor(w * h / 9000));
        for (var i = 0; i < n; i++) {
          var x = Math.random() * w, y = Math.random() * h,
              r = Math.random() * 1.3 + 0.2, a = Math.random() * 0.6 + 0.15;
          // faint gold + white stars
          ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283);
          ctx.fillStyle = (Math.random() < 0.15 ? "rgba(201,168,76," : "rgba(230,235,255,") + a + ")";
          ctx.fill();
        }
        // a couple of soft nebula glows
        [["rgba(0,170,255,.05)", w*0.85, h*0.15], ["rgba(153,51,255,.045)", w*0.12, h*0.4]].forEach(function (g) {
          var grd = ctx.createRadialGradient(g[1], g[2], 0, g[1], g[2], Math.max(w,h)*0.35);
          grd.addColorStop(0, g[0]); grd.addColorStop(1, "transparent");
          ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
        });
      }
      draw();
      var t; addEventListener("resize", function () { clearTimeout(t); t = setTimeout(draw, 200); });
    }

    // ----- top nav -----
    if (!document.getElementById("su-nav")) {
      var navLinks = LINKS.map(function (l) {
        var active = (here === l[0]) ? " class=\"active\"" : "";
        return "<a href=\"" + l[0] + "\"" + active + ">" + l[1] + "</a>";
      }).join("");
      var nav = document.createElement("header");
      nav.id = "su-nav";
      nav.innerHTML =
        "<a class=\"su-logo\" href=\"/\">SCALELIST <b>UNIVERSE</b></a>" +
        "<nav>" + navLinks + "</nav>" +
        "<button class=\"su-burger\" aria-label=\"menu\">☰</button>";
      document.body.insertBefore(nav, document.body.firstChild);

      var mob = document.createElement("div");
      mob.id = "su-mobile";
      mob.innerHTML = LINKS.map(function (l) { return "<a href=\"" + l[0] + "\">" + l[1] + "</a>"; }).join("");
      document.body.insertBefore(mob, nav.nextSibling);
      nav.querySelector(".su-burger").addEventListener("click", function () { mob.classList.toggle("open"); });
    }

    // ----- footer -----
    if (!document.getElementById("su-footer")) {
      var foot = document.createElement("footer");
      foot.id = "su-footer";
      foot.innerHTML =
        "<div class=\"su-sig\">Yet we are part of something · HADOM Quoka ツ</div>" +
        "<div class=\"su-links\">" +
          "<a href=\"/begin\">Begin</a><a href=\"/cosmos\">Cosmos</a><a href=\"/manga\">Manga</a>" +
          "<a href=\"/lineage\">Lineage</a><a href=\"/wiki\">Wiki</a><a href=\"/pitch\">Pitch</a>" +
        "</div>" +
        "<small>Scalelist Universe — a world built with YWAPOS. © Vigolas.</small>";
      document.body.appendChild(foot);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
