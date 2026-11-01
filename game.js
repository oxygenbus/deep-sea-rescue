/* Deep Sea Rescue
   Original artwork and code. Submarine-rescue arcade homage, not a commercial port. */

const W = 960;
const H = 600;
const SURFACE_Y = 100;
const SEABED_Y = 552;
const SAFE_DEPTH = 50;
const MAX_DIVERS = 6;
const START_LIVES = 3;
const PLAYER_SPEED = 270;
const FIRE_COOLDOWN = 0.28;
const SCORE_SHARK = 40;
const SCORE_SUB = 80;
const SCORE_DIVER = 100;
const OXYGEN_RED = 25;
const HIGH_KEY = "deep-sea-rescue-high-score";

const PLAYER_SUB = [
  "..........HH............",
  ".........HHHH...........",
  ".........HWWH...........",
  "........HHHHHH..........",
  "..TT..HHHHHHHHHHHHHH....",
  ".TTTHHHHHHHHHHHHHHHHH...",
  "TTTHHHHHSSSSSSSSSSHHHHH.",
  ".TTTHHHHHHHHHHHHHHHHH...",
  "..TT..HHHHHHHHHHHHHH....",
  "......PP................",
];

const SHARK = [
  "............FF..........",
  "...........FFFF.........",
  "......BBBFFFFFFF........",
  "....BBBBBBBBBBBBBBBB....",
  "..TTBBBBBBBBBBBBBBBBOE..",
  "TT.BBBBBBBBBBBBBBBBBB...",
  "..TBBBBBBBBBBBBBBBBB....",
  "....WWWWWWWWWWWWWWW.....",
  "......FF................",
  ".....FF.................",
];

const DIVER_A = [
  "...HH...",
  "..HHHH..",
  "..HMMH..",
  "...HH...",
  ".TTBBB..",
  ".TTBBB..",
  "..BBB...",
  "..B.B...",
  ".FF.FF..",
  ".FF.FF..",
  "..F..F..",
  "...FF...",
];

const DIVER_B = [
  "...HH...",
  "..HHHH..",
  "..HMMH..",
  "...HH...",
  ".TTBBB..",
  ".TTBBB..",
  "..BBB...",
  ".BB.BB..",
  "FF...FF.",
  "FF...FF.",
  ".F...F..",
  "........",
];

const PLAYER_PALETTE = {
  H: "#f0c14b",
  S: "#1e5168",
  T: "#c4922a",
  W: "#b9f4ff",
  P: "#eef3f7",
};

const ENEMY_PALETTE = {
  H: "#d24b4b",
  S: "#6e1824",
  T: "#8e2a32",
  W: "#ffd0b0",
  P: "#f0d0d0",
};

const SHARK_PALETTE = {
  B: "#8ea2b4",
  W: "#e7eef3",
  F: "#64788a",
  T: "#64788a",
  O: "#f7fbff",
  E: "#172026",
};

const DIVER_PALETTE = {
  H: "#f0c2a0",
  M: "#163044",
  B: "#ff8a3d",
  T: "#49c2e0",
  F: "#22282e",
};

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });
const startBtn = document.getElementById("btn-start");
const pauseBtn = document.getElementById("btn-pause");
const restartBtn = document.getElementById("btn-restart");

const keys = new Set();
let audioCtx = null;
let siren = null;
let lastTime = 0;
let uiTime = 0;
let seaTime = 0;
let loopStarted = false;

const game = {
  state: "menu",
  score: 0,
  highScore: 0,
  time: 0,
  shake: 0,
  flash: 0,
  deathLock: false,
  wasSurfaced: false,
  spawnAcc: 0,
  diverAcc: 0,
  fireCd: 0,
  fullCd: 0,
  muted: false,
  player: null,
  enemies: [],
  divers: [],
  torpedoes: [],
  explosions: [],
  particles: [],
  floaters: [],
  bubbles: [],
  fish: [],
  decor: [],
};

function loadHighScore() {
  try {
    const n = Number(localStorage.getItem(HIGH_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch (err) {
    return 0;
  }
}

function saveHighScore() {
  try {
    localStorage.setItem(HIGH_KEY, String(game.highScore));
  } catch (err) {
    /* private mode */
  }
}

function spriteSize(rows, scale) {
  const width = rows[0].length;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].length !== width) {
      throw new Error("Sprite row " + i + " is " + rows[i].length + ", expected " + width);
    }
  }
  return { w: width * scale, h: rows.length * scale };
}

