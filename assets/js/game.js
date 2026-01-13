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
  
// Gracz ma teraz dynamiczne wymiary, ustalane w resize()
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
  document.getElementById("btn-mouse").classList.toggle("active", method === "mouse");
  document.getElementById("btn-keys").classList.toggle("active", method === "keys");
}

// Obsługa klawiszy
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") keys.left = true;
  if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") keys.right = true;
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
    // Skalowanie pozycji myszy względem rzeczywistego rozmiaru canvas
    const scaleX = canvas.width / rect.width;
    player.x = (e.clientX - rect.left) * scaleX - player.width / 2;
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
  resize(); // Upewnij się, że rozmiary są poprawne przy starcie

  document.getElementById("scoreVal").innerText = "0";
  document.getElementById("livesVal").innerText = mode === "classic" ? "3" : "ZBIERANIE";

  spawnItem();
  update();
  updateMobileUI();
}

function spawnItem() {
  if (gameState !== "COLLECTING") return;
  let level = gameMode === "classic" ? Math.floor(score / 1000) : 0;
  let speedBonus = level * 1.2;

  let type;
  if (gameMode === "build") {
    type = { emoji: "🧱", pts: 1, type: "good" };
  } else {
    let r = Math.random();
    if (r < 0.05) type = { emoji: "💊", type: "heal" };
    else if (r < 0.25)
      type = Math.random() < 0.5 ? { emoji: "💧", type: "bad" } : { emoji: "❌", type: "bad" };
    else {
      let goods = [{ e: "🧱", p: 10 }, { e: "🪟", p: 30 }, { e: "📏", p: 20 }];
      let g = goods[Math.floor(Math.random() * 3)];
      type = { emoji: g.e, pts: g.p, type: "good" };
    }
  }

  items.push({
    x: Math.random() * (canvas.width - 40),
    y: -50,
    speed: 3 + Math.random() * 3 + speedBonus,
    ...type,
  });

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
      let avg = Math.round(accuracyScores.reduce((a, b) => a + b, 0) / accuracyScores.length);
      endGame("DOM UKOŃCZONY!", `Dokładność: <span style="font-size:40px; color:var(--psd-red); font-weight:bold;">${avg}%</span>`);
    }, 800);
  }
}

