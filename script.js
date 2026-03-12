const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const powerEl = document.getElementById("power");
const chargeBarEl = document.getElementById("chargeBar");
const chargeTextEl = document.getElementById("chargeText");
const messageEl = document.getElementById("message");

let viewWidth = 0;
let viewHeight = 0;
let dpr = 1;

let gameRunning = false;
let score = 0;
let best = Number(localStorage.getItem("auraDriftBest") || 0);

bestEl.textContent = `Best: ${best}`;

const player = {
  x: 0,
  y: 0,
  baseYRatio: 0.82,
  radius: 24,
  glow: 0,
  flap: 0,
  wingLift: 0,
  power: 1,
  aura: 0,
  fireCooldown: 0,
  fireRateMs: 430
};

let enemies = [];
let orbs = [];
let bullets = [];
let stars = [];
let particles = [];
let enemySpawnTimer = 0;
let orbSpawnTimer = 0;
let lastTime = 0;

let activeTouchId = null;
let dragging = false;
let dragOffsetX = 0;

function resizeCanvas() {
  dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
  const vv = window.visualViewport;
  viewWidth = Math.round(vv ? vv.width : window.innerWidth);
  viewHeight = Math.round(vv ? vv.height : window.innerHeight);

  canvas.style.width = `${viewWidth}px`;
  canvas.style.height = `${viewHeight}px`;
  canvas.width = Math.floor(viewWidth * dpr);
  canvas.height = Math.floor(viewHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (!gameRunning) {
    player.x = viewWidth / 2;
  }
  player.y = viewHeight * player.baseYRatio;
  player.x = clamp(player.x, player.radius, viewWidth - player.radius);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function resetGame() {
  score = 0;
  player.x = viewWidth / 2;
  player.y = viewHeight * player.baseYRatio;
  player.glow = 0;
  player.flap = 0;
  player.wingLift = 0;
  player.power = 1;
  player.aura = 0;
  player.fireCooldown = 0;
  player.fireRateMs = 430;

  enemies = [];
  orbs = [];
  bullets = [];
  stars = [];
  particles = [];
  enemySpawnTimer = 0;
  orbSpawnTimer = 0;
  lastTime = 0;
  activeTouchId = null;
  dragging = false;
  dragOffsetX = 0;

  for (let i = 0; i < 80; i++) {
    stars.push({
      x: Math.random() * viewWidth,
      y: Math.random() * viewHeight,
      r: Math.random() * 2 + 0.5,
      speed: Math.random() * 0.45 + 0.15,
      alpha: Math.random() * 0.7 + 0.2
    });
  }

  updateHud();
}

function startGame() {
  resetGame();
  gameRunning = true;
  messageEl.classList.add("hidden");
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function endGame() {
  gameRunning = false;
  const finalScore = Math.floor(score);

  if (finalScore > best) {
    best = finalScore;
    localStorage.setItem("auraDriftBest", best);
    bestEl.textContent = `Best: ${best}`;
  }

  activeTouchId = null;
  dragging = false;

  messageEl.classList.remove("hidden");
  messageEl.innerHTML = `
    <h1>Game Over</h1>
    <p>Score: ${finalScore}</p>
    <p>Best: ${best}</p>
    <p>Power Reached: ${player.power}</p>
    <button id="startBtn">Play Again</button>
  `;
}

function updateHud() {
  scoreEl.textContent = `Score: ${Math.floor(score)}`;
  powerEl.textContent = `Power: ${player.power}`;
  const auraNeeded = 100;
  chargeBarEl.style.width = `${Math.min(100, (player.aura / auraNeeded) * 100)}%`;
  chargeTextEl.textContent = `Aura: ${player.aura} / ${auraNeeded}`;
}

function spawnEnemy() {
  const size = Math.random() * 12 + 16 + player.power * 0.35;
  const health = 1 + Math.floor((player.power - 1) / 2) + (Math.random() < 0.25 ? 1 : 0);
  enemies.push({
    x: Math.random() * (viewWidth - size * 2) + size,
    y: -size - 10,
    radius: size,
    speed: Math.random() * 1.8 + 1.9 + player.power * 0.05,
    health,
    maxHealth: health,
    wobble: Math.random() * Math.PI * 2,
    wobbleSpeed: Math.random() * 0.04 + 0.015,
    type: Math.random() < 0.5 ? "ember" : "shard"
  });
}

function spawnOrb(x = null, y = null, bonus = 12) {
  const size = 9;
  orbs.push({
    x: x ?? Math.random() * (viewWidth - size * 2) + size,
    y: y ?? -size,
    radius: size,
    speed: 2.7,
    auraValue: bonus,
    drift: Math.random() * Math.PI * 2
  });
}

function fireBullet() {
  const shots = Math.min(3, 1 + Math.floor((player.power - 1) / 3));
  const spread = shots === 1 ? [0] : shots === 2 ? [-10, 10] : [-18, 0, 18];
  const damage = 1 + Math.floor((player.power - 1) / 4);

  for (const offset of spread) {
    bullets.push({
      x: player.x + offset,
      y: player.y - 28,
      radius: 5 + Math.min(3, Math.floor(player.power / 5)),
      speed: 7.4,
      damage,
      hueShift: Math.random() * 0.25
    });
  }

  player.glow = 1.2;
  spawnBurst(player.x, player.y - 20, 4, "rgba(120,220,255,0.8)", 1.8);
}

function addAura(amount) {
  player.aura += amount;
  while (player.aura >= 100) {
    player.aura -= 100;
    player.power += 1;
    player.radius = Math.min(34, 24 + player.power * 0.8);
    player.fireRateMs = Math.max(160, 430 - (player.power - 1) * 22);
    spawnBurst(player.x, player.y, 18, "rgba(160,255,190,0.95)", 2.8);
  }
}

function spawnBurst(x, y, amount, color, speedScale = 1) {
  for (let i = 0; i < amount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (Math.random() * 1.9 + 0.8) * speedScale;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: Math.random() * 28 + 18,
      maxLife: 40,
      size: Math.random() * 4 + 2,
      color
    });
  }
}

function update(dt) {
  player.flap += dt * 0.02;
  player.wingLift = Math.sin(player.flap) * 4;

  for (const star of stars) {
    star.y += star.speed * dt * 0.06;
    if (star.y > viewHeight + 5) {
      star.y = -5;
      star.x = Math.random() * viewWidth;
    }
  }

  player.x = clamp(player.x, player.radius, viewWidth - player.radius);
  player.y = viewHeight * player.baseYRatio + player.wingLift;
  player.glow = Math.max(0, player.glow - dt * 0.0045);

  player.fireCooldown -= dt;
  if (player.fireCooldown <= 0) {
    fireBullet();
    player.fireCooldown = player.fireRateMs;
  }

  enemySpawnTimer += dt;
  orbSpawnTimer += dt;

  const enemyInterval = Math.max(280, 820 - player.power * 18);
  if (enemySpawnTimer >= enemyInterval) {
    spawnEnemy();
    enemySpawnTimer = 0;
  }

  if (orbSpawnTimer >= 1450) {
    spawnOrb();
    orbSpawnTimer = 0;
  }

  for (const enemy of enemies) {
    enemy.wobble += enemy.wobbleSpeed * dt;
    enemy.x += Math.sin(enemy.wobble) * 0.55;
    enemy.y += enemy.speed * dt * 0.06;
  }

  for (const orb of orbs) {
    orb.drift += 0.02 * dt;
    orb.y += orb.speed * dt * 0.06;
    orb.x += Math.sin(orb.drift) * 0.35;
  }

  for (const bullet of bullets) {
    bullet.y -= bullet.speed * dt * 0.06;
  }

  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.life -= dt * 0.06;
    p.vx *= 0.985;
    p.vy *= 0.985;
  }

  enemies = enemies.filter((e) => e.y < viewHeight + 80 && e.health > 0);
  orbs = orbs.filter((o) => o.y < viewHeight + 50);
  bullets = bullets.filter((b) => b.y > -30);
  particles = particles.filter((p) => p.life > 0);

  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    const bullet = bullets[bi];
    let hit = false;

    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const enemy = enemies[ei];
      const dx = enemy.x - bullet.x;
      const dy = enemy.y - bullet.y;
      const dist = Math.hypot(dx, dy);

      if (dist < enemy.radius + bullet.radius) {
        enemy.health -= bullet.damage;
        spawnBurst(bullet.x, bullet.y, 5, "rgba(100,190,255,0.9)", 1.2);
        bullets.splice(bi, 1);
        hit = true;

        if (enemy.health <= 0) {
          score += 20 + enemy.maxHealth * 5;
          spawnBurst(enemy.x, enemy.y, 12, "rgba(255,120,90,0.95)", 2.1);
          spawnOrb(enemy.x, enemy.y, 14 + enemy.maxHealth * 4);
          enemies.splice(ei, 1);
        }
        break;
      }
    }

    if (hit) continue;
  }

  for (const enemy of enemies) {
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < enemy.radius + player.radius * 0.8) {
      endGame();
      return;
    }
  }

  for (let i = orbs.length - 1; i >= 0; i--) {
    const orb = orbs[i];
    const dx = orb.x - player.x;
    const dy = orb.y - player.y;
    const dist = Math.hypot(dx, dy);

    if (dist < orb.radius + player.radius) {
      orbs.splice(i, 1);
      addAura(orb.auraValue);
      player.glow = 1.4;
      score += 6;
      spawnBurst(orb.x, orb.y, 7, "rgba(110,220,255,0.9)", 1.4);
    }
  }

  score += dt * 0.0032;
  updateHud();
}