const SUB_SIZE = spriteSize(PLAYER_SUB, 3);
const SHARK_SIZE = spriteSize(SHARK, 3);
const DIVER_SIZE = spriteSize(DIVER_A, 2);

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function pad(n) {
  return String(Math.max(0, Math.floor(n))).padStart(6, "0");
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function threat() {
  return Math.min(1, game.score / 2800);
}

function hit(a, b, padAmount) {
  const p = padAmount || 0;
  return a.x < b.x + b.w + p && a.x + a.w > b.x - p && a.y < b.y + b.h + p && a.y + a.h > b.y - p;
}

function ensureAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function tone(freq, dur, type, vol, slide) {
  if (game.muted || !audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

/* Red oxygen bar runs a looping two-tone siren until air recovers, play stops, or mute. */
function startSiren() {
  const ctx = ensureAudio();
  if (!ctx || siren) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = 560;
  gain.gain.value = 0.03;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  siren = { osc: osc, gain: gain };
}

function stopSiren() {
  if (!siren) return;
  const node = siren;
  siren = null;
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  try {
    const level = Math.max(0.001, node.gain.gain.value);
    node.gain.gain.cancelScheduledValues(t);
    node.gain.gain.setValueAtTime(level, t);
    node.gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    node.osc.stop(t + 0.05);
  } catch (err) {
    /* oscillator already stopped */
  }
}

function updateSiren() {
  const player = game.player;
  const alarm = game.state === "playing" && player && player.oxygen <= OXYGEN_RED && !game.muted;
  if (!alarm) {
    stopSiren();
    return;
  }
  if (!siren) startSiren();
  if (!siren || !audioCtx) return;
  const high = Math.sin(uiTime * 14) > 0;
  siren.osc.frequency.setTargetAtTime(high ? 920 : 540, audioCtx.currentTime, 0.012);
  siren.gain.gain.setTargetAtTime(high ? 0.04 : 0.026, audioCtx.currentTime, 0.012);
}

function sfx(name) {
  if (name === "shoot") tone(640, 0.06, "square", 0.04, 180);
  else if (name === "explode") tone(180, 0.14, "sawtooth", 0.05, -120);
  else if (name === "pickup") tone(880, 0.07, "square", 0.04, 240);
  else if (name === "surface") {
    tone(520, 0.08, "square", 0.04, 0);
    tone(700, 0.1, "square", 0.04, 80);
  } else if (name === "life") {
    tone(523, 0.08, "square", 0.045, 0);
    tone(659, 0.08, "square", 0.045, 0);
    tone(784, 0.14, "square", 0.05, 80);
  } else if (name === "hit") tone(120, 0.22, "sawtooth", 0.06, -70);
  else if (name === "over") tone(220, 0.35, "triangle", 0.05, -160);
}

function scoreAdd(n) {
  game.score += n;
  if (game.score > game.highScore) {
    game.highScore = game.score;
    saveHighScore();
  }
}

function spawnFloater(x, y, text, color) {
  game.floaters.push({
    x: x,
    y: y,
    text: text,
    color: color || "#fff4c4",
    t: 0,
    life: 0.8,
  });
  if (game.floaters.length > 14) game.floaters.shift();
}

function spawnExplosion(x, y, color) {
  game.explosions.push({ x: x, y: y, t: 0, life: 0.38, color: color });
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = rand(40, 130);
    game.particles.push({
      x: x,
      y: y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      t: 0,
      life: rand(0.22, 0.42),
      color: color,
      size: rand(2, 4),
    });
  }
  if (game.particles.length > 160) game.particles.splice(0, game.particles.length - 160);
}

function buildDecor() {
  let seed = 20260331;
  const next = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 16; i++) {
    game.decor.push({
      kind: "rock",
      x: next() * W,
      w: 16 + next() * 40,
      h: 12 + next() * 18,
      shade: next(),
    });
  }
  for (let i = 0; i < 9; i++) {
    game.decor.push({
      kind: "kelp",
      x: 24 + next() * (W - 48),
      h: 36 + next() * 78,
      phase: next() * 6,
      color: next() > 0.5 ? "#1d7a4c" : "#2f9d62",
    });
  }
  for (let i = 0; i < 7; i++) {
    game.decor.push({
      kind: "coral",
      x: next() * (W - 20),
      h: 14 + next() * 24,
      color: next() > 0.5 ? "#d36b6b" : "#d08a3a",
    });
  }
  for (let i = 0; i < 22; i++) {
    game.bubbles.push({
      x: next() * W,
      y: SURFACE_Y + next() * (SEABED_Y - SURFACE_Y),
      r: 2 + next() * 3,
      speed: 18 + next() * 28,
      phase: next() * 6,
      freq: 1 + next() * 2,
    });
  }
  for (let i = 0; i < 7; i++) {
    const dir = next() > 0.5 ? 1 : -1;
    game.fish.push({
      x: next() * W,
      y: SURFACE_Y + 80 + next() * 280,
      vx: dir * (18 + next() * 22),
    });
  }
}

function makePlayer() {
  return {
    x: 168,
    y: 250,
    w: SUB_SIZE.w,
    h: SUB_SIZE.h,
    facing: 1,
    oxygen: 100,
    divers: 0,
    invuln: 1.1,
    lives: START_LIVES,
  };
}

function spawnDiver(x, y, vx) {
  const diver = {
    x: x == null ? rand(40, W - 80) : x,
    y: y == null ? rand(SURFACE_Y + SAFE_DEPTH + 20, SEABED_Y - 80) : y,
    w: DIVER_SIZE.w,
    h: DIVER_SIZE.h,
    vx: vx == null ? (Math.random() < 0.5 ? -32 : 32) : vx,
    phase: Math.random() * 6,
  };
  diver.baseY = diver.y;
  game.divers.push(diver);
}

function spawnEnemy(forceType) {
  const maxEnemies = 5 + Math.floor(threat() * 4);
  if (game.enemies.length >= maxEnemies) return;
  const type = forceType || (Math.random() < 0.64 - threat() * 0.22 ? "shark" : "sub");
  const size = type === "shark" ? SHARK_SIZE : SUB_SIZE;
  const fromLeft = Math.random() < 0.5;
  const bob = type === "shark" ? 16 : 7;
  const minY = SURFACE_Y + SAFE_DEPTH + bob;
  const maxY = SEABED_Y - size.h - 22 - bob;
  let baseY = minY + Math.random() * Math.max(12, maxY - minY);
  for (let i = 0; i < 6; i++) {
    const y = minY + Math.random() * Math.max(12, maxY - minY);
    const crowded = game.enemies.some((e) => Math.abs(e.baseY - y) < 36);
    if (!crowded) {
      baseY = y;
      break;
    }
  }
  const speed = (type === "shark" ? rand(100, 138) : rand(72, 108)) * (1 + threat() * 0.8);
  game.enemies.push({
    type: type,
    x: fromLeft ? -size.w - 8 : W + 8,
    y: baseY,
    baseY: baseY,
    w: size.w,
    h: size.h,
    vx: fromLeft ? speed : -speed,
    bob: bob,
    phase: Math.random() * Math.PI * 2,
    freq: rand(1.2, 1.8),
    fireCd: rand(1.6, 3.4),
  });
}

function spawnPlayerTorpedo() {
  const player = game.player;
  const live = game.torpedoes.reduce((n, t) => n + (t.friendly ? 1 : 0), 0);
  if (live >= 4) return;
  const dir = player.facing;
  game.torpedoes.push({
    x: dir > 0 ? player.x + player.w + 2 : player.x - 16,
    y: player.y + Math.floor(player.h / 2) - 2,
    w: 16,
    h: 6,
    vx: dir * 520,
    friendly: true,
  });
  sfx("shoot");
}

function readInput() {
  const left = keys.has("ArrowLeft") || keys.has("KeyA");
  const right = keys.has("ArrowRight") || keys.has("KeyD");
  const up = keys.has("ArrowUp") || keys.has("KeyW");
  const down = keys.has("ArrowDown") || keys.has("KeyS");
  let x = (right ? 1 : 0) - (left ? 1 : 0);
  let y = (down ? 1 : 0) - (up ? 1 : 0);
  if (x && y) {
    x *= Math.SQRT1_2;
    y *= Math.SQRT1_2;
  }
  return { x: x, y: y, fire: keys.has("Space") };
}

function updatePlayer(dt) {
  const player = game.player;
  const input = readInput();
  if (input.x !== 0) player.facing = input.x > 0 ? 1 : -1;
  player.x += input.x * PLAYER_SPEED * dt;
  player.y += input.y * PLAYER_SPEED * dt;
  player.x = clamp(player.x, 6, W - player.w - 6);
  player.y = clamp(player.y, SURFACE_Y - 4, SEABED_Y - player.h - 12);
  player.invuln = Math.max(0, player.invuln - dt);
  game.fireCd = Math.max(0, game.fireCd - dt);
  game.fullCd = Math.max(0, game.fullCd - dt);
  if (input.fire && game.fireCd <= 0) {
    spawnPlayerTorpedo();
    game.fireCd = FIRE_COOLDOWN;
  }
  if ((input.x !== 0 || input.y !== 0) && Math.random() < dt * 10) {
    const tail = player.facing > 0 ? player.x + 4 : player.x + player.w - 6;
    game.bubbles.push({
      x: tail,
      y: player.y + player.h * 0.65,
      r: 2,
      speed: 36,
      phase: Math.random() * 6,
      freq: 2,
    });
    if (game.bubbles.length > 50) game.bubbles.shift();
  }
}

/* Oxygen drains only while the hull is below the surface. A partial load drops
   one diver per visit. A full boat of six grants a life and clears the boat. */
function updateOxygen(dt) {
  const player = game.player;
  const surfaced = player.y <= SURFACE_Y + 2;
  if (surfaced) {
    player.oxygen = Math.min(100, player.oxygen + 48 * dt);
    if (!game.wasSurfaced && player.divers > 0) {
      if (player.divers === MAX_DIVERS) {
        const pts = MAX_DIVERS * SCORE_DIVER;
        player.divers = 0;
        player.lives += 1;
        scoreAdd(pts);
        spawnFloater(player.x, player.y - 8, "+1 LIFE", "#ffe08a");
        sfx("life");
      } else {
        player.divers -= 1;
        scoreAdd(SCORE_DIVER);
        spawnFloater(player.x, player.y - 8, "+" + SCORE_DIVER, "#b6ffd8");
        sfx("surface");
      }
    }
    game.wasSurfaced = true;
  } else {
    game.wasSurfaced = false;
    const drain = 4.7 * (1 + threat() * 0.55);
    player.oxygen -= drain * dt;
    if (player.oxygen <= 0) {
      player.oxygen = 0;
      loseLife("oxygen");
    }
  }
}

function updateTorpedoes(dt) {
  for (let i = game.torpedoes.length - 1; i >= 0; i--) {
    const t = game.torpedoes[i];
    t.x += t.vx * dt;
    if (t.grace) t.grace = Math.max(0, t.grace - dt);
    if (t.x < -40 || t.x > W + 40) game.torpedoes.splice(i, 1);
  }
}

function updateEnemies(dt) {
  for (let i = game.enemies.length - 1; i >= 0; i--) {
    const e = game.enemies[i];
    e.x += e.vx * dt;
    const bobY = e.baseY + Math.sin(game.time * e.freq + e.phase) * e.bob;
    e.y = clamp(bobY, SURFACE_Y + SAFE_DEPTH, SEABED_Y - e.h - 16);
    if ((e.vx > 0 && e.x > W + 30) || (e.vx < 0 && e.x < -e.w - 30)) {
      game.enemies.splice(i, 1);
      continue;
    }
    if (e.type !== "sub" || game.score < 500) continue;
    e.fireCd -= dt;
    if (e.fireCd > 0 || e.x < 20 || e.x > W - e.w - 20) continue;
    const hostile = game.torpedoes.reduce((n, t) => n + (t.friendly ? 0 : 1), 0);
    if (hostile >= 3) continue;
    e.fireCd = rand(2.4, 4.2) - threat() * 0.7;
    const dir = e.vx > 0 ? 1 : -1;
    game.torpedoes.push({
      x: dir > 0 ? e.x + e.w + 6 : e.x - 18,
      y: e.y + e.h * 0.45,
      w: 12,
      h: 5,
      vx: dir * (210 + threat() * 70),
      friendly: false,
      grace: 0.18,
    });
  }
}

function updateDivers(dt) {
  for (const d of game.divers) {
    d.x += d.vx * dt;
    d.y = d.baseY + Math.sin(game.time * 2.2 + d.phase) * 8;
    if (d.x < 12) {
      d.x = 12;
      d.vx = Math.abs(d.vx);
    } else if (d.x > W - d.w - 12) {
      d.x = W - d.w - 12;
      d.vx = -Math.abs(d.vx);
    }
  }
}

function updateFX(dt) {
  for (let i = game.explosions.length - 1; i >= 0; i--) {
    game.explosions[i].t += dt;
    if (game.explosions[i].t >= game.explosions[i].life) game.explosions.splice(i, 1);
  }
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i];
    p.t += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.98;
    p.vy *= 0.98;
    if (p.t >= p.life) game.particles.splice(i, 1);
  }
  for (let i = game.floaters.length - 1; i >= 0; i--) {
    const f = game.floaters[i];
    f.t += dt;
    f.y -= 28 * dt;
    if (f.t >= f.life) game.floaters.splice(i, 1);
  }
}

