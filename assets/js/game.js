const sounds = {
  point: new Audio("assets/sounds/point.webm"),
  hit: new Audio("assets/sounds/hit.webm"),
  drop: new Audio("assets/sounds/drop.webm"),
  success: new Audio("assets/sounds/success.webm"),
  gameover: new Audio("assets/sounds/gameover-retro.webm"),
  music: new Audio("assets/sounds/music-bg.webm"),
};

const musicSlider = document.getElementById("musicVol");
const sfxSlider = document.getElementById("sfxVol");
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const container = document.getElementById("game-container");
const overlay = document.getElementById("overlay");
const titleEl = document.getElementById("msg-title");
const infoEl = document.getElementById("msg-p-info");

let gameState = "MENU",
  gameMode = "classic",
  controlMethod = "mouse";
let score = 0,
  lives = 3,
  collected = 0,
  items = [],
  animationId;
let player = { x: 0, y: 0, width: 110, height: 60, speed: 10 };
const keys = { left: false, right: false };

const buildParts = [
  { name: "FUNDAMENT", type: "rect", w: 220, h: 40, color: "#E31E24" },
  { name: "ŚCIANY", type: "rect", w: 200, h: 110, color: "#E31E24" },
  { name: "OKNA", type: "windows", w: 160, h: 40, color: "#E31E24" },
  { name: "DACH", type: "triangle", w: 250, h: 90, color: "#E31E24" },
  { name: "KOMIN", type: "rect", w: 35, h: 60, color: "#E31E24" },
];
let currentPartIdx = 0,
  placedParts = [],
  craneAngle = 0,
  accuracyScores = [];

function playSFX(name) {
  if (sounds[name]) {
    let clone = sounds[name].cloneNode();
    clone.volume = sfxSlider.value;
    clone.play().catch(() => {});
  }
}

function stopMusic() {
  sounds.music.pause();
  sounds.music.currentTime = 0;
}

function triggerFlash(type) {
  container.classList.remove("damage-flash", "heal-flash");
  void container.offsetWidth;
  container.classList.add(type === "heal" ? "heal-flash" : "damage-flash");
}

function setControl(method) {
  controlMethod = method;
  document
    .getElementById("btn-mouse")
    .classList.toggle("active", method === "mouse");
  document
    .getElementById("btn-keys")
    .classList.toggle("active", method === "keys");
}

// Obsługa klawiszy
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") keys.left = true;
  if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") keys.right = true;

  // SPACJA W BUDOWANIU
  if (e.code === "Space" && gameState === "BUILDING") {
    e.preventDefault();
    playSFX("drop");
    dropPart();
  }
});

window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") keys.left = false;
  if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") keys.right = false;
});

// Obsługa myszy
window.addEventListener("mousemove", (e) => {
  if (gameState === "COLLECTING" && controlMethod === "mouse") {
    const rect = canvas.getBoundingClientRect();
    player.x = e.clientX - rect.left - player.width / 2;
  }
});

canvas.addEventListener("mousedown", () => {
  if (gameState === "BUILDING") {
    playSFX("drop");
    dropPart();
  }
});

function initGame(mode) {
  stopMusic();
  sounds.music.loop = true;
  sounds.music.volume = musicSlider.value;
  sounds.music.play().catch(() => {});

  gameMode = mode;
  score = 0;
  lives = 3;
  collected = 0;
  currentPartIdx = 0;
  placedParts = [];
  accuracyScores = [];
  items = [];
  gameState = "COLLECTING";
  overlay.style.display = "none";

  document.getElementById("scoreVal").innerText = "0";
  document.getElementById("livesVal").innerText =
    mode === "classic" ? "3" : "ZBIERANIE";

  spawnItem();
  update();
  updateMobileUI(); // Telefon Sterowanie
}

