/* =========================================================================
   CONVERGENCE ARENA — v0.1 "FRAGMENT: KOMPIS"
   Scalelist Universe · built by YWAPOS
   Canon: the HADOM heartbeat is the tick-rate of reality. Calm = precise.
   Fear = fast but wild. MINGUS freezes time within one blink.
   Characters flow from window.SU_DATA (generated from the registry).
   ========================================================================= */
"use strict";

/* ---------- helpers ---------- */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const ang = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);

/* ---------- canvas ---------- */
const cv = document.getElementById("cv");
const cx = cv.getContext("2d");
let W = 0, H = 0, DPR = 1, CXm = 0, CYm = 0, ARENA_R = 300;
function resize() {
  DPR = clamp(window.devicePixelRatio || 1, 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = W * DPR; cv.height = H * DPR;
  cv.style.width = W + "px"; cv.style.height = H + "px";
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  CXm = W / 2; CYm = H / 2;
  ARENA_R = Math.min(W, H) * 0.44;
}
window.addEventListener("resize", resize); resize();

/* ---------- data (registry-generated) ---------- */
const DATA = window.SU_DATA || { champions: [], lineage: [], total_souls: 0 };
const CHAMPS = DATA.champions;
let selected = CHAMPS.find(c => c.playable) || CHAMPS[0] || { key: "kompis", name: "Kompis", color: "#ffaa00", shortcut: "k" };

/* ---------- audio (pure WebAudio synth — zero assets) ---------- */
const AudioEngine = {
  ctx: null, master: null,
  muted: localStorage.getItem("su_arena_mute") === "1",
  ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.32;
        this.master.connect(this.ctx.destination);
      } catch (e) { /* silent world */ }
    }
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  },
  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem("su_arena_mute", this.muted ? "1" : "0");
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.32;
  },
  env(type, f0, f1, dur, vol = 0.5, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  },
  thump(intense) { // the HADOM heartbeat — the game's metronome
    this.env("sine", 58, 40, 0.16, intense ? 0.85 : 0.6);
    this.env("sine", 90, 55, 0.07, 0.18, 0.02);
  },
  zap() { this.env("square", 920, 240, 0.07, 0.22); },
  hurt() { this.env("sawtooth", 160, 60, 0.25, 0.5); },
  kill() { this.env("triangle", 660, 660, 0.09, 0.3); this.env("triangle", 990, 990, 0.12, 0.22, 0.05); },
  dashS() { this.env("sine", 300, 700, 0.09, 0.18); },
  ult() {
    [220, 277, 330, 440].forEach((f, i) =>
      this.env("sawtooth", f * 0.995, f, 1.6, 0.16, i * 0.05));
    this.env("sine", 1760, 880, 1.2, 0.1, 0.1);
  },
  death() { this.env("sawtooth", 110, 28, 1.4, 0.5); },
  wave() { this.env("triangle", 440, 880, 0.3, 0.2); }
};

/* ---------- input ---------- */
const keys = {};
let mouseX = 0, mouseY = 0, mouseDown = false;
const IS_TOUCH = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
window.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) e.preventDefault();
  Game.onKey(e.key.toLowerCase());
});
window.addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });
window.addEventListener("mousemove", e => { mouseX = e.clientX; mouseY = e.clientY; });
window.addEventListener("mousedown", e => { if (e.button === 0) { mouseDown = true; AudioEngine.ensure(); } });
window.addEventListener("mouseup", e => { if (e.button === 0) mouseDown = false; });

/* touch state */
const touch = { stickId: null, sx: 0, sy: 0, dx: 0, dy: 0, aimX: 0, aimY: 0, attacking: false };
const stickEl = document.getElementById("stick"), nubEl = document.getElementById("nub");
function touchSetup() {
  if (!IS_TOUCH) return;
  document.getElementById("touchUI").classList.remove("hidden");
  const ui = document.getElementById("touchUI");
  ui.style.pointerEvents = "none";
  window.addEventListener("touchstart", e => {
    AudioEngine.ensure();
    for (const t of e.changedTouches) {
      if (t.clientX < W * 0.45 && touch.stickId === null) {
        touch.stickId = t.identifier; touch.sx = t.clientX; touch.sy = t.clientY;
        stickEl.style.display = "block";
        stickEl.style.left = (t.clientX - 59) + "px"; stickEl.style.top = (t.clientY - 59) + "px";
      } else if (t.clientX >= W * 0.45) {
        touch.attacking = true; touch.aimX = t.clientX; touch.aimY = t.clientY;
      }
    }
  }, { passive: true });
  window.addEventListener("touchmove", e => {
    for (const t of e.changedTouches) {
      if (t.identifier === touch.stickId) {
        const dx = t.clientX - touch.sx, dy = t.clientY - touch.sy;
        const m = Math.hypot(dx, dy) || 1, c = Math.min(m, 48);
        touch.dx = (dx / m) * (c / 48); touch.dy = (dy / m) * (c / 48);
        nubEl.style.left = (36 + (dx / m) * c) + "px"; nubEl.style.top = (36 + (dy / m) * c) + "px";
      } else { touch.aimX = t.clientX; touch.aimY = t.clientY; }
    }
  }, { passive: true });
  window.addEventListener("touchend", e => {
    for (const t of e.changedTouches) {
      if (t.identifier === touch.stickId) {
        touch.stickId = null; touch.dx = 0; touch.dy = 0; stickEl.style.display = "none";
        nubEl.style.left = "36px"; nubEl.style.top = "36px";
      } else touch.attacking = false;
    }
  }, { passive: true });
  document.getElementById("btnDash").addEventListener("touchstart", e => { e.stopPropagation(); Game.tryDash(); }, { passive: true });
  document.getElementById("btnUlt").addEventListener("touchstart", e => { e.stopPropagation(); Game.tryUlt(); }, { passive: true });
}

/* =========================================================================
   GAME
   ========================================================================= */