function drawBackground() {
  for (const star of stars) {
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${star.alpha})`;
    ctx.fill();
  }
}

function drawDragon() {
  const x = player.x;
  const y = player.y;
  const scale = player.radius / 24;
  const flap = Math.sin(player.flap) * 0.9;
  const glowRadius = 38 + player.glow * 16 + player.power * 1.7;

  const glow = ctx.createRadialGradient(x, y, 6, x, y, glowRadius);
  glow.addColorStop(0, "rgba(120,220,255,0.8)");
  glow.addColorStop(0.45, "rgba(110,200,255,0.35)");
  glow.addColorStop(1, "rgba(110,200,255,0)");
  ctx.beginPath();
  ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);

  ctx.strokeStyle = "rgba(180,245,255,0.55)";
  ctx.lineWidth = 2.5 * scale;
  ctx.lineCap = "round";

  // Tail
  ctx.beginPath();
  ctx.moveTo(-4 * scale, 18 * scale);
  ctx.quadraticCurveTo(-1 * scale, 30 * scale, 4 * scale, 38 * scale);
  ctx.stroke();

  // Left wing
  ctx.beginPath();
  ctx.moveTo(-6 * scale, 2 * scale);
  ctx.quadraticCurveTo(-28 * scale, (-16 - flap * 6) * scale, -42 * scale, (10 + flap * 8) * scale);
  ctx.quadraticCurveTo(-28 * scale, 4 * scale, -10 * scale, 11 * scale);
  ctx.closePath();
  ctx.fillStyle = "rgba(95,175,255,0.42)";
  ctx.fill();
  ctx.stroke();

  // Right wing
  ctx.beginPath();
  ctx.moveTo(6 * scale, 2 * scale);
  ctx.quadraticCurveTo(28 * scale, (-16 - flap * 6) * scale, 42 * scale, (10 + flap * 8) * scale);
  ctx.quadraticCurveTo(28 * scale, 4 * scale, 10 * scale, 11 * scale);
  ctx.closePath();
  ctx.fillStyle = "rgba(95,175,255,0.42)";
  ctx.fill();
  ctx.stroke();

  // Body
  const bodyGrad = ctx.createLinearGradient(0, -18 * scale, 0, 18 * scale);
  bodyGrad.addColorStop(0, "#b8f6ff");
  bodyGrad.addColorStop(0.45, "#64c8ff");
  bodyGrad.addColorStop(1, "#2682d8");
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(0, -22 * scale);
  ctx.quadraticCurveTo(16 * scale, -8 * scale, 12 * scale, 16 * scale);
  ctx.quadraticCurveTo(0, 26 * scale, -12 * scale, 16 * scale);
  ctx.quadraticCurveTo(-16 * scale, -8 * scale, 0, -22 * scale);
  ctx.closePath();
  ctx.fill();

  // Belly highlight
  ctx.fillStyle = "rgba(220,255,255,0.42)";
  ctx.beginPath();
  ctx.ellipse(0, 6 * scale, 5 * scale, 10 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Horns
  ctx.fillStyle = "#d6ffff";
  ctx.beginPath();
  ctx.moveTo(-7 * scale, -18 * scale);
  ctx.lineTo(-12 * scale, -27 * scale);
  ctx.lineTo(-4 * scale, -21 * scale);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(7 * scale, -18 * scale);
  ctx.lineTo(12 * scale, -27 * scale);
  ctx.lineTo(4 * scale, -21 * scale);
  ctx.closePath();
  ctx.fill();

  // Head details
  ctx.fillStyle = "#efffff";
  ctx.beginPath();
  ctx.ellipse(0, -14 * scale, 8 * scale, 10 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = "#0b1a2d";
  ctx.beginPath();
  ctx.arc(-3 * scale, -15 * scale, 1.6 * scale, 0, Math.PI * 2);
  ctx.arc(3 * scale, -15 * scale, 1.6 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Chest gem
  ctx.fillStyle = player.power >= 5 ? "#9dffb6" : "#7df1ff";
  ctx.beginPath();
  ctx.arc(0, 4 * scale, 3.2 * scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawEnemies() {
  for (const enemy of enemies) {
    const dangerGlow = ctx.createRadialGradient(enemy.x, enemy.y, 4, enemy.x, enemy.y, enemy.radius + 14);
    dangerGlow.addColorStop(0, "rgba(255,140,90,0.7)");
    dangerGlow.addColorStop(1, "rgba(255,100,70,0)");
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius + 12, 0, Math.PI * 2);
    ctx.fillStyle = dangerGlow;
    ctx.fill();

    const grad = ctx.createLinearGradient(enemy.x, enemy.y - enemy.radius, enemy.x, enemy.y + enemy.radius);
    grad.addColorStop(0, enemy.type === "ember" ? "#ffcf72" : "#ff9d7a");
    grad.addColorStop(1, enemy.type === "ember" ? "#ff5b43" : "#b32839");
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.beginPath();
    ctx.arc(enemy.x - enemy.radius * 0.25, enemy.y - enemy.radius * 0.25, enemy.radius * 0.3, 0, Math.PI * 2);
    ctx.fill();

    if (enemy.maxHealth > 1) {
      const width = enemy.radius * 1.6;
      const healthPct = enemy.health / enemy.maxHealth;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 10, width, 5);
      ctx.fillStyle = "#9dffb6";
      ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 10, width * healthPct, 5);
    }
  }
}

function drawOrbs() {
  for (const orb of orbs) {
    const glow = ctx.createRadialGradient(orb.x, orb.y, 2, orb.x, orb.y, orb.radius + 10);
    glow.addColorStop(0, "rgba(160,245,255,0.95)");
    glow.addColorStop(1, "rgba(100,200,255,0)");
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.radius + 8, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#74e7ff";
    ctx.fill();
  }
}

function drawBullets() {
  for (const bullet of bullets) {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius + 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(120,220,255,0.22)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#d9ffff";
    ctx.fill();
  }
}

function drawParticles() {
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fillStyle = p.color.replace(/rgba\(([^)]+),\s*[^)]+\)/, (m, vals) => `rgba(${vals}, ${alpha})`);
    ctx.fill();
  }
}

function draw() {
  ctx.clearRect(0, 0, viewWidth, viewHeight);
  drawBackground();
  drawOrbs();
  drawBullets();
  drawEnemies();
  drawParticles();
  drawDragon();
}

function gameLoop(timestamp) {
  if (!gameRunning) return;

  const dt = Math.min(32, timestamp - lastTime);
  lastTime = timestamp;

  update(dt);
  draw();

  if (gameRunning) requestAnimationFrame(gameLoop);
}

function getCanvasXFromClientX(clientX) {
  const rect = canvas.getBoundingClientRect();
  return clientX - rect.left;
}

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  if (activeTouchId !== null) return;

  const touch = e.changedTouches[0];
  activeTouchId = touch.identifier;
  dragging = true;

  const touchX = getCanvasXFromClientX(touch.clientX);
  dragOffsetX = touchX - player.x;
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  if (activeTouchId === null || !dragging) return;

  for (const touch of e.touches) {
    if (touch.identifier === activeTouchId) {
      const touchX = getCanvasXFromClientX(touch.clientX);
      player.x = clamp(touchX - dragOffsetX, player.radius, viewWidth - player.radius);
      break;
    }
  }
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
  for (const touch of e.changedTouches) {
    if (touch.identifier === activeTouchId) {
      activeTouchId = null;
      dragging = false;
      break;
    }
  }
});

canvas.addEventListener("touchcancel", (e) => {
  for (const touch of e.changedTouches) {
    if (touch.identifier === activeTouchId) {
      activeTouchId = null;
      dragging = false;
      break;
    }
  }
});

document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "startBtn") {
    startGame();
  }
});

window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", resizeCanvas);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", resizeCanvas);
}

resizeCanvas();
resetGame();
draw();