function spawnItem() {
  if (gameState !== "COLLECTING") return;

  // OBLICZANIE POZIOMU TRUDNOŚCI
  // Każde 1000 punktów zwiększa poziom o 1.
  // Math.floor(score / 1000) da nam 0 dla <1000, 1 dla 1000-1999 itd.
  let level = gameMode === "classic" ? Math.floor(score / 1000) : 0;
  let speedBonus = level * 1.2; // Każdy poziom dodaje 1.2 do prędkości

  let type;
  if (gameMode === "build") {
    type = { emoji: "🧱", pts: 1, type: "good" };
  } else {
    let r = Math.random();
    if (r < 0.05) type = { emoji: "💊", type: "heal" };
    else if (r < 0.25)
      type =
        Math.random() < 0.5
          ? { emoji: "💧", type: "bad" }
          : { emoji: "❌", type: "bad" };
    else {
      let goods = [
        { e: "🧱", p: 10 },
        { e: "🪟", p: 30 },
        { e: "📏", p: 20 },
      ];
      let g = goods[Math.floor(Math.random() * 3)];
      type = { emoji: g.e, pts: g.p, type: "good" };
    }
  }

  // DODANIE PRĘDKOŚCI BAZOWEJ + BONUSU ZA POZIOM
  items.push({
    x: Math.random() * (canvas.width - 40),
    y: -50,
    speed: 3 + Math.random() * 3 + speedBonus, // Tutaj aplikujemy przyspieszenie
    ...type,
  });

  // PRZYSPIESZENIE CZASU SPAWNOWANIA (opcjonalnie)
  // Im wyższy poziom, tym częściej spadają przedmioty (minimum co 400ms)
  let spawnDelay = gameMode === "build" ? 600 : Math.max(400, 900 - level * 50);

  setTimeout(spawnItem, spawnDelay);
}

function dropPart() {
  let part = buildParts[currentPartIdx];
  if (!part) return;

  let targetX = canvas.width / 2;
  let currentX = canvas.width / 2 + Math.sin(craneAngle) * 120;
  let acc = Math.max(0, 100 - Math.abs(targetX - currentX) / 1.5);
  accuracyScores.push(acc);
  placedParts.push({
    ...part,
    x: currentX - part.w / 2,
    y: canvas.height - 10 - placedParts.reduce((a, p) => a + p.h, 0) - part.h,
  });

  currentPartIdx++;
  if (currentPartIdx >= buildParts.length) {
    setTimeout(() => {
      let avg = Math.round(
        accuracyScores.reduce((a, b) => a + b, 0) / accuracyScores.length,
      );
      endGame(
        "DOM UKOŃCZONY!",
        `Dokładność: <span style="font-size:40px; color:var(--psd-red); font-weight:bold;">${avg}%</span>`,
      );
    }, 800);
  }
}

function endGame(title, info) {
  gameState = "GAMEOVER";
  stopMusic();
  updateMobileUI(); // Telefon Sterowanie
  playSFX(title.includes("DOM") ? "success" : "gameover");
  overlay.style.display = "flex";
  titleEl.innerText = title;
  infoEl.innerHTML = info;
}

function update() {
  if (gameState === "GAMEOVER") return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (gameState === "COLLECTING") {
    if (controlMethod === "keys") {
      if (keys.left) player.x -= player.speed;
      if (keys.right) player.x += player.speed;
    }
    if (player.x < 0) player.x = 0;
    if (player.x > canvas.width - player.width)
      player.x = canvas.width - player.width;

    drawTruck(player.x, player.y, player.width, player.height);

    for (let i = items.length - 1; i >= 0; i--) {
      let s = items[i];
      s.y += s.speed;
      ctx.font = "32px Arial";
      ctx.fillText(s.emoji, s.x, s.y);

      if (
        s.y > player.y &&
        s.y < player.y + player.height &&
        s.x > player.x - 10 &&
        s.x < player.x + player.width
      ) {
        if (s.type === "bad") {
          playSFX("hit");
          lives--;
          triggerFlash("damage");
        } else if (s.type === "heal") {
          playSFX("point");
          lives++;
          triggerFlash("heal");
        } else {
          playSFX("point");
          score += s.pts || 0;
          collected++;
        }
        items.splice(i, 1);
      } else if (s.y > canvas.height) {
        if (s.type === "good" && gameMode === "classic") {
          playSFX("hit");
          lives--;
          triggerFlash("damage");
        }
        items.splice(i, 1);
      }
    }

    document.getElementById("livesVal").innerText =
      gameMode === "classic" ? lives : "ZBIERANIE";
    document.getElementById("scoreVal").innerText =
      gameMode === "classic" ? score : collected;

    if (lives <= 0) endGame("PRZEGRANA!", "Skończyły Ci się szanse.");
    if (gameMode === "build" && collected >= 10) {
      gameState = "BUILDING";
      document.getElementById("livesVal").innerText = "DŹWIG";
	  updateMobileUI(); // Telefon Sterowanie
    }
  } else if (gameState === "BUILDING") {
    drawBuilding();
    drawCrane();
  }
  animationId = requestAnimationFrame(update);
}

function drawBuilding() {
  placedParts.forEach((p) => {
    ctx.fillStyle = p.color;
    if (p.type === "triangle") {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + p.h);
      ctx.lineTo(p.x + p.w / 2, p.y);
      ctx.lineTo(p.x + p.w, p.y + p.h);
      ctx.fill();
    } else {
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.strokeRect(p.x, p.y, p.w, p.h);
    }
  });
}

