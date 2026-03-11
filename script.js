const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
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
  radius: 18,
  speed: 0.18,
  glow: 0
};

let hazards = [];
let orbs = [];
let stars = [];
let touchX = null;
let spawnTimer = 0;
let orbTimer = 0;
let lastTime = 0;

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
    player.y = viewHeight * 0.8;
  } else {
    player.x = Math.max(player.radius, Math.min(viewWidth - player.radius, player.x));
    player.y = viewHeight * 0.8;
  }
}

function resetGame() {
  score = 0;
  scoreEl.textContent = "Score: 0";

  player.x = viewWidth / 2;
  player.y = viewHeight * 0.8;
  player.glow = 0;

  hazards = [];
  orbs = [];
  stars = [];
  spawnTimer = 0;
  orbTimer = 0;
  touchX = null;

  for (let i = 0; i < 60; i++) {
    stars.push({
      x: Math.random() * viewWidth,
      y: Math.random() * viewHeight,
      r: Math.random() * 2 + 1,
      speed: Math.random() * 0.4 + 0.2
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

  messageEl.classList.remove("hidden");
  messageEl.innerHTML = `
    <h1>Game Over</h1>
    <p>Score: ${finalScore}</p>
    <p>Best: ${best}</p>
    <button id="startBtn">Play Again</button>
  `;
}

function spawnHazard() {
  const size = Math.random() * 18 + 16;
  hazards.push({
    x: Math.random() * (viewWidth - size * 2) + size,
    y: -size,
    radius: size,
    speed: Math.random() * 2.2 + 2.4
  });
}

function spawnOrb() {
  const size = 10;
  orbs.push({
    x: Math.random() * (viewWidth - size * 2) + size,
    y: -size,
    radius: size,
    speed: 3
  });
}

function update(dt) {
  for (const star of stars) {
    star.y += star.speed * dt * 0.06;
    if (star.y > viewHeight) {
      star.y = -5;
      star.x = Math.random() * viewWidth;
    }
  }

  if (touchX !== null) {
    const dx = touchX - player.x;
    player.x += dx * player.speed * dt;
  }

  player.x = Math.max(player.radius, Math.min(viewWidth - player.radius, player.x));
  player.y = viewHeight * 0.8;
  player.glow = Math.max(0, player.glow - dt * 0.01);

  spawnTimer += dt;
  orbTimer += dt;

  if (spawnTimer > 700) {
    spawnHazard();
    spawnTimer = 0;
  }

  if (orbTimer > 1400) {
    spawnOrb();
    orbTimer = 0;
  }

  for (const hazard of hazards) {
    hazard.y += hazard.speed * dt * 0.06;
  }

  for (const orb of orbs) {
    orb.y += orb.speed * dt * 0.06;
  }

  hazards = hazards.filter((h) => h.y < viewHeight + 50);
  orbs = orbs.filter((o) => o.y < viewHeight + 50);

  for (const hazard of hazards) {
    const dx = hazard.x - player.x;
    const dy = hazard.y - player.y;
    const dist = Math.hypot(dx, dy);

    if (dist < hazard.radius + player.radius) {
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
      score += 10;
      player.glow = 1;
    }
  }

  score += dt * 0.002;
  scoreEl.textContent = `Score: ${Math.floor(score)}`;
}

function drawBackground() {
  for (const star of stars) {
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fill();
  }
}

function drawPlayer() {
  const glowSize = 24 + player.glow * 18;

  const gradient = ctx.createRadialGradient(
    player.x, player.y, 4,
    player.x, player.y, glowSize
  );
  gradient.addColorStop(0, "rgba(120,220,255,0.95)");
  gradient.addColorStop(0.4, "rgba(100,180,255,0.55)");
  gradient.addColorStop(1, "rgba(100,180,255,0)");

  ctx.beginPath();
  ctx.arc(player.x, player.y, glowSize, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#9ae6ff";
  ctx.fill();
}

function drawHazards() {
  for (const hazard of hazards) {
    ctx.beginPath();
    ctx.arc(hazard.x, hazard.y, hazard.radius + 8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,80,80,0.15)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(hazard.x, hazard.y, hazard.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#ff4d4d";
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

function draw() {
  ctx.clearRect(0, 0, viewWidth, viewHeight);
  drawBackground();
  drawOrbs();
  drawHazards();
  drawPlayer();
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

function setTouchPosition(clientX) {
  const rect = canvas.getBoundingClientRect();
  touchX = clientX - rect.left;
}

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  setTouchPosition(e.touches[0].clientX);
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  setTouchPosition(e.touches[0].clientX);
}, { passive: false });

canvas.addEventListener("touchend", () => {
  touchX = null;
});

canvas.addEventListener("touchcancel", () => {
  touchX = null;
});

canvas.addEventListener("mousedown", (e) => {
  setTouchPosition(e.clientX);
});

canvas.addEventListener("mousemove", (e) => {
  if (touchX !== null) {
    setTouchPosition(e.clientX);
  }
});

window.addEventListener("mouseup", () => {
  touchX = null;
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