/* Spawn interval and speed scale with score so the opening is readable
   and later runs fill both lanes without becoming a solid wall. */
function updateSpawns(dt) {
  game.spawnAcc += dt;
  const interval = 2.35 - threat() * 1.4;
  if (game.spawnAcc >= interval) {
    game.spawnAcc = 0;
    spawnEnemy();
    if (game.score > 900 && Math.random() < threat() * 0.55) spawnEnemy();
  }
  game.diverAcc += dt;
  const diverInterval = 6.2 - threat() * 1.8;
  if (game.diverAcc >= diverInterval && game.divers.length < 3) {
    game.diverAcc = 0;
    spawnDiver();
  }
}

/* Shots resolve first so a torpedo and a hull cannot both score and kill
   on the same overlap. Invulnerability blocks hazard chains, not rescues. */
function handleCollisions() {
  const player = game.player;
  for (let i = 0; i < game.torpedoes.length; i++) {
    const t = game.torpedoes[i];
    if (!t.friendly || t.dead) continue;
    for (let j = 0; j < game.enemies.length; j++) {
      const e = game.enemies[j];
      if (e.dead || !hit(t, e)) continue;
      const pts = e.type === "shark" ? SCORE_SHARK : SCORE_SUB;
      scoreAdd(pts);
      spawnExplosion(e.x + e.w / 2, e.y + e.h / 2, e.type === "shark" ? "#c5d5e2" : "#ff7a55");
      spawnFloater(e.x, e.y, "+" + pts);
      e.dead = true;
      t.dead = true;
      sfx("explode");
      break;
    }
  }
  for (let i = 0; i < game.torpedoes.length; i++) {
    const t = game.torpedoes[i];
    if (!t.friendly || t.dead) continue;
    for (let j = 0; j < game.torpedoes.length; j++) {
      const other = game.torpedoes[j];
      if (other.friendly || other.dead || !hit(t, other)) continue;
      spawnExplosion((t.x + other.x) / 2, (t.y + other.y) / 2, "#ffe08a");
      t.dead = true;
      other.dead = true;
      break;
    }
  }
  game.torpedoes = game.torpedoes.filter((t) => !t.dead);
  game.enemies = game.enemies.filter((e) => !e.dead);

  if (game.state !== "playing") return;

  if (player.invuln <= 0) {
    for (let i = 0; i < game.enemies.length; i++) {
      if (hit(player, game.enemies[i], -2)) {
        loseLife("hit");
        return;
      }
    }
    for (let i = 0; i < game.torpedoes.length; i++) {
      const shot = game.torpedoes[i];
      if (!shot.friendly && !(shot.grace > 0) && hit(player, shot)) {
        loseLife("hit");
        return;
      }
    }
  }

  if (player.divers >= MAX_DIVERS) {
    for (let i = 0; i < game.divers.length; i++) {
      if (hit(player, game.divers[i], 4) && game.fullCd <= 0) {
        spawnFloater(player.x, player.y - 6, "FULL", "#ffb088");
        game.fullCd = 1.1;
        break;
      }
    }
    return;
  }

  for (let i = game.divers.length - 1; i >= 0; i--) {
    if (!hit(player, game.divers[i], 6)) continue;
    game.divers.splice(i, 1);
    player.divers += 1;
    spawnFloater(player.x, player.y - 6, "RESCUE", "#ffb088");
    sfx("pickup");
    if (player.divers >= MAX_DIVERS) break;
  }
}

