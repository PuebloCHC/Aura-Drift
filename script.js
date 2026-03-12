const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const powerEl = document.getElementById("power");
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
  width: 56,
  height: 42,
  glow: 0,
  power: 1,
  wingPhase: 0,
  firing: false
};

let enemies = [];
let orbs = [];
let bullets = [];
let stars = [];

let enemyTimer = 0;
let orbTimer = 0;
let bulletTimer = 0;
let lastTime = 0;

let activeTouchId = null;
let dragging = false;
let dragOffsetX = 0;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

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

  player.y = viewHeight * 0.82;

  if (!gameRunning) {
    player.x = viewWidth / 2;
  } else {
    player.x = clamp(player.x, player.width / 2, viewWidth - player.width / 2);
  }
}

function resetGame() {
  score = 0;
  player.power = 1;
  player.glow = 0;
  player.firing = false;
  player.wingPhase = 0;

  enemies = [];
  orbs = [];
  bullets = [];
  stars = [];

  enemyTimer = 0;
  orbTimer = 0;
  bulletTimer = 0;

  activeTouchId = null;
  dragging = false;
  dragOffsetX = 0;

  player.x = viewWidth / 2;
  player.y = viewHeight * 0.82;

  scoreEl.textContent = "Score: 0";
  powerEl.textContent = "Power: 1";

  for (let i = 0; i < 90; i++) {
    stars.push({
      x: Math.random() * viewWidth,
      y: Math.random() * viewHeight,
      r: Math.random() * 2 + 1,
      speed: Math.random() * 0.6 + 0.2
    });
  }
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
  player.firing = false;

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
    <button id="startBtn">Play Again</button>
  `;
}

function spawnEnemy() {
  const size = Math.random() * 16 + 20;
  enemies.push({
    x: Math.random() * (viewWidth - size * 2) + size,
    y: -size - 10,
    radius: size,
    speed: Math.random() * 1.6 + 1.8,
    hp: Math.max(1, Math.floor(player.power * 0.35) + 1),
    wiggle: Math.random() * Math.PI * 2
  });
}

function spawnOrb(x = null, y = null) {
  orbs.push({
    x: x ?? (Math.random() * (viewWidth - 24) + 12),
    y: y ?? -20,
    radius: 10,
    speed: 2.4
  });
}

function shoot() {
  const bulletSpeed = 8 + player.power * 0.4;
  const damage = Math.max(1, Math.floor(player.power * 0.75));

  if (player.power < 4) {
    bullets.push({ x: player.x, y: player.y - 22, radius: 5, speed: bulletSpeed, damage });
    return;
  }

  if (player.power < 8) {
    bullets.push(
      { x: player.x - 10, y: player.y - 18, radius: 5, speed: bulletSpeed, damage },
      { x: player.x + 10, y: player.y - 18, radius: 5, speed: bulletSpeed, damage }
    );
    return;
  }

  bullets.push(
    { x: player.x, y: player.y - 24, radius: 6, speed: bulletSpeed + 0.6, damage: damage + 1 },
    { x: player.x - 14, y: player.y - 18, radius: 5, speed: bulletSpeed, damage },
    { x: player.x + 14, y: player.y - 18, radius: 5, speed: bulletSpeed, damage }
  );
}

function circleHit(ax, ay, ar, bx, by, br) {
  return Math.hypot(ax - bx, ay - by) < ar + br;
}

function update(dt) {
  for (const star of stars) {
    star.y += star.speed * dt * 0.05;
    if (star.y > viewHeight) {
      star.y = -5;
      star.x = Math.random() * viewWidth;
    }
  }

  player.x = clamp(player.x, player.width / 2, viewWidth - player.width / 2);
  player.y = viewHeight * 0.82;
  player.glow = Math.max(0, player.glow - dt * 0.008);
  player.wingPhase += dt * 0.02;

  enemyTimer += dt;
  orbTimer += dt;
  bulletTimer += dt;

  const enemyDelay = Math.max(280, 900 - player.power * 18);
  const bulletDelay = Math.max(105, 330 - player.power * 10);

  if (enemyTimer >= enemyDelay) {
    spawnEnemy();
    enemyTimer = 0;
  }

  if (orbTimer >= 1350) {
    spawnOrb();
    orbTimer = 0;
  }

  if (player.firing && bulletTimer >= bulletDelay) {
    shoot();
    bulletTimer = 0;
  }

  for (const enemy of enemies) {
    enemy.y += enemy.speed * dt * 0.06;
    enemy.x += Math.sin(enemy.y * 0.03 + enemy.wiggle) * 0.35;
  }

  for (const orb of orbs) {
    orb.y += orb.speed * dt * 0.06;
  }

  for (const bullet of bullets) {
    bullet.y -= bullet.speed * dt * 0.06;
  }

  enemies = enemies.filter(enemy => enemy.y < viewHeight + 60 && enemy.hp > 0);
  orbs = orbs.filter(orb => orb.y < viewHeight + 40);
  bullets = bullets.filter(bullet => bullet.y > -30);

  const playerHitRadius = 18;

  for (const enemy of enemies) {
    if (circleHit(enemy.x, enemy.y, enemy.radius, player.x, player.y, playerHitRadius)) {
      endGame();
      return;
    }
  }

  for (let i = orbs.length - 1; i >= 0; i--) {
    const orb = orbs[i];
    if (circleHit(orb.x, orb.y, orb.radius, player.x, player.y, playerHitRadius)) {
      orbs.splice(i, 1);
      player.power += 1;
      player.glow = 1;
      score += 15;
      powerEl.textContent = `Power: ${player.power}`;
    }
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    let used = false;

    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j];
      if (circleHit(bullet.x, bullet.y, bullet.radius, enemy.x, enemy.y, enemy.radius)) {
        enemy.hp -= bullet.damage;
        bullets.splice(i, 1);
        used = true;

        if (enemy.hp <= 0) {
          score += 20;
          enemies.splice(j, 1);
          if (Math.random() < 0.35) {
            spawnOrb(enemy.x, enemy.y);
          }
        }
        break;
      }
    }

    if (used) continue;
  }

  score += dt * 0.004;
  scoreEl.textContent = `Score: ${Math.floor(score)}`;
}

function drawBackground() {
  for (const star of stars) {
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fill();
  }
}

function drawDragon() {
  const x = player.x;
  const y = player.y;
  const flap = Math.sin(player.wingPhase) * 8;
  const glowSize = 30 + player.glow * 22;

  const aura = ctx.createRadialGradient(x, y, 4, x, y, glowSize);
  aura.addColorStop(0, "rgba(80,220,255,0.35)");
  aura.addColorStop(0.5, "rgba(80,220,255,0.15)");
  aura.addColorStop(1, "rgba(80,220,255,0)");
  ctx.beginPath();
  ctx.arc(x, y, glowSize, 0, Math.PI * 2);
  ctx.fillStyle = aura;
  ctx.fill();

  ctx.fillStyle = "#5ce1e6";
  ctx.beginPath();
  ctx.moveTo(x - 8, y + 4);
  ctx.lineTo(x - 26, y - 10 - flap * 0.35);
  ctx.lineTo(x - 14, y + 10);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x + 8, y + 4);
  ctx.lineTo(x + 26, y - 10 - flap * 0.35);
  ctx.lineTo(x + 14, y + 10);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#2fd0ff";
  ctx.beginPath();
  ctx.moveTo(x, y - 22);
  ctx.lineTo(x - 12, y - 4);
  ctx.lineTo(x - 12, y + 12);
  ctx.lineTo(x, y + 18);
  ctx.lineTo(x + 12, y + 12);
  ctx.lineTo(x + 12, y - 4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#0e86c9";
  ctx.beginPath();
  ctx.moveTo(x, y + 18);
  ctx.lineTo(x - 6, y + 30);
  ctx.lineTo(x, y + 24);
  ctx.lineTo(x + 6, y + 30);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#baf8ff";
  ctx.beginPath();
  ctx.arc(x - 4, y - 10, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 4, y - 10, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 22);
  ctx.lineTo(x - 1, y - 28);
  ctx.lineTo(x + 1, y - 22);
  ctx.moveTo(x + 5, y - 22);
  ctx.lineTo(x + 1, y - 28);
  ctx.lineTo(x - 1, y - 22);
  ctx.stroke();
}

function drawEnemies() {
  for (const enemy of enemies) {
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius + 8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,80,80,0.13)";
    ctx.fill();

    ctx.fillStyle = "#ff655f";
    ctx.beginPath();
    ctx.moveTo(enemy.x, enemy.y - enemy.radius);
    ctx.lineTo(enemy.x - enemy.radius * 0.75, enemy.y + enemy.radius * 0.8);
    ctx.lineTo(enemy.x + enemy.radius * 0.75, enemy.y + enemy.radius * 0.8);
    ctx.closePath();
    ctx.fill();
  }
}

function drawOrbs() {
  for (const orb of orbs) {
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.radius + 8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(80,180,255,0.18)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#66ccff";
    ctx.fill();
  }
}

function drawBullets() {
  for (const bullet of bullets) {
    const grad = ctx.createRadialGradient(bullet.x, bullet.y, 1, bullet.x, bullet.y, bullet.radius * 3);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(120,230,255,0.95)");
    grad.addColorStop(1, "rgba(120,230,255,0)");
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius * 3, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#bfffff";
    ctx.fill();
  }
}

function draw() {
  ctx.clearRect(0, 0, viewWidth, viewHeight);
  drawBackground();
  drawOrbs();
  drawEnemies();
  drawBullets();
  drawDragon();
}

function gameLoop(timestamp) {
  if (!gameRunning) return;

  const dt = Math.min(32, timestamp - lastTime);
  lastTime = timestamp;

  update(dt);
  draw();

  if (gameRunning) {
    requestAnimationFrame(gameLoop);
  }
}

function getCanvasXFromClientX(clientX) {
  const rect = canvas.getBoundingClientRect();
  return clientX - rect.left;
}

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  if (!gameRunning) return;
  if (activeTouchId !== null) return;

  const touch = e.changedTouches[0];
  activeTouchId = touch.identifier;
  dragging = true;
  player.firing = true;
  bulletTimer = 9999;

  const touchX = getCanvasXFromClientX(touch.clientX);
  dragOffsetX = touchX - player.x;
  player.x = clamp(touchX - dragOffsetX, player.width / 2, viewWidth - player.width / 2);
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  if (activeTouchId === null || !dragging) return;

  for (const touch of e.touches) {
    if (touch.identifier === activeTouchId) {
      const touchX = getCanvasXFromClientX(touch.clientX);
      player.x = clamp(touchX - dragOffsetX, player.width / 2, viewWidth - player.width / 2);
      break;
    }
  }
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
  for (const touch of e.changedTouches) {
    if (touch.identifier === activeTouchId) {
      activeTouchId = null;
      dragging = false;
      player.firing = false;
      break;
    }
  }
});

canvas.addEventListener("touchcancel", (e) => {
  for (const touch of e.changedTouches) {
    if (touch.identifier === activeTouchId) {
      activeTouchId = null;
      dragging = false;
      player.firing = false;
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
draw();