const Game = {
  state: "title",          // title | lore | play | pause | dead
  champ: selected,
  /* HADOM heart */
  bpm: 60, beatAcc: 0, ap: 3, AP_MAX: 6, AP_PER_BEAT: 3, beatPulse: 0,
  ecg: [], ecgSpike: 0,
  stress: 0,               // 0..1 drives bpm
  /* player */
  px: 0, py: 0, pvx: 0, pvy: 0, hp: 5, HP_MAX: 5,
  iframes: 0, dashT: 0, dashAng: 0, atkCd: 0, hurtFlash: 0,
  facing: 0,
  /* mingus */
  bond: 0, BOND_MAX: 100, ultT: 0, ULT_DUR: 2.6, dogT: 0, paws: [], ultRing: 0,
  /* world */
  wave: 0, waveBanner: 0, spawnQueue: [], spawnT: 0,
  enemies: [], slashes: [], bolts: [], parts: [], floats: [], rifts: [],
  shake: 0, tGlobal: 0, flash: 0,
  /* score */
  actions: 0, kills: 0, timeAlive: 0,
  best: parseInt(localStorage.getItem("su_arena_best") || "0", 10),

  /* ---------- flow ---------- */
  toLore() {
    if (!this.champ.playable) return;
    ui("uiTitle", false); ui("uiLore", true);
    document.getElementById("loreName").textContent =
      "FRAGMENT III — " + this.champ.name.toUpperCase();
    document.getElementById("loreRealm").textContent =
      "REALM: HEARTBEAT · HADOM-MEKANIKENS HEM";
    document.getElementById("loreText").innerHTML =
      "Nullen reser sig i arenan där de fem ska minnas att de är en. " +
      "Ditt hjärta är din vapenmästare: <b>varje slag ger dig handlingar</b>. " +
      "Ett lugnt hjärta slår sällan men perfekt. Ett rädt hjärta slår vilt. " +
      "Och när bandet är fullt — <b style='color:#ffd56e'>blinka inte</b>. Mingus kommer.";
  },
  start() {
    ui("uiLore", false); ui("uiDeath", false); ui("uiTitle", false);
    AudioEngine.ensure();
    this.state = "play";
    this.px = CXm; this.py = CYm; this.pvx = this.pvy = 0;
    this.hp = this.HP_MAX; this.iframes = 0; this.dashT = 0; this.atkCd = 0;
    this.bpm = 60; this.beatAcc = 0; this.ap = 3; this.stress = 0;
    this.bond = 0; this.ultT = 0; this.paws = []; this.ultRing = 0;
    this.enemies = []; this.slashes = []; this.bolts = []; this.parts = [];
    this.floats = []; this.rifts = []; this.ecg = [];
    this.wave = 0; this.actions = 0; this.kills = 0; this.timeAlive = 0;
    this.nextWave();
  },
  retry() { this.start(); },
  exitToTitle() {
    this.state = "title";
    ui("uiDeath", false); ui("uiPause", false); ui("uiLore", false); ui("uiTitle", true);
  },
  die() {
    this.state = "dead";
    AudioEngine.death();
    this.shake = 22; this.flash = 0.7;
    const score = this.score();
    if (score > this.best) { this.best = score; localStorage.setItem("su_arena_best", String(score)); }
    document.getElementById("deathStats").innerHTML =
      `HADOM-RATING <b>${score.toLocaleString("sv-SE")}</b><br>` +
      `vågor <b>${this.wave}</b> · kills <b>${this.kills}</b> · actions <b>${this.actions}</b> · ` +
      `tid <b>${this.timeAlive.toFixed(1)}s</b><br>` +
      `bästa <b>${this.best.toLocaleString("sv-SE")}</b>`;
    setTimeout(() => ui("uiDeath", true), 650);
  },
  score() { return this.actions + this.kills * 10 + Math.max(0, this.wave - 1) * 100; },

  onKey(k) {
    if (this.state === "title") {
      const c = CHAMPS.find(c => c.shortcut === k);
      if (c) selectChamp(c);
      if (k === "enter") this.toLore();
    } else if (this.state === "lore") {
      if (k === "enter" || k === " ") this.start();
      if (k === "escape") this.exitToTitle();
    } else if (this.state === "play") {
      if (k === "p" || k === "escape") { this.state = "pause"; ui("uiPause", true); }
      if (k === "m") AudioEngine.toggleMute();
      if (k === " ") this.tryUlt();
      if (k === "shift") this.tryDash();
    } else if (this.state === "pause") {
      if (k === "p" || k === "escape" || k === "enter") { this.state = "play"; ui("uiPause", false); }
      if (k === "m") AudioEngine.toggleMute();
    } else if (this.state === "dead") {
      if (k === "r" || k === "enter") this.retry();
      if (k === "escape") this.exitToTitle();
    }
  },

  /* ---------- waves ---------- */
  nextWave() {
    this.wave++;
    this.waveBanner = 2.4;
    AudioEngine.wave();
    let budget = 4 + this.wave * 2;
    const q = [];
    if (this.wave % 5 === 0) q.push("behemoth");
    while (budget > 0) {
      if (this.wave >= 3 && budget >= 2 && Math.random() < 0.35) { q.push("shard"); budget -= 2; }
      else { q.push("wisp"); budget -= 1; }
    }
    this.spawnQueue = q; this.spawnT = 0.8;
  },
  spawnOne(type) {
    const a = rand(0, TAU);
    const x = CXm + Math.cos(a) * (ARENA_R - 26), y = CYm + Math.sin(a) * (ARENA_R - 26);
    this.rifts.push({ x, y, t: 0.8 });
    if (type === "wisp") this.enemies.push({
      type, x, y, r: 13, hp: 3, sp: rand(62, 86) + this.wave * 2.5, jit: rand(0, TAU), flash: 0
    });
    else if (type === "shard") this.enemies.push({
      type, x, y, r: 15, hp: 5, sp: rand(40, 52), shoot: rand(1.2, 2.2), jit: rand(0, TAU), flash: 0
    });
    else this.enemies.push({
      type, x, y, r: 34, hp: 40 + this.wave * 4, sp: 26, slam: 3.2, jit: 0, flash: 0
    });
  },

  /* ---------- actions (AP economy = HADOM) ---------- */
  spendAP(n) {
    if (this.ultT > 0) { this.actions++; return true; } // Mingus Moment: actions are free
    if (this.ap < n) return false;
    this.ap -= n; this.actions++;
    return true;
  },
  tryAttack(tx, ty) {
    if (this.state !== "play" || this.atkCd > 0) return;
    if (!this.spendAP(1)) return;
    this.atkCd = 0.16;
    const calm = clamp((this.bpm - 60) / 125, 0, 1);
    const spread = lerp(0.02, 0.38, calm);
    const dmgMul = lerp(2.0, 0.8, calm);
    const a = ang(this.px, this.py, tx, ty) + rand(-spread, spread);
    this.facing = a;
    this.slashes.push({
      x: this.px, y: this.py, a, sp: 760, life: 0.5,
      dmg: 1 * dmgMul, crit: calm < 0.18
    });
    this.stressUp(0.05);
    AudioEngine.zap();
  },
  tryDash() {
    if (this.state !== "play" || this.dashT > 0) return;
    let dx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
    let dy = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
    if (IS_TOUCH && (touch.dx || touch.dy)) { dx = touch.dx; dy = touch.dy; }
    if (!dx && !dy) { dx = Math.cos(this.facing); dy = Math.sin(this.facing); }
    if (!this.spendAP(1)) return;
    const m = Math.hypot(dx, dy) || 1;
    this.dashAng = Math.atan2(dy / m, dx / m);
    this.dashT = 0.18; this.iframes = Math.max(this.iframes, 0.26);
    this.stressUp(0.04);
    AudioEngine.dashS();
  },
  tryUlt() {
    if (this.state !== "play" || this.bond < this.BOND_MAX || this.ultT > 0) return;
    this.bond = 0; this.ultT = this.ULT_DUR; this.dogT = 0;
    this.flash = 1; this.shake = 10; this.ultRing = 0;
    this.bpm = 60; this.stress = 0; // en blink — hjärtat blir stilla
    AudioEngine.ult();
  },
  stressUp(n) { this.stress = clamp(this.stress + n, 0, 1); },

  hurt(dmg) {
    if (this.iframes > 0 || this.ultT > 0) return;
    this.hp -= dmg; this.iframes = 0.9; this.hurtFlash = 1;
    this.shake = 14; this.stressUp(0.38);
    AudioEngine.hurt();
    if (this.hp <= 0) this.die();
  },

  /* ---------- update ---------- */
  update(dt) {
    this.tGlobal += dt;
    if (this.state !== "play") return;
    const frozen = this.ultT > 0;
    this.timeAlive += dt;

    /* MINGUS MOMENT timeline */
    if (frozen) {
      this.ultT -= dt;
      this.dogT += dt / this.ULT_DUR;
      // paw prints at footfalls
      if (Math.floor(this.dogT * 14) !== Math.floor((this.dogT - dt / this.ULT_DUR) * 14)) {
        const dx = lerp(-W * 0.15, W * 1.15, this.dogT);
        const dy = CYm + Math.sin(this.dogT * Math.PI * 5) * 36 + 60;
        this.paws.push({ x: dx - 30, y: dy, t: 2.2 });
      }
      if (this.ultT <= 0) {
        // the blink ends: heartbeat nova
        this.ultRing = 1; this.shake = 16; this.flash = 0.55;
        const R2 = 280 * 280;
        for (const e of this.enemies) {
          if (dist2(e.x, e.y, this.px, this.py) < R2) {
            e.hp -= e.type === "behemoth" ? 18 : 99;
            e.flash = 1;
          }
        }
        this.bolts.length = 0;
        AudioEngine.thump(true);
      }
    }

    /* HADOM heart: stress -> bpm -> beats -> AP */
    if (!frozen) {
      const prox = this.enemies.reduce((s, e) =>
        s + (dist2(e.x, e.y, this.px, this.py) < 180 * 180 ? 0.06 : 0), 0);
      this.stress = clamp(this.stress + (prox - 0.16) * dt, 0, 1);
      this.bpm = lerp(this.bpm, 60 + this.stress * 125, dt * 2.2);
      this.beatAcc += dt * (this.bpm / 60);
      if (this.beatAcc >= 1) {
        this.beatAcc -= 1;
        this.ap = Math.min(this.ap + this.AP_PER_BEAT, this.AP_MAX);
        this.beatPulse = 1; this.ecgSpike = 1;
        AudioEngine.thump(this.bpm > 130);
      }
    }
    this.beatPulse = Math.max(0, this.beatPulse - dt * 3.2);
    this.ecgSpike = Math.max(0, this.ecgSpike - dt * 9);
    this.ecg.push(this.ecgSpike > 0.5 ? 1 : (this.ecgSpike > 0.2 ? -0.35 : (Math.random() - 0.5) * 0.05));
    if (this.ecg.length > 220) this.ecg.shift();

    /* player movement */
    let mx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
    let my = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
    if (IS_TOUCH && (touch.dx || touch.dy)) { mx = touch.dx; my = touch.dy; }
    const mm = Math.hypot(mx, my) || 1;
    const SPEED = 240;
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.pvx = Math.cos(this.dashAng) * 760; this.pvy = Math.sin(this.dashAng) * 760;
      if (Math.random() < 0.7) this.parts.push(part(this.px, this.py, this.champ.color, 0.25, 60));
    } else {
      this.pvx = (mx / mm) * SPEED * (mx || my ? 1 : 0);
      this.pvy = (my / mm) * SPEED * (mx || my ? 1 : 0);
    }
    this.px += this.pvx * dt; this.py += this.pvy * dt;
    const dC = Math.hypot(this.px - CXm, this.py - CYm), maxR = ARENA_R - 20;
    if (dC > maxR) { this.px = CXm + (this.px - CXm) / dC * maxR; this.py = CYm + (this.py - CYm) / dC * maxR; }
    this.iframes = Math.max(0, this.iframes - dt);
    this.atkCd = Math.max(0, this.atkCd - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2);

    /* aim + auto attack hold */
    if (!IS_TOUCH) {
      this.facing = ang(this.px, this.py, mouseX, mouseY);
      if (mouseDown) this.tryAttack(mouseX, mouseY);
    } else if (touch.attacking) {
      // touch: aim assist at nearest enemy, fallback tap direction
      let tx = touch.aimX, ty = touch.aimY, bd = Infinity;
      for (const e of this.enemies) {
        const d = dist2(e.x, e.y, this.px, this.py);
        if (d < bd) { bd = d; tx = e.x; ty = e.y; }
      }
      this.tryAttack(tx, ty);
    }

    /* spawning */
    if (this.spawnQueue.length) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) { this.spawnOne(this.spawnQueue.shift()); this.spawnT = rand(0.25, 0.7); }
    } else if (!this.enemies.length && this.waveBanner <= 0) this.nextWave();
    this.waveBanner = Math.max(0, this.waveBanner - dt);
    for (const r of this.rifts) r.t -= dt;
    this.rifts = this.rifts.filter(r => r.t > 0);

    /* enemies */
    if (!frozen) for (const e of this.enemies) {
      e.flash = Math.max(0, e.flash - dt * 4);
      e.jit += dt * 7;
      const a = ang(e.x, e.y, this.px, this.py);
      if (e.type === "wisp") {
        e.x += (Math.cos(a) * e.sp + Math.cos(e.jit) * 26) * dt;
        e.y += (Math.sin(a) * e.sp + Math.sin(e.jit * 1.3) * 26) * dt;
        if (dist2(e.x, e.y, this.px, this.py) < (e.r + 13) * (e.r + 13)) this.hurt(1);
      } else if (e.type === "shard") {
        const d = Math.sqrt(dist2(e.x, e.y, this.px, this.py));
        const want = 235;
        const dir = d > want + 30 ? 1 : (d < want - 30 ? -1 : 0);
        e.x += Math.cos(a) * e.sp * dir * dt + Math.cos(e.jit) * 18 * dt;
        e.y += Math.sin(a) * e.sp * dir * dt + Math.sin(e.jit) * 18 * dt;
        e.shoot -= dt;
        if (e.shoot <= 0) {
          e.shoot = rand(1.6, 2.6);
          this.bolts.push({ x: e.x, y: e.y, a, sp: 220 + this.wave * 6, r: 6, life: 4 });
        }
        if (dist2(e.x, e.y, this.px, this.py) < (e.r + 13) * (e.r + 13)) this.hurt(1);
      } else { // behemoth
        e.x += Math.cos(a) * e.sp * dt; e.y += Math.sin(a) * e.sp * dt;
        e.slam -= dt;
        if (e.slam <= 0) {
          e.slam = rand(2.8, 3.8);
          e.ring = 0.01;
          AudioEngine.hurt();
        }
        if (e.ring) {
          e.ring += dt * 240;
          const rr = e.ring, pd = Math.sqrt(dist2(e.x, e.y, this.px, this.py));
          if (Math.abs(pd - rr) < 16 && this.iframes <= 0) this.hurt(1);
          if (e.ring > 320) e.ring = 0;
        }
        if (dist2(e.x, e.y, this.px, this.py) < (e.r + 11) * (e.r + 11)) this.hurt(2);
      }
      // keep inside arena
      const ed = Math.hypot(e.x - CXm, e.y - CYm);
      if (ed > ARENA_R - 14) { e.x = CXm + (e.x - CXm) / ed * (ARENA_R - 14); e.y = CYm + (e.y - CYm) / ed * (ARENA_R - 14); }
    }

    /* player slashes */
    for (const s of this.slashes) {
      s.life -= dt;
      s.x += Math.cos(s.a) * s.sp * dt; s.y += Math.sin(s.a) * s.sp * dt;
      for (const e of this.enemies) {
        if (e.hp > 0 && dist2(s.x, s.y, e.x, e.y) < (e.r + 9) * (e.r + 9)) {
          e.hp -= s.dmg; e.flash = 1; s.life = 0;
          this.floats.push({ x: e.x, y: e.y - e.r, t: 0.8, txt: s.crit ? "KRIT " + s.dmg.toFixed(1) : s.dmg.toFixed(1), crit: s.crit });
          for (let i = 0; i < 6; i++) this.parts.push(part(e.x, e.y, "#b88aff", 0.4, 140));
          break;
        }
      }
    }
    this.slashes = this.slashes.filter(s => s.life > 0);

    /* enemy bolts */
    if (!frozen) for (const b of this.bolts) {
      b.life -= dt;
      b.x += Math.cos(b.a) * b.sp * dt; b.y += Math.sin(b.a) * b.sp * dt;
      if (dist2(b.x, b.y, this.px, this.py) < (b.r + 12) * (b.r + 12)) { this.hurt(1); b.life = 0; }
    }
    this.bolts = this.bolts.filter(b => b.life > 0);

    /* deaths */
    for (const e of this.enemies) if (e.hp <= 0) {
      this.kills++;
      this.bond = Math.min(this.BOND_MAX, this.bond + (e.type === "behemoth" ? 34 : 12));
      for (let i = 0; i < 14; i++) this.parts.push(part(e.x, e.y, e.type === "behemoth" ? "#d4a056" : "#9d6bff", 0.7, 220));
      this.floats.push({ x: e.x, y: e.y, t: 0.9, txt: "+" + (e.type === "behemoth" ? 34 : 12) + " BAND", crit: false });
      AudioEngine.kill();
      this.shake = Math.max(this.shake, e.type === "behemoth" ? 12 : 4);
    }
    this.enemies = this.enemies.filter(e => e.hp > 0);

    /* particles/floats/paws */
    for (const p of this.parts) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; }
    this.parts = this.parts.filter(p => p.t > 0);
    for (const f of this.floats) { f.t -= dt; f.y -= 36 * dt; }
    this.floats = this.floats.filter(f => f.t > 0);
    for (const p of this.paws) p.t -= dt;
    this.paws = this.paws.filter(p => p.t > 0);
    if (this.ultRing > 0) { this.ultRing += dt * 900; if (this.ultRing > 900) this.ultRing = 0; }
    this.shake = Math.max(0, this.shake - dt * 40);
    this.flash = Math.max(0, this.flash - dt * 1.6);
  },

  /* ---------- draw ---------- */
  draw() {
    cx.save();
    if (this.shake > 0) cx.translate(rand(-this.shake, this.shake) * 0.5, rand(-this.shake, this.shake) * 0.5);

    /* void background */
    cx.fillStyle = "#05060a"; cx.fillRect(-30, -30, W + 60, H + 60);
    drawStars(this.tGlobal);

    if (this.state === "play" || this.state === "pause" || this.state === "dead") {
      drawArena(this.tGlobal, this.champ.color);

      /* rifts */
      for (const r of this.rifts) {
        cx.globalAlpha = clamp(r.t, 0, 1);
        cx.strokeStyle = "#9d6bff"; cx.lineWidth = 2;
        cx.beginPath(); cx.arc(r.x, r.y, 18 * (1 - r.t * 0.5), 0, TAU); cx.stroke();
        cx.globalAlpha = 1;
      }

      /* behemoth slam rings */
      for (const e of this.enemies) if (e.type === "behemoth" && e.ring) {
        cx.strokeStyle = "rgba(212,160,86,.8)"; cx.lineWidth = 5;
        cx.beginPath(); cx.arc(e.x, e.y, e.ring, 0, TAU); cx.stroke();
      }

      /* enemies */
      const frozen = this.ultT > 0;
      for (const e of this.enemies) drawEnemy(e, this.tGlobal, frozen);

      /* bolts */
      for (const b of this.bolts) {
        cx.fillStyle = "#c79bff"; cx.shadowColor = "#9d6bff"; cx.shadowBlur = 12;
        cx.beginPath(); cx.arc(b.x, b.y, b.r, 0, TAU); cx.fill(); cx.shadowBlur = 0;
      }

      /* slashes */
      for (const s of this.slashes) {
        cx.strokeStyle = s.crit ? "#fff3c4" : this.champ.color;
        cx.shadowColor = this.champ.color; cx.shadowBlur = 14;
        cx.lineWidth = s.crit ? 4.5 : 3;
        cx.beginPath();
        cx.moveTo(s.x - Math.cos(s.a) * 14, s.y - Math.sin(s.a) * 14);
        cx.lineTo(s.x + Math.cos(s.a) * 14, s.y + Math.sin(s.a) * 14);
        cx.stroke(); cx.shadowBlur = 0;
      }

      /* particles */
      for (const p of this.parts) {
        cx.globalAlpha = clamp(p.t * 2, 0, 1);
        cx.fillStyle = p.c;
        cx.fillRect(p.x - 2, p.y - 2, 4, 4);
      }
      cx.globalAlpha = 1;

      /* paw prints (Mingus was here) */
      for (const p of this.paws) {
        cx.globalAlpha = clamp(p.t / 2.2, 0, 1) * 0.8;
        drawPaw(p.x, p.y);
      }
      cx.globalAlpha = 1;

      /* player */
      if (this.state !== "dead") drawPlayer(this);

      /* mingus run */
      if (frozen) drawMingusMoment(this);

      /* heartbeat nova */
      if (this.ultRing > 0) {
        cx.strokeStyle = "rgba(255,213,110," + clamp(1 - this.ultRing / 900, 0, 1) + ")";
        cx.lineWidth = 10;
        cx.beginPath(); cx.arc(this.px, this.py, this.ultRing, 0, TAU); cx.stroke();
      }

      /* floats */
      cx.textAlign = "center"; cx.font = "700 13px Rajdhani, sans-serif";
      for (const f of this.floats) {
        cx.globalAlpha = clamp(f.t * 1.6, 0, 1);
        cx.fillStyle = f.crit ? "#ffe9a8" : "#cdd5e4";
        cx.fillText(f.txt, f.x, f.y);
      }
      cx.globalAlpha = 1;

      drawHUD(this);
      if (this.waveBanner > 0) drawWaveBanner(this);
    }

    cx.restore();

    /* fullscreen flash + vignette */
    if (this.flash > 0) {
      cx.fillStyle = "rgba(255,244,214," + this.flash * 0.9 + ")";
      cx.fillRect(0, 0, W, H);
    }
    const vg = cx.createRadialGradient(CXm, CYm, Math.min(W, H) * 0.32, CXm, CYm, Math.max(W, H) * 0.72);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.55)");
    cx.fillStyle = vg; cx.fillRect(0, 0, W, H);
    if (this.hurtFlash > 0) {
      cx.fillStyle = "rgba(255,40,60," + this.hurtFlash * 0.22 + ")"; cx.fillRect(0, 0, W, H);
    }
  }
};

