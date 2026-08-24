// ============================================================================
//  SCALELIST UNIVERSE — Scroll FX Layer (DELUXE)
//  ─────────────────────────────────────────────────────────────────────────
//  ★ Parallax star field (3 depth layers + twinkle + glow)
//  ★ Aurora curtains (5 drifting colored ribbons)
//  ★ Warp streaks on fast scroll
//  ★ Hue-shifting cosmic void
//  ★ Section ambient glow + per-section character theming
//  ★ Character-tinted bg on hover
//  ★ Scroll progress bar (rainbow character zones)
//  ★ Comet showers (rare shooting stars)
//  ★ Constellation lines (connect near stars)
//  ★ Mouse parallax (bg tilts with mouse)
//  ★ Click ripples (character-colored expanding rings)
//  ★ Section nav dots (right-side jump bar)
//  ★ Idle bloom (stars cluster after inactivity)
//  ★ Lightning flashes (rare, dramatic)
//  ★ Velocity blur (subtle on fast scroll)
//  ★ KONAMI code easter egg (rainbow chaos mode)
//  ★ Floating character runes (drift up rarely)
//  Aurora cursor + existing #particles untouched.
// ============================================================================
(function () {
  'use strict';

  // ─── Low-end / reduced-motion bail-out ───────────────────────────────────
  // The base hub already ships #particles + #tracer + scenery + Ferdinand for
  // the aura. This "deluxe" layer (173 stars, O(n²) constellations, comets,
  // lightning) is the heaviest. On weak phones or when the user asks for less
  // motion, skip it entirely so the site stays smooth on the worst devices —
  // exactly the audience the Scalelist Universe is built to reach for free.
  var _reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var _weak = (navigator.deviceMemory && navigator.deviceMemory < 4)
           || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
           || (Math.min(window.innerWidth, window.innerHeight) < 600);
  if (_reduced || _weak) return;

  // Pause the whole layer when the tab is hidden (battery on weak phones).
  var _hidden = false;
  document.addEventListener('visibilitychange', function () { _hidden = document.hidden; });

  const CHAR_COLORS = ['#00ff88','#ff3366','#9933ff','#ffaa00','#00aaff'];
  const STAR_COLORS = ['#ffffff','#c9a84c','#00ff88','#00aaff','#ff3366','#9933ff','#ffaa00'];
  let chaosMode = false; // Konami unlock

  // ─── Layer factory ───────────────────────────────────────────────────────
  function mkLayer(id, z, classes='') {
    let c = document.getElementById(id);
    if (c) return c;
    c = document.createElement('canvas');
    c.id = id;
    c.className = classes;
    c.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;z-index:${z};pointer-events:none`;
    document.body.insertBefore(c, document.body.firstChild);
    return c;
  }

  // Hue-shifting void (z = -3)
  const voidLayer = document.createElement('div');
  voidLayer.id = 'sfx-void';
  voidLayer.style.cssText = `
    position:fixed;inset:0;z-index:-3;pointer-events:none;
    background:
      radial-gradient(ellipse at 20% 0%, rgba(0,255,136,0.06) 0%, transparent 45%),
      radial-gradient(ellipse at 80% 30%, rgba(153,51,255,0.06) 0%, transparent 45%),
      radial-gradient(ellipse at 30% 70%, rgba(255,51,102,0.05) 0%, transparent 45%),
      radial-gradient(ellipse at 70% 100%, rgba(0,170,255,0.05) 0%, transparent 45%),
      radial-gradient(ellipse at 50% 50%, rgba(255,170,0,0.04) 0%, transparent 50%),
      #0a0a0f;
    transition: filter 0.6s ease, transform 0.4s ease, box-shadow 0.5s;
    will-change: filter, transform;
  `;
  document.body.appendChild(voidLayer);

  // Canvases
  const cStars   = mkLayer('sfx-stars',  -2);
  const cAurora  = mkLayer('sfx-aurora', -1);
  const cComets  = mkLayer('sfx-comets', -1);
  const cWarp    = mkLayer('sfx-warp',   -1);
  const cFx      = mkLayer('sfx-fx',     1); // ripples / lightning OVERLAY (above content but below cards' clickable z)
  cFx.style.zIndex = '9997'; // just below tracer (9999) and cursor-dot

  const ctxS = cStars.getContext('2d');
  const ctxA = cAurora.getContext('2d');
  const ctxC = cComets.getContext('2d');
  const ctxW = cWarp.getContext('2d');
  const ctxFx = cFx.getContext('2d');

  // ─── Scroll progress bar (top, rainbow character zones) ──────────────────
  const progBar = document.createElement('div');
  progBar.id = 'sfx-progress';
  progBar.style.cssText = `
    position:fixed;top:0;left:0;right:0;height:3px;z-index:10000;pointer-events:none;
    background:linear-gradient(90deg, #00ff88 0%, #ff3366 25%, #9933ff 50%, #ffaa00 75%, #00aaff 100%);
    transform-origin:left center;transform:scaleX(0);
    transition:transform 0.1s linear;
    box-shadow:0 0 12px rgba(255,255,255,0.4);
  `;
  document.body.appendChild(progBar);

  // ─── Section nav dots (right-side jump bar) ──────────────────────────────
  const navDots = document.createElement('div');
  navDots.id = 'sfx-nav';
  navDots.style.cssText = `
    position:fixed;right:18px;top:50%;transform:translateY(-50%);z-index:9998;
    display:flex;flex-direction:column;gap:14px;pointer-events:auto;
  `;
  document.body.appendChild(navDots);

  let W, H;
  function resize() {
    W = innerWidth; H = innerHeight;
    [cStars, cAurora, cComets, cWarp, cFx].forEach(c => { c.width = W; c.height = H; });
  }
  resize();
  addEventListener('resize', resize);

  // ─── Parallax stars + constellations ─────────────────────────────────────
  const layers = [
    { count: 90,  speed: 0.1, size: [0.4, 1.2], alpha: 0.32 },
    { count: 55,  speed: 0.3, size: [0.7, 1.7], alpha: 0.55 },
    { count: 28,  speed: 0.8, size: [1.2, 2.6], alpha: 0.88 }
  ];
  layers.forEach(layer => {
    layer.stars = Array.from({ length: layer.count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H * 3,
      r: layer.size[0] + Math.random() * (layer.size[1] - layer.size[0]),
      c: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      tw: Math.random() * Math.PI * 2
    }));
  });

  // ─── Aurora curtains ────────────────────────────────────────────────────
  const curtains = [
    { hue: 145, amp: 80,  speed: 0.0006, phase: 0,   y: 0.25, opacity: 0.18 },
    { hue: 280, amp: 120, speed: 0.0004, phase: 1.2, y: 0.55, opacity: 0.15 },
    { hue: 340, amp: 60,  speed: 0.0008, phase: 2.4, y: 0.75, opacity: 0.18 },
    { hue: 35,  amp: 100, speed: 0.0005, phase: 3.6, y: 0.4,  opacity: 0.13 },
    { hue: 200, amp: 90,  speed: 0.0007, phase: 4.8, y: 0.9,  opacity: 0.16 }
  ];

  // ─── Comet showers ───────────────────────────────────────────────────────
  const comets = [];
  function spawnComet(force) {
    comets.push({
      x: Math.random() * W * 1.2 - W * 0.1,
      y: Math.random() * H * 0.5,
      vx: 6 + Math.random() * 6,
      vy: 2 + Math.random() * 4,
      len: 60 + Math.random() * 80,
      life: 1,
      c: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)]
    });
  }
  setInterval(() => { if (Math.random() < (chaosMode ? 0.9 : 0.18)) spawnComet(); }, 2500);

  // ─── Lightning flashes (rare drama) ──────────────────────────────────────
  let lightningTimer = 0;
  function maybeLightning(t) {
    if (t < lightningTimer) return 0;
    lightningTimer = t + 25000 + Math.random() * 35000;
    return 1;
  }
  let lightningFlash = 0;

  // ─── Warp streaks + scroll velocity ──────────────────────────────────────
  let lastScrollY = scrollY;
  let scrollVel = 0;
  const warpStreaks = [];

  // ─── Click ripples ───────────────────────────────────────────────────────
  const ripples = [];
  document.addEventListener('click', e => {
    let color = '#c9a84c';
    const card = e.target.closest('.char-card[data-color]');
    if (card) color = card.dataset.color;
    ripples.push({ x: e.clientX, y: e.clientY, r: 0, life: 1, c: color });
    ripples.push({ x: e.clientX, y: e.clientY, r: 0, life: 1, c: color, delay: 0.2 });
  });

  // ─── Floating runes (rare) ───────────────────────────────────────────────
  const RUNES = ['ᚠ','ᚱ','ᚹ','ᛉ','ᛏ','ᛞ','ᛟ','ᛗ','᛫','◊','✦','✧','⟁','⟆','◈'];
  const runes = [];
  setInterval(() => {
    if (runes.length > 6) return;
    runes.push({
      x: Math.random() * W,
      y: H + 30,
      vy: -0.4 - Math.random() * 0.6,
      glyph: RUNES[Math.floor(Math.random() * RUNES.length)],
      c: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      size: 12 + Math.random() * 24,
      life: 1,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.01
    });
  }, 3500);

  // ─── Mouse parallax (bg tilts with mouse) ────────────────────────────────
  let mx = 0, my = 0, tmx = 0, tmy = 0;
  addEventListener('mousemove', e => {
    tmx = (e.clientX / W - 0.5) * 2;
    tmy = (e.clientY / H - 0.5) * 2;
  });

  // ─── Idle bloom ──────────────────────────────────────────────────────────
  let lastActivity = performance.now();
  let bloom = 0; // 0..1 strength
  function bumpActivity() { lastActivity = performance.now(); }
  ['mousemove','scroll','keydown','touchstart','click'].forEach(ev => addEventListener(ev, bumpActivity, { passive: true }));

  // ─── Scroll listener ─────────────────────────────────────────────────────
  function onScroll() {
    const dy = scrollY - lastScrollY;
    scrollVel = scrollVel * 0.7 + dy * 0.3;
    lastScrollY = scrollY;
    const absV = Math.abs(scrollVel);
    if (absV > 6) {
      const n = Math.min(8, Math.floor(absV / 4));
      for (let i = 0; i < n; i++) {
        warpStreaks.push({
          x: Math.random() * W, y: Math.random() * H,
          len: 8 + Math.random() * 30 + absV * 0.8,
          dir: Math.sign(scrollVel),
          life: 1,
          c: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)]
        });
      }
    }
    // Progress bar + void hue
    const docHeight = Math.max(1, document.body.scrollHeight - innerHeight);
    const progress = Math.min(1, Math.max(0, scrollY / docHeight));
    progBar.style.transform = `scaleX(${progress})`;
    voidLayer.style.filter = `hue-rotate(${progress * 60}deg) saturate(${1 + progress * 0.3}) blur(${Math.min(1.5, absV * 0.04)}px)`;
  }
  addEventListener('scroll', onScroll, { passive: true });

  // ─── Konami code easter egg → Chaos Mode ─────────────────────────────────
  const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let kIdx = 0;
  addEventListener('keydown', e => {
    if (e.key === KONAMI[kIdx]) {
      kIdx++;
      if (kIdx === KONAMI.length) {
        chaosMode = !chaosMode;
        document.documentElement.classList.toggle('sfx-chaos', chaosMode);
        if (chaosMode) {
          // confetti-style rain of comets
          for (let i = 0; i < 30; i++) setTimeout(spawnComet, i * 60);
        }
        kIdx = 0;
      }
    } else {
      kIdx = (e.key === KONAMI[0]) ? 1 : 0;
    }
  });

  // ─── Per-section character theming + section nav dots ───────────────────
  const sectionMap = []; // {el, color, glow, dot}
  function sectionColorFromEl(sec) {
    // Inspect first .char-card or [data-color] descendant
    const c = sec.querySelector('[data-color]');
    if (c) return c.dataset.color;
    // hub.html sections: hero, characters, portals — use defaults
    if (sec.id === 'characters') return '#00ff88';
    if (sec.classList.contains('hero')) return '#c9a84c';
    return '#9933ff';
  }
  function ensureSectionGlow() {
    document.querySelectorAll('section, .section').forEach((sec, idx) => {
      if (sec.querySelector(':scope > .sfx-section-glow')) return;
      const color = sectionColorFromEl(sec);
      const glow = document.createElement('div');
      glow.className = 'sfx-section-glow';
      glow.style.cssText = `
        position:absolute;inset:-60px -10% -60px -10%;
        background:radial-gradient(ellipse at 50% 50%, ${color}1f 0%, transparent 70%);
        pointer-events:none;z-index:-1;opacity:0;transition:opacity 0.8s ease;
        filter:blur(8px);
      `;
      if (getComputedStyle(sec).position === 'static') sec.style.position = 'relative';
      sec.insertBefore(glow, sec.firstChild);

      // Section nav dot
      const dot = document.createElement('a');
      dot.href = sec.id ? '#' + sec.id : '#';
      dot.title = sec.id || ('Section ' + (idx + 1));
      dot.style.cssText = `
        width:10px;height:10px;border-radius:50%;background:transparent;
        border:2px solid ${color}88;box-shadow:0 0 8px ${color}44;
        transition:all 0.3s;cursor:pointer;display:block;
      `;
      dot.addEventListener('mouseenter', () => { dot.style.transform = 'scale(1.6)'; dot.style.background = color; });
      dot.addEventListener('mouseleave', () => { dot.style.transform = 'scale(1)'; if (!dot.classList.contains('sfx-active')) dot.style.background = 'transparent'; });
      dot.addEventListener('click', e => { e.preventDefault(); sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      navDots.appendChild(dot);

      sectionMap.push({ el: sec, color, glow, dot });
    });

    const sectionObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        const m = sectionMap.find(s => s.el === e.target);
        if (!m) return;
        if (e.isIntersecting && e.intersectionRatio > 0.25) {
          m.glow.style.opacity = '1';
          m.dot.classList.add('sfx-active');
          m.dot.style.background = m.color;
          m.dot.style.transform = 'scale(1.4)';
          // Lean the void toward this section's color
          voidLayer.style.boxShadow = `inset 0 0 300px ${m.color}1a`;
          document.documentElement.style.setProperty('--sfx-section-color', m.color);
        } else {
          m.glow.style.opacity = '0';
          m.dot.classList.remove('sfx-active');
          m.dot.style.background = 'transparent';
          m.dot.style.transform = 'scale(1)';
        }
      });
    }, { threshold: [0, 0.25, 0.5] });
    sectionMap.forEach(m => sectionObs.observe(m.el));
  }

  // ─── Char card hover tint ────────────────────────────────────────────────
  function wireCharTints() {
    document.querySelectorAll('.char-card[data-color]').forEach(card => {
      card.addEventListener('mouseenter', () => {
        const c = card.dataset.color || '#c9a84c';
        document.documentElement.style.setProperty('--sfx-glow', c + '22');
        voidLayer.style.boxShadow = `inset 0 0 250px ${c}33`;
      });
      card.addEventListener('mouseleave', () => {
        const sec = document.documentElement.style.getPropertyValue('--sfx-section-color') || '#c9a84c';
        voidLayer.style.boxShadow = `inset 0 0 300px ${sec.trim()}1a`;
      });
    });
  }

  // ─── Main render loop ───────────────────────────────────────────────────
  let t0 = performance.now();
  function draw(t) {
    if (_hidden) { requestAnimationFrame(draw); return; }
    const dt = Math.min(3, (t - t0) / 16.67);
    t0 = t;
    const sy = scrollY;

    // Smooth mouse parallax
    mx += (tmx - mx) * 0.05;
    my += (tmy - my) * 0.05;
    voidLayer.style.transform = `translate(${mx * -8}px, ${my * -8}px)`;

    // Idle bloom progression
    const idleSec = (t - lastActivity) / 1000;
    const targetBloom = idleSec > 6 ? Math.min(1, (idleSec - 6) / 4) : 0;
    bloom += (targetBloom - bloom) * 0.05;

    // ── STARS + CONSTELLATION LINES ──────────────────────────────────────
    ctxS.clearRect(0, 0, W, H);
    const visibleNear = []; // for constellation lines on nearest layer
    for (const layer of layers) {
      for (const s of layer.stars) {
        const py = (s.y - sy * layer.speed) % (H * 3);
        const drawY = py < 0 ? py + H * 3 : py;
        const drawX = s.x + mx * 6 * layer.speed;
        if (drawY > H + 5) continue;
        s.tw += 0.02 + layer.speed * 0.05;
        const tw = 0.7 + Math.sin(s.tw) * 0.3;
        const a = layer.alpha * tw + bloom * 0.4;
        ctxS.globalAlpha = Math.min(1, a);
        ctxS.fillStyle = chaosMode ? `hsl(${(t/10 + s.x) % 360},100%,60%)` : s.c;
        ctxS.beginPath();
        ctxS.arc(drawX, drawY, s.r * (1 + bloom * 0.5), 0, Math.PI * 2);
        ctxS.fill();
        if (layer.speed > 0.5) {
          ctxS.globalAlpha = a * 0.3;
          ctxS.beginPath();
          ctxS.arc(drawX, drawY, s.r * (3 + bloom * 2), 0, Math.PI * 2);
          ctxS.fill();
          visibleNear.push({ x: drawX, y: drawY, c: s.c });
        }
      }
    }
    // Constellation lines (only nearest layer, only short distances)
    ctxS.globalAlpha = 0.18 + bloom * 0.4;
    ctxS.lineWidth = 0.5;
    for (let i = 0; i < visibleNear.length; i++) {
      for (let j = i + 1; j < visibleNear.length; j++) {
        const a = visibleNear[i], b = visibleNear[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx*dx + dy*dy;
        if (d2 < 22000) {
          const al = (1 - Math.sqrt(d2)/150) * 0.6;
          ctxS.strokeStyle = `rgba(255,255,255,${al * (0.3 + bloom * 0.5)})`;
          ctxS.beginPath();
          ctxS.moveTo(a.x, a.y);
          ctxS.lineTo(b.x, b.y);
          ctxS.stroke();
        }
      }
    }
    ctxS.globalAlpha = 1;

    // ── AURORA CURTAINS ──────────────────────────────────────────────────
    ctxA.clearRect(0, 0, W, H);
    for (const c of curtains) {
      c.phase += c.speed * dt * 16.67 * (chaosMode ? 4 : 1);
      const grad = ctxA.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, `hsla(${c.hue}, 100%, 55%, 0)`);
      grad.addColorStop(0.5, `hsla(${c.hue}, 100%, 55%, ${c.opacity + bloom * 0.1})`);
      grad.addColorStop(1, `hsla(${c.hue}, 100%, 55%, 0)`);
      ctxA.fillStyle = grad;
      ctxA.beginPath();
      const baseY = H * c.y - sy * 0.15 + my * 12;
      ctxA.moveTo(0, baseY);
      for (let x = 0; x <= W; x += 12) {
        const y = baseY + Math.sin(x * 0.005 + c.phase) * c.amp
                       + Math.cos(x * 0.012 + c.phase * 1.6) * c.amp * 0.4;
        ctxA.lineTo(x, y);
      }
      ctxA.lineTo(W, baseY + 200);
      ctxA.lineTo(0, baseY + 200);
      ctxA.closePath();
      ctxA.fill();
    }

    // ── COMETS ──────────────────────────────────────────────────────────
    ctxC.clearRect(0, 0, W, H);
    for (let i = comets.length - 1; i >= 0; i--) {
      const c = comets[i];
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.life -= 0.005;
      if (c.life <= 0 || c.x > W + 100 || c.y > H + 100) { comets.splice(i, 1); continue; }
      const tailX = c.x - c.vx * c.len * 0.15;
      const tailY = c.y - c.vy * c.len * 0.15;
      const grad = ctxC.createLinearGradient(c.x, c.y, tailX, tailY);
      grad.addColorStop(0, c.c);
      grad.addColorStop(1, 'transparent');
      ctxC.strokeStyle = grad;
      ctxC.lineWidth = 2;
      ctxC.lineCap = 'round';
      ctxC.globalAlpha = c.life;
      ctxC.beginPath();
      ctxC.moveTo(c.x, c.y);
      ctxC.lineTo(tailX, tailY);
      ctxC.stroke();
      // Head glow
      ctxC.fillStyle = c.c;
      ctxC.shadowColor = c.c;
      ctxC.shadowBlur = 14;
      ctxC.beginPath();
      ctxC.arc(c.x, c.y, 1.8, 0, Math.PI * 2);
      ctxC.fill();
      ctxC.shadowBlur = 0;
    }
    // Floating runes
    for (let i = runes.length - 1; i >= 0; i--) {
      const r = runes[i];
      r.y += r.vy * dt;
      r.rot += r.vRot;
      r.life -= 0.0035;
      if (r.life <= 0 || r.y < -50) { runes.splice(i, 1); continue; }
      ctxC.save();
      ctxC.translate(r.x, r.y);
      ctxC.rotate(r.rot);
      ctxC.globalAlpha = r.life * 0.55;
      ctxC.fillStyle = r.c;
      ctxC.font = `${r.size}px serif`;
      ctxC.textAlign = 'center';
      ctxC.textBaseline = 'middle';
      ctxC.shadowColor = r.c;
      ctxC.shadowBlur = 8;
      ctxC.fillText(r.glyph, 0, 0);
      ctxC.restore();
    }
    ctxC.shadowBlur = 0;
    ctxC.globalAlpha = 1;

    // ── WARP STREAKS ────────────────────────────────────────────────────
    ctxW.clearRect(0, 0, W, H);
    for (let i = warpStreaks.length - 1; i >= 0; i--) {
      const s = warpStreaks[i];
      s.y += s.dir * 6 * dt;
      s.life -= 0.04 * dt;
      if (s.life <= 0) { warpStreaks.splice(i, 1); continue; }
      ctxW.globalAlpha = s.life * 0.7;
      ctxW.strokeStyle = s.c;
      ctxW.lineWidth = 1.5;
      ctxW.beginPath();
      ctxW.moveTo(s.x, s.y);
      ctxW.lineTo(s.x, s.y + s.len * s.dir);
      ctxW.stroke();
    }
    ctxW.globalAlpha = 1;
    scrollVel *= 0.9;

    // ── FX OVERLAY: lightning + click ripples ────────────────────────────
    ctxFx.clearRect(0, 0, W, H);
    if (lightningFlash > 0) {
      ctxFx.fillStyle = `rgba(200,220,255,${lightningFlash * 0.2})`;
      ctxFx.fillRect(0, 0, W, H);
      lightningFlash *= 0.7;
    }
    const trig = maybeLightning(t);
    if (trig) lightningFlash = 1;
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      if (r.delay > 0) { r.delay -= 0.016; continue; }
      r.r += 6 * dt;
      r.life -= 0.025 * dt;
      if (r.life <= 0) { ripples.splice(i, 1); continue; }
      ctxFx.strokeStyle = r.c;
      ctxFx.globalAlpha = r.life * 0.7;
      ctxFx.lineWidth = 2;
      ctxFx.beginPath();
      ctxFx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctxFx.stroke();
    }
    ctxFx.globalAlpha = 1;

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  // ─── Init after DOM ready ────────────────────────────────────────────────
  function init() {
    ensureSectionGlow();
    wireCharTints();

    // 3D card tilt — subtle perspective on hover
    document.querySelectorAll('.char-card, .portal-card').forEach(card => {
      let raf = null;
      card.style.transformStyle = 'preserve-3d';
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          // Preserve any existing CSS hover transforms from base styles by appending perspective
          card.style.setProperty('--sfx-rotX', (-py * 8) + 'deg');
          card.style.setProperty('--sfx-rotY', (px * 8) + 'deg');
          card.style.transition = 'transform 0.05s linear';
          card.style.transform = `perspective(900px) rotateX(${-py * 8}deg) rotateY(${px * 8}deg) translateY(-8px) scale(1.03)`;
        });
      });
      card.addEventListener('mouseleave', () => {
        card.style.transition = 'transform 0.4s ease';
        card.style.transform = '';
      });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ─── Inject helper styles ────────────────────────────────────────────────
  const styles = document.createElement('style');
  styles.textContent = `
    .sfx-chaos #sfx-stars, .sfx-chaos #sfx-aurora { filter: hue-rotate(0deg) saturate(2); animation: sfxRainbow 4s linear infinite; }
    @keyframes sfxRainbow { 0%{filter:hue-rotate(0deg) saturate(2)} 100%{filter:hue-rotate(360deg) saturate(2)} }
    #sfx-progress { will-change: transform; }
    @media (prefers-reduced-motion: reduce) {
      #sfx-stars, #sfx-aurora, #sfx-comets, #sfx-warp, #sfx-fx { display: none !important; }
    }
  `;
  document.head.appendChild(styles);
})();
