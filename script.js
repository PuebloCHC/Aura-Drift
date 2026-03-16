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

const player = {
  x: 0,
  y: 0,
  width: 96,
  height: 120,
  power: 1,
  glow: 0,
  firing: false,
  firePulse: 0
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

bestEl.textContent = `Best: ${best}`;
powerEl.textContent = `Power: ${player.power}`;

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
    player.x = clamp(player.x, player.width * 0.28, viewWidth - player.width * 0.28);
  }
}

function resetGame() {
  score = 0;
  player.power = 1;
  player.glow = 0;
  player.firing = false;
  player.firePulse = 0;
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
      r: Math.random() * 2.4 + 0.6,
      speed: Math.random() * 0.55 + 0.15
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
  const finalScore = Math.floor(score);
  if (finalScore > best) {
    best = finalScore;
    localStorage.setItem("auraDriftBest", best);
    bestEl.textContent = `Best: ${best}`;
  }
  activeTouchId = null;
  dragging = false;
  player.firing = false;
  messageEl.classList.remove("hidden");
  messageEl.innerHTML = `
    <h1>Game Over</h1>
    <p>Score: ${finalScore}</p>
    <p>Best: ${best}</p>
    <button id="startBtn">Play Again</button>
  `;
}

function spawnEnemy() {
  const size = Math.random() * 16 + 22;
  enemies.push({
    x: Math.random() * (viewWidth - size * 2) + size,
    y: -size - 10,
    radius: size,
    speed: Math.random() * 1.3 + 1.9,
    hp: Math.max(1, Math.floor(player.power * 0.45) + 1)
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
  const bulletSpeed = 8 + player.power * 0.35;
  const damage = Math.max(1, Math.floor(player.power * 0.8));
  const noseY = player.y - player.height * 0.54;

  if (player.power < 4) {
    bullets.push({ x: player.x, y: noseY, radius: 5, speed: bulletSpeed, damage });
    return;
  }

  if (player.power < 8) {
    bullets.push(
      { x: player.x - 10, y: noseY + 6, radius: 5, speed: bulletSpeed, damage },
      { x: player.x + 10, y: noseY + 6, radius: 5, speed: bulletSpeed, damage }
    );
    return;
  }

  bullets.push(
    { x: player.x, y: noseY, radius: 6, speed: bulletSpeed + 0.5, damage: damage + 1 },
    { x: player.x - 14, y: noseY + 8, radius: 5, speed: bulletSpeed, damage },
    { x: player.x + 14, y: noseY + 8, radius: 5, speed: bulletSpeed, damage }
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

  player.x = clamp(player.x, player.width * 0.28, viewWidth - player.width * 0.28);
  player.y = viewHeight * 0.82;
  player.glow = Math.max(0, player.glow - dt * 0.008);
  player.firePulse += dt * 0.02;

  enemyTimer += dt;
  orbTimer += dt;
  bulletTimer += dt;

  const enemyDelay = Math.max(280, 900 - player.power * 18);
  const bulletDelay = Math.max(95, 270 - player.power * 10);

  if (enemyTimer >= enemyDelay) {
    spawnEnemy();
    enemyTimer = 0;
  }

  if (orbTimer >= 1300) {
    spawnOrb();
    orbTimer = 0;
  }

  if (player.firing && bulletTimer >= bulletDelay) {
    shoot();
    bulletTimer = 0;
  }

  for (const enemy of enemies) enemy.y += enemy.speed * dt * 0.06;
  for (const orb of orbs) orb.y += orb.speed * dt * 0.06;
  for (const bullet of bullets) bullet.y -= bullet.speed * dt * 0.06;

  enemies = enemies.filter(enemy => enemy.y < viewHeight + 60 && enemy.hp > 0);
  orbs = orbs.filter(orb => orb.y < viewHeight + 40);
  bullets = bullets.filter(bullet => bullet.y > -30);

  const playerHitRadius = 28;
  for (const enemy of enemies) {
    if (circleHit(enemy.x, enemy.y, enemy.radius, player.x, player.y - 6, playerHitRadius)) {
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
    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j];
      if (circleHit(bullet.x, bullet.y, bullet.radius, enemy.x, enemy.y, enemy.radius)) {
        enemy.hp -= bullet.damage;
        bullets.splice(i, 1);
        if (enemy.hp <= 0) {
          score += 20;
          if (Math.random() < 0.28) {
            orbs.push({ x: enemy.x, y: enemy.y, radius: 10, speed: 2.2 });
          }
        }
        break;
      }
    }
  }

  score += dt * 0.004;
  scoreEl.textContent = `Score: ${Math.floor(score)}`;
}

function drawBackground() {
  for (const star of stars) {
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.fill();
  }
}

function drawEnemy(enemy) {
  ctx.beginPath();
  ctx.arc(enemy.x, enemy.y, enemy.radius + 10, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,70,90,0.16)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#f85b62";
  ctx.fill();

  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(enemy.x - enemy.radius * 0.26, enemy.y - enemy.radius * 0.12, 3.2, 0, Math.PI * 2);
  ctx.arc(enemy.x + enemy.radius * 0.26, enemy.y - enemy.radius * 0.12, 3.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawOrb(orb) {
  ctx.beginPath();
  ctx.arc(orb.x, orb.y, orb.radius + 8, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(90,185,255,0.18)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#64c8ff";
  ctx.fill();
}

function drawBullet(bullet) {
  ctx.beginPath();
  ctx.arc(bullet.x, bullet.y, bullet.radius + 4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,180,80,0.2)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#ffd36b";
  ctx.fill();
}

function drawDragon() {
  const x = player.x;
  const y = player.y;
  const pulse = Math.sin(player.firePulse) * 0.5 + 0.5;

  ctx.save();
  ctx.translate(x, y);

  // aura
  const aura = ctx.createRadialGradient(0, 0, 8, 0, 0, 54 + player.glow * 14);
  aura.addColorStop(0, "rgba(90,210,255,0.28)");
  aura.addColorStop(1, "rgba(90,210,255,0)");
  ctx.beginPath();
  ctx.arc(0, 0, 54 + player.glow * 14, 0, Math.PI * 2);
  ctx.fillStyle = aura;
  ctx.fill();

  // tail
  ctx.strokeStyle = "#1b6ca8";
  ctx.lineCap = "round";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(0, 16);
  ctx.quadraticCurveTo(-4, 38, 0, 62);
  ctx.quadraticCurveTo(5, 82, -3, 100);
  ctx.stroke();

  ctx.fillStyle = "#4ec4ff";
  ctx.beginPath();
  ctx.moveTo(-3, 100);
  ctx.lineTo(-12, 116);
  ctx.lineTo(0, 110);
  ctx.lineTo(12, 116);
  ctx.lineTo(3, 100);
  ctx.closePath();
  ctx.fill();

  // left wing
  ctx.beginPath();
  ctx.moveTo(-10, -12);
  ctx.quadraticCurveTo(-45, -26, -74, -6);
  ctx.quadraticCurveTo(-88, 5, -84, 20);
  ctx.quadraticCurveTo(-60, 12, -32, 18);
  ctx.quadraticCurveTo(-18, 8, -8, 2);
  ctx.closePath();
  ctx.fillStyle = "#2c86c9";
  ctx.fill();
  ctx.strokeStyle = "rgba(200,240,255,0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-12, -8);
  ctx.lineTo(-60, -8);
  ctx.moveTo(-12, -2);
  ctx.lineTo(-44, 8);
  ctx.moveTo(-12, 4);
  ctx.lineTo(-30, 18);
  ctx.stroke();

  // right wing
  ctx.beginPath();
  ctx.moveTo(10, -12);
  ctx.quadraticCurveTo(45, -26, 74, -6);
  ctx.quadraticCurveTo(88, 5, 84, 20);
  ctx.quadraticCurveTo(60, 12, 32, 18);
  ctx.quadraticCurveTo(18, 8, 8, 2);
  ctx.closePath();
  ctx.fillStyle = "#2c86c9";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(12, -8);
  ctx.lineTo(60, -8);
  ctx.moveTo(12, -2);
  ctx.lineTo(44, 8);
  ctx.moveTo(12, 4);
  ctx.lineTo(30, 18);
  ctx.stroke();

  // body silhouette
  ctx.beginPath();
  ctx.moveTo(0, -56);
  ctx.bezierCurveTo(-16, -46, -20, -24, -18, -4);
  ctx.bezierCurveTo(-16, 22, -13, 46, -6, 66);
  ctx.lineTo(6, 66);
  ctx.bezierCurveTo(13, 46, 16, 22, 18, -4);
  ctx.bezierCurveTo(20, -24, 16, -46, 0, -56);
  ctx.closePath();
  ctx.fillStyle = "#247fbe";
  ctx.fill();

  // belly / highlights
  ctx.beginPath();
  ctx.moveTo(0, -30);
  ctx.bezierCurveTo(-9, -22, -8, 12, -4, 46);
  ctx.lineTo(4, 46);
  ctx.bezierCurveTo(8, 12, 9, -22, 0, -30);
  ctx.closePath();
  ctx.fillStyle = "#8cdcff";
  ctx.fill();

  // dorsal spikes
  ctx.fillStyle = "#d8f5ff";
  for (let sy = -46; sy <= 52; sy += 13) {
    ctx.beginPath();
    ctx.moveTo(0, sy - 8);
    ctx.lineTo(-4, sy + 3);
    ctx.lineTo(4, sy + 3);
    ctx.closePath();
    ctx.fill();
  }

  // head
  ctx.beginPath();
  ctx.moveTo(0, -68);
  ctx.lineTo(-15, -50);
  ctx.lineTo(-12, -34);
  ctx.lineTo(0, -28);
  ctx.lineTo(12, -34);
  ctx.lineTo(15, -50);
  ctx.closePath();
  ctx.fillStyle = "#1f79b8";
  ctx.fill();

  // snout
  ctx.beginPath();
  ctx.moveTo(-8, -44);
  ctx.quadraticCurveTo(0, -62, 8, -44);
  ctx.lineTo(5, -31);
  ctx.lineTo(-5, -31);
  ctx.closePath();
  ctx.fillStyle = "#8cdcff";
  ctx.fill();

  // horns
  ctx.fillStyle = "#e9ffff";
  ctx.beginPath();
  ctx.moveTo(-7, -56);
  ctx.lineTo(-15, -76);
  ctx.lineTo(-4, -61);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(7, -56);
  ctx.lineTo(15, -76);
  ctx.lineTo(4, -61);
  ctx.closePath();
  ctx.fill();

  // eyes
  ctx.fillStyle = "#041127";
  ctx.beginPath();
  ctx.arc(-4, -42, 2.2, 0, Math.PI * 2);
  ctx.arc(4, -42, 2.2, 0, Math.PI * 2);
  ctx.fill();

  // front claws
  ctx.strokeStyle = "#d8f5ff";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-13, 16);
  ctx.lineTo(-18, 25);
  ctx.moveTo(-7, 18);
  ctx.lineTo(-10, 28);
  ctx.moveTo(13, 16);
  ctx.lineTo(18, 25);
  ctx.moveTo(7, 18);
  ctx.lineTo(10, 28);
  ctx.stroke();

  // fire breath when touching
  if (player.firing) {
    const fireLen = 14 + pulse * 10;
    ctx.beginPath();
    ctx.moveTo(-4, -58);
    ctx.quadraticCurveTo(0, -74 - fireLen, 4, -58);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,210,90,0.95)";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-2, -58);
    ctx.quadraticCurveTo(0, -68 - fireLen, 2, -58);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,120,50,0.95)";
    ctx.fill();
  }

  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, viewWidth, viewHeight);
  drawBackground();
  for (const orb of orbs) drawOrb(orb);
  for (const enemy of enemies) drawEnemy(enemy);
  for (const bullet of bullets) drawBullet(bullet);
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
  bulletTimer = 999;
  const touchX = getCanvasXFromClientX(touch.clientX);
  dragOffsetX = touchX - player.x;
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  if (activeTouchId === null || !dragging) return;
  for (const touch of e.touches) {
    if (touch.identifier === activeTouchId) {
      const touchX = getCanvasXFromClientX(touch.clientX);
      player.x = clamp(touchX - dragOffsetX, player.width * 0.28, viewWidth - player.width * 0.28);
      break;
    }
  }
}, { passive: false });

function stopTouch(e) {
  for (const touch of e.changedTouches) {
    if (touch.identifier === activeTouchId) {
      activeTouchId = null;
      dragging = false;
      player.firing = false;
      break;
    }
  }
}

canvas.addEventListener("touchend", stopTouch);
canvas.addEventListener("touchcancel", stopTouch);

document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "startBtn") startGame();
});

window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", resizeCanvas);
if (window.visualViewport) window.visualViewport.addEventListener("resize", resizeCanvas);

resizeCanvas();
draw();