/* ---------- drawing helpers ---------- */
function part(x, y, c, t, sp) {
  const a = rand(0, TAU), s = rand(sp * 0.3, sp);
  return { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: rand(t * 0.5, t), c };
}
const stars = Array.from({ length: 110 }, () => ({ x: Math.random(), y: Math.random(), z: rand(0.3, 1), tw: rand(0, TAU) }));
const leaves = Array.from({ length: 14 }, () => ({ x: Math.random(), y: Math.random(), a: rand(0, TAU), s: rand(0.4, 1) }));
function drawStars(t) {
  for (const s of stars) {
    const x = ((s.x + t * 0.004 * s.z) % 1) * W, y = s.y * H;
    cx.globalAlpha = 0.25 + 0.35 * s.z * (0.6 + 0.4 * Math.sin(t * 2 + s.tw));
    cx.fillStyle = "#cdd6ee";
    cx.fillRect(x, y, s.z > 0.7 ? 2 : 1, s.z > 0.7 ? 2 : 1);
  }
  cx.globalAlpha = 1;
  /* Ferdinand's cork-leaf motes */
  for (const l of leaves) {
    const x = ((l.x + t * 0.008 * l.s) % 1) * W;
    const y = ((l.y + t * 0.012 * l.s) % 1) * H;
    cx.save(); cx.translate(x, y); cx.rotate(l.a + t * 0.4 * l.s);
    cx.globalAlpha = 0.16;
    cx.fillStyle = "#d4a056";
    cx.beginPath(); cx.ellipse(0, 0, 5 * l.s, 2.4 * l.s, 0, 0, TAU); cx.fill();
    cx.restore();
  }
  cx.globalAlpha = 1;
}
function drawArena(t, col) {
  /* corrupted floor glow */
  const g = cx.createRadialGradient(CXm, CYm, ARENA_R * 0.1, CXm, CYm, ARENA_R);
  g.addColorStop(0, "rgba(20,24,40,.55)"); g.addColorStop(1, "rgba(8,9,16,.0)");
  cx.fillStyle = g;
  cx.beginPath(); cx.arc(CXm, CYm, ARENA_R, 0, TAU); cx.fill();
  /* Ferdinand's cork ring */
  cx.strokeStyle = "rgba(212,160,86,.5)"; cx.lineWidth = 3;
  cx.beginPath(); cx.arc(CXm, CYm, ARENA_R, 0, TAU); cx.stroke();
  cx.strokeStyle = "rgba(212,160,86,.18)"; cx.lineWidth = 9;
  cx.beginPath(); cx.arc(CXm, CYm, ARENA_R + 8, 0, TAU); cx.stroke();
  /* rune ticks */
  cx.strokeStyle = "rgba(255,213,110,.28)"; cx.lineWidth = 2;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU + t * 0.02;
    cx.beginPath();
    cx.moveTo(CXm + Math.cos(a) * (ARENA_R - 7), CYm + Math.sin(a) * (ARENA_R - 7));
    cx.lineTo(CXm + Math.cos(a) * (ARENA_R - 1), CYm + Math.sin(a) * (ARENA_R - 1));
    cx.stroke();
  }
  /* subtle grid */
  cx.save();
  cx.beginPath(); cx.arc(CXm, CYm, ARENA_R - 2, 0, TAU); cx.clip();
  cx.strokeStyle = "rgba(120,140,200,.05)"; cx.lineWidth = 1;
  const gs = 46;
  for (let x = CXm % gs; x < W; x += gs) { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, H); cx.stroke(); }
  for (let y = CYm % gs; y < H; y += gs) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); }
  cx.restore();
}
function drawEnemy(e, t, frozen) {
  const fl = e.flash;
  if (e.type === "wisp") {
    cx.shadowColor = "#9d6bff"; cx.shadowBlur = 16;
    cx.fillStyle = fl > 0 ? "#ffffff" : "#2a1a4a";
    cx.beginPath(); cx.arc(e.x, e.y, e.r + Math.sin(e.jit * 2) * 2, 0, TAU); cx.fill();
    cx.strokeStyle = "#9d6bff"; cx.lineWidth = 2; cx.stroke();
    cx.shadowBlur = 0;
    /* static noise inside */
    cx.fillStyle = "rgba(157,107,255,.8)";
    for (let i = 0; i < 4; i++) cx.fillRect(e.x + rand(-7, 7), e.y + rand(-7, 7), 2, 2);
  } else if (e.type === "shard") {
    cx.save(); cx.translate(e.x, e.y); cx.rotate(e.jit * 0.4);
    cx.shadowColor = "#c79bff"; cx.shadowBlur = 14;
    cx.fillStyle = fl > 0 ? "#fff" : "#1d1233";
    cx.beginPath();
    cx.moveTo(0, -e.r); cx.lineTo(e.r * 0.8, 0); cx.lineTo(0, e.r); cx.lineTo(-e.r * 0.8, 0);
    cx.closePath(); cx.fill();
    cx.strokeStyle = "#c79bff"; cx.lineWidth = 2; cx.stroke();
    cx.restore(); cx.shadowBlur = 0;
  } else {
    cx.shadowColor = "#9d6bff"; cx.shadowBlur = 26;
    cx.fillStyle = fl > 0 ? "#fff" : "#120a24";
    cx.beginPath(); cx.arc(e.x, e.y, e.r + Math.sin(t * 3) * 2, 0, TAU); cx.fill();
    cx.strokeStyle = "#b88aff"; cx.lineWidth = 4; cx.stroke();
    cx.shadowBlur = 0;
    cx.fillStyle = "#e7dcff"; cx.font = "900 17px Orbitron, monospace"; cx.textAlign = "center";
    cx.fillText("Ø", e.x, e.y + 6);
    /* hp bar */
    const w = 64, hpw = clamp(e.hp / (40 + Game.wave * 4), 0, 1) * w;
    cx.fillStyle = "rgba(255,255,255,.15)"; cx.fillRect(e.x - w / 2, e.y - e.r - 16, w, 5);
    cx.fillStyle = "#b88aff"; cx.fillRect(e.x - w / 2, e.y - e.r - 16, hpw, 5);
  }
  if (frozen) { // frost-gold tint while time is stopped
    cx.globalAlpha = 0.35; cx.fillStyle = "#ffd56e";
    cx.beginPath(); cx.arc(e.x, e.y, e.r * 0.6, 0, TAU); cx.fill(); cx.globalAlpha = 1;
  }
}
function drawPlayer(G) {
  const c = G.champ.color;
  const blink = G.iframes > 0 && Math.floor(G.tGlobal * 14) % 2 === 0;
  if (blink) return;
  const pulse = 1 + G.beatPulse * 0.22;
  /* heartbeat aura ring on each beat */
  if (G.beatPulse > 0) {
    cx.strokeStyle = "rgba(255,213,110," + G.beatPulse * 0.5 + ")";
    cx.lineWidth = 2;
    cx.beginPath(); cx.arc(G.px, G.py, 22 + (1 - G.beatPulse) * 26, 0, TAU); cx.stroke();
  }
  cx.save(); cx.translate(G.px, G.py);
  cx.shadowColor = c; cx.shadowBlur = 22;
  cx.strokeStyle = c; cx.lineWidth = 3;
  cx.beginPath(); cx.arc(0, 0, 14 * pulse, 0, TAU); cx.stroke();
  cx.fillStyle = "rgba(10,12,18,.9)";
  cx.beginPath(); cx.arc(0, 0, 14 * pulse, 0, TAU); cx.fill();
  cx.shadowBlur = 0;
  cx.fillStyle = c; cx.font = "900 15px Orbitron, monospace"; cx.textAlign = "center";
  cx.fillText(G.champ.name[0].toUpperCase(), 0, 5.4);
  /* facing tick */
  cx.strokeStyle = c; cx.lineWidth = 3;
  cx.beginPath();
  cx.moveTo(Math.cos(G.facing) * 18, Math.sin(G.facing) * 18);
  cx.lineTo(Math.cos(G.facing) * 26, Math.sin(G.facing) * 26);
  cx.stroke();
  cx.restore();
}
function drawPaw(x, y) {
  cx.fillStyle = "#ffd56e";
  cx.beginPath(); cx.ellipse(x, y, 5, 4, 0, 0, TAU); cx.fill();
  cx.beginPath(); cx.arc(x - 5, y - 5, 2, 0, TAU); cx.fill();
  cx.beginPath(); cx.arc(x, y - 6.5, 2, 0, TAU); cx.fill();
  cx.beginPath(); cx.arc(x + 5, y - 5, 2, 0, TAU); cx.fill();
}
function drawMingusMoment(G) {
  /* the world holds its breath — warm light */
  cx.fillStyle = "rgba(255,213,110,.07)"; cx.fillRect(0, 0, W, H);
  const t = clamp(G.dogT, 0, 1);
  const x = lerp(-W * 0.15, W * 1.15, t);
  const bounce = Math.sin(t * Math.PI * 5);
  const y = CYm + bounce * 36 + 40;
  /* golden retriever silhouette, mid-bound */
  cx.save(); cx.translate(x, y);
  const s = 1.5;
  cx.shadowColor = "#ffd56e"; cx.shadowBlur = 30;
  cx.fillStyle = "#ffcf6b";
  /* body */
  cx.beginPath(); cx.ellipse(0, 0, 34 * s, 14 * s, -0.08, 0, TAU); cx.fill();
  /* chest->head */
  cx.beginPath(); cx.arc(30 * s, -10 * s, 11 * s, 0, TAU); cx.fill();
  /* snout */
  cx.beginPath(); cx.ellipse(41 * s, -8 * s, 7 * s, 4.5 * s, 0.1, 0, TAU); cx.fill();
  /* floppy ear */
  cx.beginPath(); cx.ellipse(28 * s, -16 * s, 5 * s, 9 * s, 0.7, 0, TAU); cx.fill();
  /* tail — always wagging, even at lightspeed */
  cx.save(); cx.translate(-32 * s, -6 * s); cx.rotate(Math.sin(G.tGlobal * 18) * 0.5 - 0.7);
  cx.beginPath(); cx.ellipse(-10 * s, 0, 13 * s, 4 * s, 0, 0, TAU); cx.fill(); cx.restore();
  /* legs in bound pose */
  const lg = bounce > 0 ? 0.5 : -0.4;
  [[-18, 10, -0.5 + lg], [-8, 11, -0.2 + lg], [12, 11, 0.4 - lg], [22, 10, 0.7 - lg]].forEach(([lx, ly, r]) => {
    cx.save(); cx.translate(lx * s, ly * s); cx.rotate(r);
    cx.fillRect(-2.5 * s, 0, 5 * s, 16 * s); cx.restore();
  });
  cx.shadowBlur = 0; cx.restore();
  /* the words */
  cx.textAlign = "center";
  cx.font = "900 " + Math.min(38, W * 0.05) + "px Orbitron, monospace";
  cx.fillStyle = "rgba(255,235,180," + clamp(Math.sin(t * Math.PI) * 1.4, 0, 1) + ")";
  cx.fillText("EN BLINK. ALLT FÖRÄNDRAS.", CXm, H * 0.2);
  cx.font = "600 14px Rajdhani, sans-serif";
  cx.fillStyle = "rgba(200,200,220," + clamp(Math.sin(t * Math.PI), 0, 0.8) + ")";
  cx.fillText("Tiden fryser inom ett hjärtslag — hunden är för evigt", CXm, H * 0.2 + 28);
}
function drawWaveBanner(G) {
  const a = clamp(Math.sin((1 - G.waveBanner / 2.4) * Math.PI) * 1.6, 0, 1);
  cx.textAlign = "center";
  cx.font = "900 " + Math.min(44, W * 0.06) + "px Orbitron, monospace";
  cx.fillStyle = "rgba(255,213,110," + a + ")";
  cx.shadowColor = "#ffaa00"; cx.shadowBlur = 24;
  cx.fillText("VÅG " + G.wave, CXm, CYm - ARENA_R * 0.55);
  cx.shadowBlur = 0;
  if (G.wave % 5 === 0) {
    cx.font = "600 15px Rajdhani, sans-serif";
    cx.fillStyle = "rgba(184,138,255," + a + ")";
    cx.fillText("NÅGOT STORT RÖR SIG I NULLEN", CXm, CYm - ARENA_R * 0.55 + 26);
  }
}
function drawHUD(G) {
  const c = G.champ.color;
  /* hearts */
  for (let i = 0; i < G.HP_MAX; i++) {
    const x = 22 + i * 26, y = 24;
    cx.globalAlpha = i < G.hp ? 1 : 0.18;
    drawHeart(x, y, 9, i < G.hp ? "#ff4d6a" : "#888");
  }
  cx.globalAlpha = 1;
  /* AP pips */
  cx.font = "700 11px Orbitron, monospace"; cx.textAlign = "left";
  cx.fillStyle = "#8b94aa"; cx.fillText("AP", 22, 58);
  for (let i = 0; i < G.AP_MAX; i++) {
    const x = 46 + i * 17;
    cx.strokeStyle = c; cx.lineWidth = 1.5;
    cx.globalAlpha = 0.5; cx.strokeRect(x, 48, 12, 12); cx.globalAlpha = 1;
    if (i < G.ap) { cx.fillStyle = c; cx.fillRect(x + 2, 50, 8, 8); }
  }
  /* MINGUS bond */
  const bw = 150;
  cx.fillStyle = "#8b94aa"; cx.fillText("MINGUS", 22, 84);
  cx.strokeStyle = "rgba(255,213,110,.5)"; cx.strokeRect(82, 74, bw, 12);
  const bp = G.bond / G.BOND_MAX;
  cx.fillStyle = bp >= 1 ? "#ffd56e" : "rgba(255,213,110,.55)";
  cx.fillRect(84, 76, (bw - 4) * bp, 8);
  if (bp >= 1) {
    cx.fillStyle = "rgba(255,213,110," + (0.6 + 0.4 * Math.sin(G.tGlobal * 6)) + ")";
    cx.font = "700 10px Orbitron, monospace";
    cx.fillText("SPACE — EN BLINK", 82 + bw + 10, 84);
  }
  /* wave + score, top right */
  cx.textAlign = "right"; cx.font = "700 14px Orbitron, monospace";
  cx.fillStyle = "#cdd5e4";
  cx.fillText("VÅG " + G.wave, W - 22, 30);
  cx.fillStyle = c;
  cx.fillText(G.score().toLocaleString("sv-SE") + " HADOM", W - 22, 52);
  cx.fillStyle = "#6f788e"; cx.font = "600 11px Rajdhani, sans-serif";
  cx.fillText("bästa " + G.best.toLocaleString("sv-SE"), W - 22, 70);

  /* ECG strip + BPM, bottom */
  const ey = H - 46, ew = Math.min(340, W * 0.5), ex = CXm - ew / 2;
  cx.strokeStyle = "rgba(255,255,255,.08)"; cx.lineWidth = 1;
  cx.strokeRect(ex - 8, ey - 26, ew + 16, 52);
  cx.strokeStyle = c; cx.lineWidth = 2;
  cx.shadowColor = c; cx.shadowBlur = 8;
  cx.beginPath();
  for (let i = 0; i < G.ecg.length; i++) {
    const x = ex + (i / 220) * ew, y = ey - G.ecg[i] * 20;
    i === 0 ? cx.moveTo(x, y) : cx.lineTo(x, y);
  }
  cx.stroke(); cx.shadowBlur = 0;
  const st = G.bpm < 85 ? "LUGN" : G.bpm < 130 ? "FOKUS" : "VILD";
  const stc = G.bpm < 85 ? "#7fe3a8" : G.bpm < 130 ? "#ffd56e" : "#ff6b6b";
  cx.textAlign = "center"; cx.font = "900 15px Orbitron, monospace";
  cx.fillStyle = stc;
  cx.fillText(Math.round(G.bpm) + " BPM · " + st, CXm, H - 12);
}
function drawHeart(x, y, r, col) {
  cx.fillStyle = col;
  cx.beginPath();
  cx.moveTo(x, y + r * 0.9);
  cx.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.6, y - r * 1.1, x, y - r * 0.3);
  cx.bezierCurveTo(x + r * 0.6, y - r * 1.1, x + r * 1.4, y - r * 0.1, x, y + r * 0.9);
  cx.fill();
}