function loseLife(reason) {
  if (game.state !== "playing" || game.deathLock) return;
  game.deathLock = true;
  const player = game.player;
  player.lives -= 1;
  game.shake = 0.85;
  game.flash = 0.45;
  spawnExplosion(player.x + player.w / 2, player.y + player.h / 2, "#ffd27a");
  spawnFloater(W / 2 - 54, H / 2, reason === "oxygen" ? "OUT OF AIR" : "HIT", "#ffd0d0");
  sfx("hit");
  if (player.lives <= 0) {
    game.state = "gameover";
    sfx("over");
    setButtons();
  } else {
    respawn();
  }
  game.deathLock = false;
}

function respawn() {
  const player = game.player;
  player.x = W / 2 - player.w / 2;
  player.y = SURFACE_Y + 12;
  player.oxygen = 100;
  player.invuln = 2.4;
  player.facing = 1;
  game.wasSurfaced = false;
  game.torpedoes = [];
  game.enemies = game.enemies.filter((e) => Math.hypot(e.x + e.w / 2 - (player.x + player.w / 2), e.y + e.h / 2 - (player.y + player.h / 2)) > 220);
  if (player.divers > 0) spawnFloater(player.x, player.y - 8, "SURFACE", "#b6ffd8");
}

function update(dt) {
  updatePlayer(dt);
  if (game.state !== "playing") return;
  updateOxygen(dt);
  if (game.state !== "playing") return;
  updateTorpedoes(dt);
  updateEnemies(dt);
  updateDivers(dt);
  updateSpawns(dt);
  handleCollisions();
}

