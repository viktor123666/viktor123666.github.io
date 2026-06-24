/* ============================================================
   SCALELIST UNIVERSE — browser MMO · STEG 1: grunden
   Canvas 2D (GPU-snålt — kan inte krascha en bräcklig GPU).
   Painterly värld + RuneScape klicka-för-att-gå + mjuk kamera.
   YWAPOS
   ============================================================ */
"use strict";

const cv = document.getElementById("game");
const ctx = cv.getContext("2d", { alpha: false });
let W = 0, H = 0, DPR = 1;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.floor(W * DPR);
  cv.height = Math.floor(H * DPR);
  cv.style.width = W + "px";
  cv.style.height = H + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = true;
}
window.addEventListener("resize", resize);
resize();

/* ---------- assets ---------- */
const assets = {};
function loadImage(key, src) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => { assets[key] = img; res(img); };
    img.onerror = () => { assets[key] = null; res(null); };
    img.src = src;
  });
}

/* ---------- world ---------- */
const TILE = 256;          // painterly grass tile size on screen
const WORLD = 3200;        // world half-extent (square: -WORLD..WORLD)
let grassPattern = null;

/* ---------- camera ---------- */
const cam = { x: 0, y: 0 };

/* ---------- player ---------- */
const player = {
  x: 0, y: 0,
  tx: 0, ty: 0,         // move target
  moving: false,
  speed: 260,           // px/sec
  facing: 1,            // -1 left, 1 right
  bob: 0,
};

/* ---------- input: click-to-move (RuneScape) ---------- */
const ripples = [];
function screenToWorld(sx, sy) {
  return { x: sx - W / 2 + cam.x, y: sy - H / 2 + cam.y };
}
function onPoint(sx, sy) {
  const w = screenToWorld(sx, sy);
  player.tx = Math.max(-WORLD, Math.min(WORLD, w.x));
  player.ty = Math.max(-WORLD, Math.min(WORLD, w.y));
  player.moving = true;
  ripples.push({ x: player.tx, y: player.ty, t: 0 });
}
cv.addEventListener("mousedown", (e) => onPoint(e.clientX, e.clientY));
cv.addEventListener("touchstart", (e) => {
  if (e.touches.length) onPoint(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });

/* ---------- update ---------- */
function update(dt) {
  // move toward target
  if (player.moving) {
    const dx = player.tx - player.x, dy = player.ty - player.y;
    const d = Math.hypot(dx, dy);
    if (d < 4) {
      player.moving = false;
    } else {
      const step = Math.min(d, player.speed * dt);
      player.x += (dx / d) * step;
      player.y += (dy / d) * step;
      if (Math.abs(dx) > 1) player.facing = dx < 0 ? -1 : 1;
      player.bob += dt * 11;
    }
  }
  // camera eases to player
  cam.x += (player.x - cam.x) * Math.min(1, dt * 6);
  cam.y += (player.y - cam.y) * Math.min(1, dt * 6);
  // ripples
  for (const r of ripples) r.t += dt;
  for (let i = ripples.length - 1; i >= 0; i--) if (ripples[i].t > 0.7) ripples.splice(i, 1);
}

/* ---------- draw ---------- */
function draw() {
  // ground: tiled painterly grass, offset by camera
  if (grassPattern) {
    ctx.save();
    ctx.fillStyle = grassPattern;
    // translate the pattern by -cam so it scrolls with the world
    const ox = (-cam.x + W / 2) % TILE;
    const oy = (-cam.y + H / 2) % TILE;
    ctx.translate(ox, oy);
    ctx.fillRect(-ox - TILE, -oy - TILE, W + TILE * 2, H + TILE * 2);
    ctx.restore();
  } else {
    ctx.fillStyle = "#2c3a22";
    ctx.fillRect(0, 0, W, H);
  }

  // world-space helper
  const sx = (wx) => wx - cam.x + W / 2;
  const sy = (wy) => wy - cam.y + H / 2;

  // world border (the edge of the Arrival Fields)
  ctx.strokeStyle = "rgba(255,195,77,.25)";
  ctx.lineWidth = 6;
  ctx.strokeRect(sx(-WORLD), sy(-WORLD), WORLD * 2, WORLD * 2);

  // move ripples (click markers)
  for (const r of ripples) {
    const a = 1 - r.t / 0.7;
    ctx.strokeStyle = `rgba(255,213,110,${a})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx(r.x), sy(r.y), 6 + r.t * 34, 0, Math.PI * 2);
    ctx.stroke();
  }

  // player
  drawPlayer(sx(player.x), sy(player.y));

  // soft vignette for depth (cheap)
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.36, W / 2, H / 2, Math.max(W, H) * 0.72);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,.45)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawPlayer(x, y) {
  const bobY = player.moving ? Math.sin(player.bob) * 3 : 0;
  // shadow
  ctx.fillStyle = "rgba(0,0,0,.32)";
  ctx.beginPath();
  ctx.ellipse(x, y + 20, 20, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y + bobY);
  ctx.scale(player.facing, 1);
  // body (placeholder hero — real painterly sprite arrives in steg 5)
  // legs
  ctx.fillStyle = "#3a3550";
  ctx.fillRect(-9, 2, 7, 18);
  ctx.fillRect(2, 2, 7, 18);
  // torso (warm cloak)
  ctx.fillStyle = "#b8423a";
  ctx.beginPath();
  ctx.moveTo(-13, 2); ctx.lineTo(13, 2); ctx.lineTo(9, -22); ctx.lineTo(-9, -22); ctx.closePath();
  ctx.fill();
  // belt
  ctx.fillStyle = "#caa14a";
  ctx.fillRect(-13, -2, 26, 5);
  // head
  ctx.fillStyle = "#e8c39a";
  ctx.beginPath();
  ctx.arc(0, -30, 9, 0, Math.PI * 2);
  ctx.fill();
  // helm/hat (gold rim)
  ctx.fillStyle = "#d8b24a";
  ctx.beginPath();
  ctx.arc(0, -33, 10, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // rim glow
  ctx.strokeStyle = "rgba(255,205,110,.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y - 14, 26, 0, Math.PI * 2);
  ctx.stroke();
}

/* ---------- main loop (light: rAF, no GPU shaders) ---------- */
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

/* ---------- boot ---------- */
async function boot() {
  const bar = document.getElementById("loadbar");
  bar.style.width = "30%";
  await loadImage("grass", "/play/assets/grass.png");
  bar.style.width = "100%";
  if (assets.grass) {
    grassPattern = ctx.createPattern(assets.grass, "repeat");
  }
  setTimeout(() => {
    const ld = document.getElementById("load");
    ld.style.transition = "opacity .5s";
    ld.style.opacity = "0";
    setTimeout(() => ld.remove(), 500);
  }, 350);
  requestAnimationFrame(loop);
}
boot();

/* debug hook for YWAPOS browser self-test */
window.SU = {
  state: () => ({ px: Math.round(player.x), py: Math.round(player.y), moving: player.moving, cam: [Math.round(cam.x), Math.round(cam.y)], grass: !!grassPattern }),
  walkTo: (x, y) => { player.tx = x; player.ty = y; player.moving = true; },
};