function drawCrane() {
  let part = buildParts[currentPartIdx];
  if (!part) return;
  craneAngle = Math.sin(Date.now() * 0.0025) * (0.4 + currentPartIdx * 0.15);
  let cx = canvas.width / 2,
    sx = cx + Math.sin(craneAngle) * 120;
  ctx.fillStyle = "#FFD700";
  ctx.fillRect(0, 0, canvas.width, 15);
  ctx.fillRect(cx - 10, 0, 20, 30);
  ctx.beginPath();
  ctx.moveTo(cx, 30);
  ctx.lineTo(sx, 160);
  ctx.strokeStyle = "#aaa";
  ctx.stroke();
  ctx.fillStyle = part.color;
  if (part.type === "triangle") {
    ctx.beginPath();
    ctx.moveTo(sx - part.w / 2, 160 + part.h);
    ctx.lineTo(sx, 160);
    ctx.lineTo(sx + part.w / 2, 160 + part.h);
    ctx.fill();
  } else {
    ctx.fillRect(sx - part.w / 2, 160, part.w, part.h);
  }
}

function drawTruck(x, y, w, h) {
  const c = { t: "#333", cb: "#232323", a: "#E31E24", wh: "#111", win: "#555" };
  let tw = w * 0.7,
    cw = w * 0.3,
    bh = h - 8;
  ctx.fillStyle = c.t;
  ctx.fillRect(x, y, tw, bh);
  ctx.fillStyle = c.a;
  ctx.fillRect(x, y + bh / 3, tw, 10);
  ctx.fillStyle = "white";
  ctx.font = "bold 12px Arial";
  ctx.fillText("PSD", x + 5, y + bh / 3 - 5);
  ctx.fillStyle = c.cb;
  ctx.fillRect(x + tw - 2, y + 10, cw, bh - 10);
  ctx.fillStyle = c.win;
  ctx.fillRect(x + tw + 5, y + 15, cw - 15, 15);
  ctx.fillStyle = c.wh;
  [x + 20, x + 45, x + w - 20].forEach((wx) => {
    ctx.beginPath();
    ctx.arc(wx, y + bh, 8, 0, Math.PI * 2);
    ctx.fill();
  });
}

function resize() {
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  player.y = canvas.height - player.height - 10;
}
window.addEventListener("resize", resize);
resize();

// Telefon

const sliderArea = document.getElementById('touch-slider-area');
const sliderHandle = document.getElementById('slider-handle');
const actionBtn = document.getElementById('action-btn');

// --- LOGIKA SUWAKA ---
let isdragging = false;

function handleSlider(e) {
    const rect = sliderArea.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    let offsetX = touch.clientX - rect.left;
    
    // Ograniczenie suwaka
    if (offsetX < 30) offsetX = 30;
    if (offsetX > rect.width - 30) offsetX = rect.width - 30;
    
    // Ustawienie wizualne rączki
    sliderHandle.style.left = (offsetX - 30) + "px";
    
    // Przeliczenie na pozycję gracza w grze (procentowo)
    if (gameState === 'COLLECTING') {
        let percent = (offsetX - 30) / (rect.width - 60);
        player.x = percent * (canvas.width - player.width);
    }
}

sliderArea.addEventListener('touchstart', (e) => { isdragging = true; handleSlider(e); });
sliderArea.addEventListener('touchmove', (e) => { if(isdragging) handleSlider(e); });
sliderArea.addEventListener('touchend', () => { isdragging = false; });

// --- LOGIKA PRZYCISKU AKCJI ---
actionBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState === 'BUILDING') {
        playSFX('drop');
        dropPart();
    } else if (gameState === 'TOWER') {
        playSFX('drop');
        dropTowerFloor(); // Wywołanie z tower.js
    }
});

function updateMobileUI() {
    const slider = document.getElementById('touch-slider-area');
    const btn = document.getElementById('action-btn');
    const controlsContainer = document.getElementById('mobile-controls');

    // Sprawdzamy, czy urządzenie obsługuje dotyk
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (!isTouchDevice) {
        controlsContainer.style.setProperty('display', 'none', 'important');
        return; // Jeśli to PC (myszka), kończymy tutaj i nic nie pokazujemy
    }

    if (gameState === 'COLLECTING') {
        controlsContainer.style.setProperty('display', 'block', 'important');
        slider.style.display = 'block';
        btn.style.display = 'none';
    } else if (gameState === 'BUILDING' || gameState === 'TOWER') {
        controlsContainer.style.setProperty('display', 'block', 'important');
        slider.style.display = 'none';
        btn.style.display = 'block';
    } else {
        controlsContainer.style.setProperty('display', 'none', 'important');
    }
}

updateMobileUI();