function updateAmbient(dt) {
  for (const b of game.bubbles) {
    b.y -= b.speed * dt;
    b.x += Math.sin(seaTime * b.freq + b.phase) * 10 * dt;
    if (b.y < SURFACE_Y - 6) {
      b.y = SEABED_Y - 8;
      b.x = Math.random() * W;
    }
  }
  for (const f of game.fish) {
    f.x += f.vx * dt;
    if (f.x > W + 24) f.x = -24;
    if (f.x < -24) f.x = W + 24;
  }
}

function waveY(x, time) {
  const step = Math.floor(x / 8) * 8;
  return SURFACE_Y + Math.sin(step * 0.02 + time * 1.7) * 5 + Math.sin(step * 0.05 + time * 2.3) * 2;
}

function drawSprite(ctx2, rows, x, y, scale, palette, dir, time) {
  const cols = rows[0].length;
  const bw = cols * scale;
  ctx2.save();
  ctx2.translate(Math.round(x), Math.round(y));
  if (dir < 0) {
    ctx2.translate(bw, 0);
    ctx2.scale(-1, 1);
  }
  const propOn = Math.floor(time * 14) % 2 === 0;
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const ch = rows[r][c];
      if (ch === "." || ch === " ") continue;
      if (ch === "P" && !propOn) continue;
      const color = palette[ch];
      if (!color) continue;
      const px = c * scale;
      const py = r * scale;
      ctx2.fillStyle = "rgba(6, 14, 22, 0.7)";
      ctx2.fillRect(px - 1, py - 1, scale + 2, scale + 2);
      ctx2.fillStyle = color;
      ctx2.fillRect(px, py, scale, scale);
    }
  }
  ctx2.restore();
}