function endGame(title, info) {
  gameState = "GAMEOVER";
  stopMusic();
  updateMobileUI();
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
    // Zabezpieczenie przed wyjazdem poza ekran
    if (player.x < 0) player.x = 0;
    if (player.x > canvas.width - player.width) player.x = canvas.width - player.width;

    drawTruck(player.x, player.y, player.width, player.height);

    for (let i = items.length - 1; i >= 0; i--) {
      let s = items[i];
      s.y += s.speed;
      ctx.font = "32px Arial";
      ctx.fillText(s.emoji, s.x, s.y);

      // Kolizja - używamy dynamicznych wymiarów gracza
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

    document.getElementById("livesVal").innerText = gameMode === "classic" ? lives : "ZBIERANIE";
    document.getElementById("scoreVal").innerText = gameMode === "classic" ? score : collected;

    if (lives <= 0) endGame("PRZEGRANA!", "Skończyły Ci się szanse.");
    if (gameMode === "build" && collected >= 10) {
      gameState = "BUILDING";
      document.getElementById("livesVal").innerText = "DŹWIG";
      updateMobileUI();
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
  const c = { t: "#232323", cb: "#232323", a: "#E31E24", wh: "#111", win: "#555" };
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
  // Koła
  let wheelRadius = w * 0.08; 
  let wheelY = y + h - wheelRadius;
  [x + w*0.2, x + w*0.45, x + w - w*0.2].forEach((wx) => {
    ctx.beginPath();
    ctx.arc(wx, wheelY, wheelRadius, 0, Math.PI * 2);
    ctx.fill();
  });
}

// --- LOGIKA SKALOWANIA ---
function resize() {
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  
  // Dynamiczna szerokość gracza: ~20% ekranu, ale w granicach 60-140px
  let newW = Math.max(60, Math.min(140, canvas.width * 0.22));
  let ratio = newW / 110; // 110 to oryginalna baza
  
  player.width = newW;
  player.height = 60 * ratio; 
  player.y = canvas.height - player.height - 10;
  
  // Jeśli gracz jest teraz poza ekranem, popraw to
  if(player.x > canvas.width - player.width) {
      player.x = canvas.width - player.width;
  }
}
window.addEventListener("resize", () => {
    resize();
    // Odśwież wieżę jeśli jesteśmy w tym trybie
    if(gameState === "TOWER" && typeof updateTower === "function") {
       // Opcjonalne: można tu dodać logikę przerysowania wieży
    }
});
resize();

// --- TELEFON: STEROWANIE ---
const sliderArea = document.getElementById('touch-slider-area');
const sliderHandle = document.getElementById('slider-handle');
const actionBtn = document.getElementById('action-btn');

let isdragging = false;

function handleSlider(e) {
    const rect = sliderArea.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    
    // Pobieramy aktualną szerokość rączki (bo jest w CSS)
    const handleW = sliderHandle.offsetWidth;
    const maxSlide = rect.width - handleW;
    
    // Obliczamy pozycję, centrując palec na rączce
    let offsetX = (touch.clientX - rect.left) - (handleW / 2);
    
    // Ograniczenia
    if (offsetX < 0) offsetX = 0;
    if (offsetX > maxSlide) offsetX = maxSlide;
    
    sliderHandle.style.left = offsetX + "px";
    
    if (gameState === 'COLLECTING') {
        // Obliczamy procent przesunięcia suwaka (0.0 - 1.0)
        let percent = offsetX / maxSlide;
        // Mapujemy na dostępną szerokość gry (canvas - szerokość gracza)
        player.x = percent * (canvas.width - player.width);
    }
}

sliderArea.addEventListener('touchstart', (e) => { 
    isdragging = true; 
    sliderHandle.classList.add('active');
    handleSlider(e); 
});
sliderArea.addEventListener('touchmove', (e) => { 
    if(isdragging) {
        e.preventDefault(); // Zapobiega przesuwaniu strony
        handleSlider(e); 
    }
});
sliderArea.addEventListener('touchend', () => { 
    isdragging = false; 
    sliderHandle.classList.remove('active');
});

actionBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    actionBtn.style.transform = "scale(0.95)";
    if (gameState === 'BUILDING') {
        playSFX('drop');
        dropPart();
    } else if (gameState === 'TOWER') {
        // Funkcja z tower.js
        if(typeof dropTowerFloor === 'function') {
             playSFX('drop');
             dropTowerFloor();
        }
    }
    setTimeout(() => { actionBtn.style.transform = "scale(1)"; }, 100);
});

function updateMobileUI() {
    const controlsContainer = document.getElementById('mobile-controls');
    const slider = document.getElementById('touch-slider-area');
    const btn = document.getElementById('action-btn');

    // Wykrywanie dotyku
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) {
        controlsContainer.style.setProperty('display', 'none', 'important');
        return;
    }

    // Pokazujemy kontener jeśli jesteśmy na dotykowym
    controlsContainer.classList.add('active-device');

    if (gameState === 'COLLECTING') {
        slider.style.display = 'block';
        btn.style.display = 'none';
    } else if (gameState === 'BUILDING' || gameState === 'TOWER') {
        slider.style.display = 'none';
        btn.style.display = 'block';
        // Zmieniamy tekst przycisku w zależności od trybu
        btn.innerText = gameState === 'TOWER' ? "ZBUDUJ PIĘTRO" : "PUŚĆ ELEMENT";
    } else {
        // W Menu lub Game Over można ukryć wszystko, albo zostawić
        // Ukrywamy, żeby nie zasłaniało przycisków menu
        if(gameState === 'MENU' || gameState === 'GAMEOVER') {
             controlsContainer.style.removeProperty('display'); // Wraca do CSS class logic
             // Ale tutaj chcemy ukryć wewn. elementy
             slider.style.display = 'none';
             btn.style.display = 'none';
        }
    }
}