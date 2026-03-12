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
  width: 68,
  height: 48,
  glow: 0,
  power: 1,
  firing: false,
  fireBreath: 0
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
  player.fireBreath = 0;

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
      r: Math.random() * 2 + 0.5,
      speed: Math.random() * 0.8 + 0.2
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
  player.fireBreath = 0;

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
    speed: Math.random() * 1.8 + 1.6,
    hp: Math.max(1, Math.floor(1 + player.power * 0.4))
  });
}

function spawnOrb() {
  orbs.push({
    x: Math.random() * (viewWidth - 24) + 12,
    y: -20,
    radius: 10,
    speed: 2.4
  });
}

function shoot() {
  const baseSpeed = 8 + player.power * 0.3;
  const damage = Math.max(1, Math.floor(player.power * 0.7));

  if (player.power < 4) {
    bullets.push({ x: player.x + 24, y: player.y - 2, radius: 5, speed: baseSpeed, damage, vx: 0 });
    return;
  }

  if (player.power < 8) {
    bullets.push(
      { x: player.x + 24, y: player.y - 6, radius: 5, speed: baseSpeed, damage, vx: -0.4 },
      { x: player.x + 24, y: player.y + 4, radius: 5, speed: baseSpeed, damage, vx: 0.4 }
    );
    return;
  }

  bullets.push(
    { x: player.x + 26, y: player.y - 8, radius: 6, speed: baseSpeed + 0.5, damage: damage + 1, vx: 0 },
    { x: player.x + 20, y: player.y - 14, radius: 5, speed: baseSpeed, damage, vx: -0.7 },
    { x: player.x + 20, y: player.y + 10, radius: 5, speed: baseSpeed, damage, vx: 0.7 }
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
  player.glow = Math.max(0, player.glow - dt * 0.007);
  player.fireBreath = player.firing ? Math.min(1, player.fireBreath + dt * 0.01) : Math.max(0, player.fireBreath - dt * 0.015);

  enemyTimer += dt;
  orbTimer += dt;
  bulletTimer += dt;

  const enemyDelay = Math.max(260, 900 - player.power * 20);
  const bulletDelay = Math.max(100, 340 - player.power * 10);

  if (enemyTimer >= enemyDelay) {
    spawnEnemy();
    enemyTimer = 0;
  }

  if (orbTimer >= 1250) {
    spawnOrb();
    orbTimer = 0;
  }

  if (player.firing && bulletTimer >= bulletDelay) {
    shoot();
    bulletTimer = 0;
  }

  for (const enemy of enemies) enemy.y += enemy.speed * dt * 0.06;
  for (const orb of orbs) orb.y += orb.speed * dt * 0.06;
  for (const bullet of bullets) {
    bullet.x += bullet.vx * dt * 0.06;
    bullet.y -= bullet.speed * dt * 0.06;
  }

  enemies = enemies.filter(enemy => enemy.y < viewHeight + 60 && enemy.hp > 0);
  orbs = orbs.filter(orb => orb.y < viewHeight + 40);
  bullets = bullets.filter(bullet => bullet.y > -30 && bullet.x > -20 && bullet.x < viewWidth + 20);

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
          if (Math.random() < 0.3) {
            orbs.push({ x: enemy.x, y: enemy.y, radius: 10, speed: 2.1 });
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
  const flap = Math.sin(performance.now() * 0.015) * 8;
  const glowSize = 24 + player.glow * 18;

  const gradient = ctx.createRadialGradient(x, y, 6, x, y, glowSize + 10);
  gradient.addColorStop(0, "rgba(80,220,255,0.45)");
  gradient.addColorStop(1, "rgba(80,220,255,0)");
  ctx.beginPath();
  ctx.arc(x, y, glowSize + 8, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Wings
  ctx.fillStyle = "#4fd6ff";
  ctx.beginPath();
  ctx.moveTo(x - 8, y - 4);
  ctx.quadraticCurveTo(x - 34, y - 28 - flap, x - 18, y + 3);
  ctx.quadraticCurveTo(x - 30, y + 10, x - 6, y + 8);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x - 2, y - 2);
  ctx.quadraticCurveTo(x - 24, y + 22 + flap * 0.4, x - 5, y + 12);
  ctx.quadraticCurveTo(x - 18, y + 18, x + 2, y + 8);
  ctx.closePath();
  ctx.fill();

  // Tail
  ctx.strokeStyle = "#2cb7e8";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - 18, y + 2);
  ctx.quadraticCurveTo(x - 34, y + 6, x - 42, y - 2);
  ctx.stroke();

  // Body
  ctx.fillStyle = "#27c1ff";
  ctx.beginPath();
  ctx.ellipse(x, y, 22, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Belly
  ctx.fillStyle = "#a6efff";
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 2, 11, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Neck and head
  ctx.fillStyle = "#27c1ff";
  ctx.beginPath();
  ctx.ellipse(x + 22, y - 3, 13, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Horns
  ctx.fillStyle = "#d7f8ff";
  ctx.beginPath();
  ctx.moveTo(x + 27, y - 12);
  ctx.lineTo(x + 31, y - 21);
  ctx.lineTo(x + 22, y - 15);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x + 19, y - 12);
  ctx.lineTo(x + 20, y - 21);
  ctx.lineTo(x + 14, y - 14);
  ctx.closePath();
  ctx.fill();

  // Eye
  ctx.fillStyle = "#04131f";
  ctx.beginPath();
  ctx.arc(x + 26, y - 5, 2.3, 0, Math.PI * 2);
  ctx.fill();

  // Snout
  ctx.fillStyle = "#a6efff";
  ctx.beginPath();
  ctx.ellipse(x + 32, y - 1, 7, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Fire breath while firing
  if (player.fireBreath > 0.05) {
    const len = 18 + player.fireBreath * 22;
    ctx.fillStyle = `rgba(255, ${160 + Math.floor(player.fireBreath * 60)}, 60, 0.9)`;
    ctx.beginPath();
    ctx.moveTo(x + 35, y - 4);
    ctx.quadraticCurveTo(x + 40 + len, y, x + 35, y + 4);
    ctx.closePath();
    ctx.fill();
  }
}

function drawEnemies() {
  for (const enemy of enemies) {
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius + 8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,80,80,0.16)";
    ctx.fill();

    ctx.fillStyle = "#f05656";
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff0f0";
    ctx.beginPath();
    ctx.arc(enemy.x - enemy.radius * 0.25, enemy.y - enemy.radius * 0.15, 2.5, 0, Math.PI * 2);
    ctx.arc(enemy.x + enemy.radius * 0.25, enemy.y - enemy.radius * 0.15, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawOrbs() {
  for (const orb of orbs) {
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.radius + 7, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(80,180,255,0.2)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#66ccff";
    ctx.fill();
  }
}

function drawBullets() {
  for (const bullet of bullets) {
    const gradient = ctx.createRadialGradient(bullet.x, bullet.y, 1, bullet.x, bullet.y, bullet.radius + 5);
    gradient.addColorStop(0, "rgba(255,255,200,1)");
    gradient.addColorStop(1, "rgba(255,120,40,0)");
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius + 4, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#ffb347";
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
  player.firing = true;
  bulletTimer = 9999;
  const touchX = getCanvasXFromClientX(touch.clientX);
  dragOffsetX = touchX - player.x;
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  if (activeTouchId === null || !dragging) return;
  for (const touch of e.touches) {
    if (touch.identifier === activeTouchId) {
      const touchX = getCanvasXFromClientX(touch.clientX);
      player.x = touchX - dragOffsetX;
      player.x = clamp(player.x, player.width / 2, viewWidth - player.width / 2);
      break;
    }
  }
}, { passive: false });

function releaseTouch(changedTouches) {
  for (const touch of changedTouches) {
    if (touch.identifier === activeTouchId) {
      activeTouchId = null;
      dragging = false;
      player.firing = false;
      break;
    }
  }
}

canvas.addEventListener("touchend", (e) => releaseTouch(e.changedTouches));
canvas.addEventListener("touchcancel", (e) => releaseTouch(e.changedTouches));

document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "startBtn") startGame();
});

window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", resizeCanvas);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", resizeCanvas);
}

resizeCanvas();
draw();