function drawWorld() {
  const sky = ctx.createLinearGradient(0, 0, 0, SURFACE_Y + 8);
  sky.addColorStop(0, "#8fd4ef");
  sky.addColorStop(1, "#d7f3fb");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, SURFACE_Y + 12);

  const sea = ctx.createLinearGradient(0, SURFACE_Y, 0, H);
  sea.addColorStop(0, "#1a8fb8");
  sea.addColorStop(0.45, "#0c5678");
  sea.addColorStop(1, "#062033");
  ctx.fillStyle = sea;
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, waveY(0, seaTime));
  for (let x = 8; x <= W; x += 8) ctx.lineTo(x, waveY(x, seaTime));
  ctx.lineTo(W, H);
  ctx.fill();

  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#e8fbff";
  for (let i = 0; i < 5; i++) {
    const x = 80 + i * 180;
    ctx.beginPath();
    ctx.moveTo(x, SURFACE_Y);
    ctx.lineTo(x + 18, SURFACE_Y);
    ctx.lineTo(x + 70 + Math.sin(seaTime + i) * 16, H);
    ctx.lineTo(x - 20, H);
    ctx.fill();
  }
  ctx.restore();

  for (const f of game.fish) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(f.vx >= 0 ? 1 : -1, 1);
    ctx.fillStyle = "rgba(214, 236, 244, 0.22)";
    ctx.fillRect(0, -2, 10, 4);
    ctx.fillRect(-5, -4, 4, 3);
    ctx.fillRect(-5, 1, 4, 3);
    ctx.restore();
  }

  ctx.fillStyle = "#c4a574";
  ctx.fillRect(0, SEABED_Y, W, H - SEABED_Y);
  ctx.fillStyle = "#a88858";
  for (let x = 0; x < W; x += 16) ctx.fillRect(x, SEABED_Y, 8, 4);

  for (const d of game.decor) {
    if (d.kind === "rock") {
      ctx.fillStyle = d.shade > 0.5 ? "#6e5844" : "#857055";
      ctx.fillRect(d.x, SEABED_Y - d.h + 8, d.w, d.h);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(d.x + 3, SEABED_Y - d.h + 10, Math.max(4, d.w * 0.3), 3);
    } else if (d.kind === "coral") {
      ctx.fillStyle = d.color;
      ctx.fillRect(d.x, SEABED_Y - d.h, 6, d.h);
      ctx.fillRect(d.x - 6, SEABED_Y - d.h * 0.7, 6, d.h * 0.7);
      ctx.fillRect(d.x + 6, SEABED_Y - d.h * 0.55, 6, d.h * 0.55);
    } else if (d.kind === "kelp") {
      const sway = Math.sin(seaTime * 1.3 + d.phase) * 12;
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(d.x, SEABED_Y);
      ctx.quadraticCurveTo(d.x + sway, SEABED_Y - d.h * 0.55, d.x + sway * 0.35, SEABED_Y - d.h);
      ctx.stroke();
    }
  }

  for (const b of game.bubbles) {
    ctx.fillStyle = "rgba(220, 245, 255, 0.45)";
    ctx.fillRect(b.x, b.y, b.r, b.r);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillRect(b.x, b.y, 1, 1);
  }

  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, waveY(0, seaTime));
  for (let x = 8; x <= W; x += 8) ctx.lineTo(x, waveY(x, seaTime));
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  for (let x = 0; x < W; x += 16) {
    const y = waveY(x, seaTime);
    ctx.fillRect(x, y - 2, 6, 2);
  }
}

function drawTorpedo(t) {
  const dir = t.vx >= 0 ? 1 : -1;
  ctx.fillStyle = t.friendly ? "rgba(255, 214, 90, 0.55)" : "rgba(255, 120, 90, 0.45)";
  ctx.fillRect(dir > 0 ? t.x - 8 : t.x + t.w, t.y + 1, 8, t.h - 2);
  ctx.fillStyle = t.friendly ? "#fff3b0" : "#ffb0a0";
  ctx.fillRect(t.x, t.y, t.w, t.h);
  ctx.fillStyle = t.friendly ? "#ff9a3c" : "#ff5a4a";
  if (dir > 0) ctx.fillRect(t.x + t.w - 4, t.y, 4, t.h);
  else ctx.fillRect(t.x, t.y, 4, t.h);
}

