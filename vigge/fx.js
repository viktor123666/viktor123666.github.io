/* ViggeClips — ambient FX layer (2026-08-17).
 *
 * The scalelistuniverse.com/hub feel — depth, drift, light, motion that answers the
 * scroll — translated to vigge.pro: black glass, gold light, measured. Nothing here
 * competes with the product; it sits behind it. Everything degrades to still when
 * the visitor prefers reduced motion or the tab is hidden, and it costs one canvas.
 *
 *   · gold dust: 3 depth layers, parallax with scroll + a little with the mouse
 *   · light leaks: two slow gold/amber orbs + one cool one, breathing behind panels
 *   · scroll progress: 2 px gold line at the very top
 *   · velocity: fast scrolling stretches the dust into streaks, then it settles
 *   · section glow: the section in view gets a faint gold halo (CSS class fx-lit)
 *   · click ripple: a gold ring where you clicked — the hub's touch, quieter
 */
(function () {
  "use strict";
  if (window.__vcfx) return; window.__vcfx = true;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const GOLD = [217, 165, 49], GOLD2 = [240, 198, 94], COOL = [138, 180, 255], INK = [233, 237, 240];

  // ── light leaks (CSS, cheap, always on even in still mode — they just don't move)
  const leaks = document.createElement("div");
  leaks.id = "fx-leaks";
  leaks.setAttribute("aria-hidden", "true");
  leaks.innerHTML = '<i class="a"></i><i class="b"></i><i class="c"></i>';
  const css = document.createElement("style");
  css.textContent = `
    #fx-leaks{position:fixed;inset:0;z-index:-3;pointer-events:none;overflow:hidden}
    #fx-leaks i{position:absolute;border-radius:50%;filter:blur(70px);opacity:.55;will-change:transform}
    #fx-leaks .a{width:60vmax;height:60vmax;left:-18vmax;top:-22vmax;background:radial-gradient(circle,rgba(217,165,49,.16),rgba(217,165,49,0) 62%)}
    #fx-leaks .b{width:52vmax;height:52vmax;right:-20vmax;top:18vh;background:radial-gradient(circle,rgba(240,198,94,.11),rgba(240,198,94,0) 62%)}
    #fx-leaks .c{width:46vmax;height:46vmax;left:30vw;bottom:-26vmax;background:radial-gradient(circle,rgba(138,180,255,.07),rgba(138,180,255,0) 64%)}
    #fx-dust{position:fixed;inset:0;z-index:-2;pointer-events:none}
    #fx-prog{position:fixed;top:0;left:0;height:2px;width:0;z-index:70;pointer-events:none;
      background:linear-gradient(90deg,var(--gold,#d9a531),var(--gold2,#f0c65e));box-shadow:0 0 12px rgba(217,165,49,.55)}
    .fx-ripple{position:fixed;z-index:65;pointer-events:none;width:12px;height:12px;margin:-6px 0 0 -6px;
      border:1.5px solid rgba(240,198,94,.85);border-radius:50%;animation:fxrip .7s ease-out forwards}
    @keyframes fxrip{to{transform:scale(9);opacity:0}}
    section.fx-lit,.fx-lit{position:relative}
    section.fx-lit::before{content:"";position:absolute;inset:-6% 0;z-index:-1;pointer-events:none;
      background:radial-gradient(60% 50% at 50% 30%,rgba(217,165,49,.07),transparent 70%);opacity:0;
      animation:fxlit 1.4s ease-out forwards}
    @keyframes fxlit{to{opacity:1}}
    .rv{transition:opacity .8s cubic-bezier(.2,.7,.2,1),transform .8s cubic-bezier(.2,.7,.2,1)}
    @media (prefers-reduced-motion:reduce){#fx-leaks i{filter:blur(70px)}}
  `;
  document.head.appendChild(css);
  document.body.appendChild(leaks);

  // progress line
  const prog = document.createElement("div"); prog.id = "fx-prog"; document.body.appendChild(prog);
  const setProg = () => {
    const h = document.documentElement;
    const max = Math.max(1, h.scrollHeight - innerHeight);
    prog.style.width = Math.min(100, (h.scrollTop || document.body.scrollTop) / max * 100).toFixed(2) + "%";
  };
  addEventListener("scroll", setProg, { passive: true }); setProg();

  // section glow as sections come into view
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("fx-lit"); io.unobserve(e.target); }
    }), { threshold: 0.18 });
    document.querySelectorAll("section").forEach((s) => io.observe(s));
  }

  // click ripple — not on form fields
  addEventListener("pointerdown", (e) => {
    if (still || e.button !== 0) return;
    const t = e.target;
    if (t.closest && t.closest("input,textarea,select,video")) return;
    const r = document.createElement("i"); r.className = "fx-ripple";
    r.style.left = e.clientX + "px"; r.style.top = e.clientY + "px";
    document.body.appendChild(r); setTimeout(() => r.remove(), 750);
  }, { passive: true });

  if (still) return;                                   // dust + drift only with motion allowed

  // ── light leaks drift
  const li = leaks.querySelectorAll("i");
  let t0 = performance.now();
  // ── dust canvas
  const cv = document.createElement("canvas"); cv.id = "fx-dust"; document.body.appendChild(cv);
  const cx = cv.getContext("2d", { alpha: true });
  let W = 0, H = 0, dpr = 1, dust = [];
  const N = () => Math.min(170, Math.round((W * H) / 9000));
  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = N();
    while (dust.length < n) dust.push(mk(true));
    dust.length = n;
  }
  function mk(anywhere) {
    const layer = Math.random() < 0.55 ? 0 : Math.random() < 0.7 ? 1 : 2;   // 0 far … 2 near
    const col = Math.random() < 0.72 ? GOLD : Math.random() < 0.6 ? GOLD2 : Math.random() < 0.7 ? INK : COOL;
    return {
      x: Math.random() * W, y: anywhere ? Math.random() * H : (Math.random() < 0.5 ? -8 : H + 8),
      z: layer, r: [0.7, 1.1, 1.7][layer] * (0.7 + Math.random() * 0.8),
      vx: (Math.random() - 0.5) * [0.04, 0.08, 0.14][layer], vy: -[0.03, 0.06, 0.11][layer] * (0.6 + Math.random()),
      a: [0.22, 0.38, 0.6][layer] * (0.6 + Math.random() * 0.6), ph: Math.random() * Math.PI * 2,
      col,
    };
  }
  addEventListener("resize", resize); resize();

  let lastY = scrollY, vel = 0, mx = 0, my = 0, tmx = 0, tmy = 0, hidden = document.hidden;
  addEventListener("scroll", () => { const y = scrollY; vel = vel * 0.6 + (y - lastY) * 0.4; lastY = y; }, { passive: true });
  addEventListener("pointermove", (e) => { tmx = (e.clientX / W - 0.5); tmy = (e.clientY / H - 0.5); }, { passive: true });
  document.addEventListener("visibilitychange", () => { hidden = document.hidden; if (!hidden) requestAnimationFrame(frame); });

  function frame(now) {
    if (hidden) return;
    const dt = Math.min(48, now - t0) / 16.67; t0 = now;
    mx += (tmx - mx) * 0.04; my += (tmy - my) * 0.04;
    vel *= 0.86;
    const streak = Math.min(18, Math.abs(vel) * 0.35);          // velocity → streak length
    cx.clearRect(0, 0, W, H);
    for (const p of dust) {
      p.x += p.vx * dt; p.y += (p.vy - vel * [0.006, 0.014, 0.026][p.z]) * dt; p.ph += 0.02 * dt;
      if (p.y < -10) { p.y = H + 8; p.x = Math.random() * W; }
      if (p.y > H + 10) { p.y = -8; p.x = Math.random() * W; }
      if (p.x < -10) p.x = W + 8; if (p.x > W + 10) p.x = -8;
      const px = p.x + mx * [6, 14, 26][p.z], py = p.y + my * [4, 9, 16][p.z];
      const tw = 0.7 + 0.3 * Math.sin(p.ph);
      const a = p.a * tw;
      cx.beginPath();
      cx.fillStyle = `rgba(${p.col[0]},${p.col[1]},${p.col[2]},${a.toFixed(3)})`;
      if (streak > 1.5) {
        cx.strokeStyle = cx.fillStyle; cx.lineWidth = p.r * 1.4; cx.lineCap = "round";
        cx.moveTo(px, py); cx.lineTo(px, py + Math.sign(vel) * streak * [0.5, 0.8, 1.2][p.z]); cx.stroke();
      } else {
        cx.arc(px, py, p.r, 0, Math.PI * 2); cx.fill();
        if (p.z === 2 && tw > 0.95) {                              // near dust glints
          cx.beginPath(); cx.arc(px, py, p.r * 3.2, 0, Math.PI * 2);
          cx.fillStyle = `rgba(${p.col[0]},${p.col[1]},${p.col[2]},${(a * 0.18).toFixed(3)})`; cx.fill();
        }
      }
    }
    // leaks: slow breathing drift + scroll parallax
    const s = now / 1000, sy = scrollY;
    li[0].style.transform = `translate(${Math.sin(s * 0.11) * 40 + mx * -30}px, ${Math.cos(s * 0.09) * 30 - sy * 0.06}px)`;
    li[1].style.transform = `translate(${Math.cos(s * 0.08) * 50 + mx * 24}px, ${Math.sin(s * 0.13) * 36 - sy * 0.03}px)`;
    li[2].style.transform = `translate(${Math.sin(s * 0.07) * 60 + mx * 12}px, ${Math.cos(s * 0.1) * 26 - sy * 0.09}px)`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