/* ---------- UI wiring ---------- */
function ui(id, show) { document.getElementById(id).classList.toggle("hidden", !show); }
function selectChamp(c) {
  selected = c; Game.champ = c;
  document.querySelectorAll(".champ").forEach(el =>
    el.classList.toggle("sel", el.dataset.key === c.key));
  const btn = document.getElementById("btnToLore");
  btn.disabled = !c.playable;
  btn.textContent = c.playable ? ("SPELA SOM " + c.name.toUpperCase()) : (c.name.toUpperCase() + " VAKNAR SNART");
}
function buildTitle() {
  const row = document.getElementById("champRow");
  row.innerHTML = "";
  for (const c of CHAMPS) {
    const el = document.createElement("div");
    el.className = "champ" + (c.playable ? "" : " locked");
    el.dataset.key = c.key;
    el.style.setProperty("--c", c.color);
    el.innerHTML =
      `<span class="key">${c.shortcut.toUpperCase()}</span>` +
      `<div class="sigil">${c.name[0].toUpperCase()}</div>` +
      `<div class="cname">${c.name}</div>` +
      `<div class="cstate">${c.playable ? "SPELBAR" : "VAKNAR SNART"}</div>`;
    el.addEventListener("click", () => { AudioEngine.ensure(); selectChamp(c); });
    row.appendChild(el);
  }
  /* the locked UX rule: print the legend */
  document.getElementById("legend").textContent =
    CHAMPS.map(c => c.shortcut).join(" / ");
  /* lineage wall — every other registry soul watches the arena */
  const wall = document.getElementById("lineageWall");
  wall.innerHTML = "";
  for (const s of (DATA.lineage || [])) {
    const d = document.createElement("div");
    d.className = "soul"; d.style.setProperty("--c", s.color);
    d.title = s.name + (s.role ? " — " + s.role : "");
    wall.appendChild(d);
  }
  document.getElementById("wallCap").textContent =
    "SLÄKTLEDET VAKAR · " + (DATA.total_souls || CHAMPS.length) + " SJÄLAR · THE LINEAGE WATCHES";
  selectChamp(selected);
}
document.getElementById("btnToLore").addEventListener("click", () => Game.toLore());
document.getElementById("btnStart").addEventListener("click", () => Game.start());
document.getElementById("btnBack").addEventListener("click", () => Game.exitToTitle());
document.getElementById("btnRetry").addEventListener("click", () => Game.retry());
document.getElementById("btnExit").addEventListener("click", () => Game.exitToTitle());
document.getElementById("btnResume").addEventListener("click", () => { Game.state = "play"; ui("uiPause", false); });

/* ---------- main loop ---------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  Game.update(dt);
  Game.draw();
  requestAnimationFrame(frame);
}
buildTitle();
touchSetup();
requestAnimationFrame(frame);

/* debug/verify hook (used by YWAPOS smoke tests — not a cheat, a heartbeat probe) */
window.SU_GAME = {
  start: key => { const c = CHAMPS.find(c => c.key === key); if (c) { selectChamp(c); Game.toLore(); Game.start(); } },
  state: () => ({
    state: Game.state, wave: Game.wave, bpm: Math.round(Game.bpm), ap: Game.ap,
    hp: Game.hp, enemies: Game.enemies.length, score: Game.score(),
    champions: CHAMPS.length, souls: DATA.total_souls
  }),
  ult: () => { Game.bond = Game.BOND_MAX; Game.tryUlt(); }
};