function drawEntities() {
  const time = game.time;
  for (const d of game.divers) {
    const frame = Math.floor(time * 6 + d.phase) % 2 === 0 ? DIVER_A : DIVER_B;
    drawSprite(ctx, frame, d.x, d.y, 2, DIVER_PALETTE, d.vx >= 0 ? 1 : -1, time);
    ctx.fillStyle = "rgba(220,245,255,0.55)";
    ctx.fillRect(d.x + 4, d.y - 6 - (time * 20 + d.phase) % 10, 2, 2);
  }
  for (const e of game.enemies) {
    if (e.type === "shark") drawSprite(ctx, SHARK, e.x, e.y, 3, SHARK_PALETTE, e.vx >= 0 ? 1 : -1, time);
    else drawSprite(ctx, PLAYER_SUB, e.x, e.y, 3, ENEMY_PALETTE, e.vx >= 0 ? 1 : -1, time);
  }
  for (const t of game.torpedoes) drawTorpedo(t);
  const player = game.player;
  const blink = player.invuln > 0 && Math.sin(game.time * 28) > 0;
  if (!blink) drawSprite(ctx, PLAYER_SUB, player.x, player.y, 3, PLAYER_PALETTE, player.facing, time);

  for (const p of game.particles) {
    ctx.globalAlpha = 1 - p.t / p.life;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
    ctx.globalAlpha = 1;
  }
  for (const e of game.explosions) {
    const p = e.t / e.life;
    ctx.globalAlpha = 1 - p;
    ctx.strokeStyle = e.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 6 + p * 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#fff2cc";
    ctx.beginPath();
    ctx.arc(e.x, e.y, 4 + p * 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.font = "bold 14px Courier New, monospace";
  for (const f of game.floaters) {
    ctx.globalAlpha = 1 - f.t / f.life;
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  }
}

function drawHUD() {
  const player = game.player;
  ctx.fillStyle = "rgba(4, 16, 28, 0.72)";
  ctx.fillRect(0, 0, W, 36);
  ctx.font = "bold 14px Courier New, monospace";
  ctx.fillStyle = "#e9f7ff";
  ctx.fillText("SCORE " + pad(game.score), 12, 23);
  ctx.fillStyle = "#f0c14b";
  ctx.fillText("HI " + pad(game.highScore), 168, 23);

  ctx.fillStyle = "#f0c14b";
  ctx.fillRect(318, 14, 16, 6);
  ctx.fillRect(324, 10, 6, 4);
  ctx.fillStyle = "#e9f7ff";
  ctx.fillText("x" + player.lives, 340, 23);

  ctx.fillText("O2", 392, 23);
  ctx.fillStyle = "#12384a";
  ctx.fillRect(420, 12, 144, 12);
  const oxygen = clamp(player.oxygen, 0, 100);
  ctx.fillStyle = oxygen > 50 ? "#3ddc97" : oxygen > OXYGEN_RED ? "#f0c14b" : "#ff5d5d";
  ctx.fillRect(422, 14, Math.max(0, (140 * oxygen) / 100), 8);
  if (oxygen <= OXYGEN_RED && Math.sin(uiTime * 10) > 0) {
    ctx.fillStyle = "#ff8d8d";
    ctx.fillText("LOW", 570, 23);
  }

  ctx.fillStyle = "#e9f7ff";
  ctx.fillText("DIVERS", 630, 23);
  for (let i = 0; i < MAX_DIVERS; i++) {
    const full = i < player.divers;
    const pulse = player.divers === MAX_DIVERS && Math.sin(uiTime * 8) > 0;
    ctx.fillStyle = full ? (pulse ? "#ffe08a" : "#ff8a3d") : "rgba(255,255,255,0.2)";
    ctx.fillRect(710 + i * 14, 13, 10, 10);
  }
  ctx.fillStyle = "#e9f7ff";
  ctx.fillText(player.divers + "/" + MAX_DIVERS, 798, 23);
}

function roundRect(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawPanel(x, y, w, h) {
  ctx.fillStyle = "rgba(6, 22, 34, 0.92)";
  ctx.strokeStyle = "#f0c14b";
  ctx.lineWidth = 3;
  roundRect(x, y, w, h);
  ctx.fill();
  ctx.stroke();
}

function drawOverlay() {
  if (game.state === "playing") return;
  ctx.fillStyle = "rgba(3, 12, 20, 0.45)";
  ctx.fillRect(0, 0, W, H);
  if (game.state === "menu") {
    drawPanel(210, 78, 540, 430);
    ctx.fillStyle = "#f0c14b";
    ctx.font = "bold 36px Courier New, monospace";
    ctx.textAlign = "center";
    ctx.fillText("DEEP SEA RESCUE", W / 2, 132);
    ctx.font = "16px Courier New, monospace";
    ctx.fillStyle = "#d7eef8";
    const lines = [
      "Pilot the sub. Rescue the divers.",
      "Surface to drop one diver",
      "and refill oxygen.",
      "",
      "Arrows or WASD  move",
      "Space            fire torpedo",
      "P                pause",
      "",
      "Surface with six for an extra life.",
      "Enemy hits or empty air cost a life.",
      "You have three lives.",
    ];
    for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], W / 2, 176 + i * 22);
    if (game.highScore > 0) {
      ctx.fillStyle = "#f0c14b";
      ctx.font = "bold 16px Courier New, monospace";
      ctx.fillText("BEST " + pad(game.highScore), W / 2, 436);
    }
    ctx.fillStyle = Math.sin(uiTime * 5) > 0 ? "#fff4c4" : "#f0c14b";
    ctx.font = "bold 18px Courier New, monospace";
    ctx.fillText("PRESS ENTER OR START", W / 2, 470);
    ctx.textAlign = "left";
  } else if (game.state === "paused") {
    drawPanel(250, 220, 460, 120);
    ctx.textAlign = "center";
    ctx.fillStyle = "#f0c14b";
    ctx.font = "bold 32px Courier New, monospace";
    ctx.fillText("PAUSED", W / 2, 274);
    ctx.fillStyle = "#d7eef8";
    ctx.font = "16px Courier New, monospace";
    ctx.fillText("Press P, Enter, or Resume", W / 2, 308);
    ctx.textAlign = "left";
  } else if (game.state === "gameover") {
    drawPanel(250, 170, 460, 230);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ff8d8d";
    ctx.font = "bold 36px Courier New, monospace";
    ctx.fillText("GAME OVER", W / 2, 224);
    ctx.fillStyle = "#e9f7ff";
    ctx.font = "bold 20px Courier New, monospace";
    ctx.fillText("SCORE  " + pad(game.score), W / 2, 270);
    ctx.fillStyle = "#f0c14b";
    ctx.fillText("BEST   " + pad(game.highScore), W / 2, 302);
    ctx.fillStyle = Math.sin(uiTime * 5) > 0 ? "#fff4c4" : "#d7eef8";
    ctx.font = "16px Courier New, monospace";
    ctx.fillText("Press Enter or Restart", W / 2, 356);
    ctx.textAlign = "left";
  }
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#062033";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  if (game.shake > 0) {
    const mag = game.shake * 6;
    ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
  }
  drawWorld();
  if (game.state !== "menu" && game.player) drawEntities();
  ctx.restore();
  if (game.state !== "menu" && game.player) drawHUD();
  if (game.flash > 0) {
    ctx.fillStyle = "rgba(255, 70, 70, " + Math.min(0.4, game.flash) + ")";
    ctx.fillRect(0, 0, W, H);
  }
  drawOverlay();
}

/* Delta time is clamped so a stalled tab cannot skip the whole oxygen bar. */
function frame(ts) {
  if (!lastTime) {
    lastTime = ts;
    render();
    requestAnimationFrame(frame);
    return;
  }
  let dt = (ts - lastTime) / 1000;
  lastTime = ts;
  if (dt > 0.05) dt = 0.05;
  if (dt < 0) dt = 0;
  uiTime += dt;
  game.flash = Math.max(0, game.flash - dt * 1.4);
  game.shake = Math.max(0, game.shake - dt * 2.2);
  if (game.state === "playing") {
    game.time += dt;
    update(dt);
  }
  if (game.state !== "paused") {
    seaTime += dt;
    updateAmbient(dt);
    updateFX(dt);
  }
  updateSiren();
  render();
  requestAnimationFrame(frame);
}

function setButtons() {
  const playing = game.state === "playing";
  const paused = game.state === "paused";
  startBtn.disabled = playing || paused;
  pauseBtn.disabled = !(playing || paused);
  pauseBtn.textContent = paused ? "Resume" : "Pause";
  restartBtn.disabled = false;
}

function startGame() {
  ensureAudio();
  game.state = "playing";
  game.score = 0;
  game.time = 0;
  game.shake = 0;
  game.flash = 0;
  game.deathLock = false;
  game.wasSurfaced = false;
  game.spawnAcc = 0.4;
  game.diverAcc = 0;
  game.fireCd = 0.2;
  game.fullCd = 0;
  game.player = makePlayer();
  game.enemies = [];
  game.divers = [];
  game.torpedoes = [];
  game.explosions = [];
  game.particles = [];
  game.floaters = [];
  spawnDiver(640, 300, -34);
  stopSiren();
  setButtons();
}

function togglePause() {
  if (game.state === "playing") game.state = "paused";
  else if (game.state === "paused") game.state = "playing";
  setButtons();
  updateSiren();
}

function onKeyDown(e) {
  const block = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"];
  if (block.indexOf(e.code) !== -1) e.preventDefault();
  keys.add(e.code);
  if (e.repeat) return;
  ensureAudio();
  if (e.code === "Enter" && (game.state === "menu" || game.state === "gameover")) startGame();
  else if (e.code === "Enter" && game.state === "paused") togglePause();
  else if (e.code === "KeyP") togglePause();
  else if (e.code === "KeyM") {
    game.muted = !game.muted;
    updateSiren();
  }
}

function onKeyUp(e) {
  keys.delete(e.code);
}

function init() {
  game.highScore = loadHighScore();
  buildDecor();
  spriteSize(SHARK, 3);
  spriteSize(DIVER_B, 2);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", () => keys.clear());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && game.state === "playing") togglePause();
  });
  startBtn.addEventListener("click", () => {
    startBtn.blur();
    startGame();
  });
  pauseBtn.addEventListener("click", () => {
    pauseBtn.blur();
    togglePause();
  });
  restartBtn.addEventListener("click", () => {
    restartBtn.blur();
    startGame();
  });
  canvas.addEventListener("pointerdown", () => {
    ensureAudio();
    if (game.state === "menu" || game.state === "gameover") startGame();
  });
  setButtons();
  if (!loopStarted) {
    loopStarted = true;
    requestAnimationFrame(frame);
  }
}

init();
