let towerLevels = [];
let currentFloor = { x: 0, y: 0, w: 200, h: 30, speed: 4, dir: 1 };
let towerActive = false;
let towerAccuracyArray = [];
const MAX_FLOORS = 100;

function initTowerMode() {
  stopMusic();

  if (sounds.music) {
    sounds.music.loop = true;
    sounds.music.volume = document.getElementById("musicVol").value;
    sounds.music.play().catch((e) => console.log("Muzyka error:", e));
  }

  gameState = "TOWER";
  towerActive = true;
  overlay.style.display = "none";

  towerLevels = [];
  towerAccuracyArray = [];

  // SKALOWANIE: Pierwsze piętro to 35% szerokości ekranu (nie mniej niż 100px)
  let startWidth = Math.max(100, canvas.width * 0.35);

  // Pierwsze piętro (fundament)
  towerLevels.push({
    x: canvas.width / 2 - startWidth / 2,
    y: canvas.height - 40,
    w: startWidth,
    h: 30,
  });

  resetFloor(1);
  updateTower();
  updateMobileUI(); 
}

function resetFloor(level) {
  // Pobieramy szerokość ostatniego postawionego piętra
  let lastW = towerLevels[towerLevels.length - 1].w;
  
  // Nowe piętro jest węższe o 2% względem poprzedniego (a nie stałe pixele)
  let newW = lastW * 0.98;
  
  // Minimalna szerokość to np. 10% ekranu
  let minW = canvas.width * 0.1;
  if (newW < minW) newW = minW;

  currentFloor = {
    x: 0,
    y: towerLevels[towerLevels.length - 1].y - 30,
    w: newW,
    h: 30,
    speed: 4 + level * 0.15, // Przyspieszenie
    dir: 1,
  };
}

function updateTower() {
  if (gameState !== "TOWER") return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let shakeX = 0;
  let shakeY = 0;
  if (towerLevels.length > 20) {
    let intensity = (towerLevels.length - 20) * 0.2;
    shakeX = (Math.random() - 0.5) * intensity;
    shakeY = (Math.random() - 0.5) * intensity;
  }

  ctx.save();
  ctx.translate(shakeX, shakeY);

  const craneY = 0; 
  // Dźwig
  ctx.fillStyle = "#FFD700";
  ctx.fillRect(0, craneY, canvas.width, 10);
  ctx.fillRect(currentFloor.x + currentFloor.w / 2 - 15, craneY, 30, 20);

  ctx.strokeStyle = "#555";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(currentFloor.x + 10, currentFloor.y);
  ctx.lineTo(currentFloor.x + currentFloor.w / 2 - 10, craneY + 20);
  ctx.moveTo(currentFloor.x + currentFloor.w - 10, currentFloor.y);
  ctx.lineTo(currentFloor.x + currentFloor.w / 2 + 10, craneY + 20);
  ctx.stroke();

  // Rysowanie poziomów
  towerLevels.forEach((lvl, index) => {
    ctx.fillStyle = index === MAX_FLOORS - 1 ? "#FFD700" : "#E31E24";
    ctx.fillRect(lvl.x, lvl.y, lvl.w, lvl.h);
    ctx.strokeStyle = "white";
    ctx.strokeRect(lvl.x, lvl.y, lvl.w, lvl.h);
  });

  // Ruch aktualnego piętra
  currentFloor.x += currentFloor.speed * currentFloor.dir;
  
  // Odbijanie od krawędzi ekranu
  if (currentFloor.x <= 0) {
      currentFloor.x = 0;
      currentFloor.dir = 1;
  } else if (currentFloor.x + currentFloor.w >= canvas.width) {
      currentFloor.x = canvas.width - currentFloor.w;
      currentFloor.dir = -1;
  }

  // Rysowanie aktualnego
  ctx.fillStyle = towerLevels.length === MAX_FLOORS - 1 ? "#FFD700" : "#E31E24";
  ctx.fillRect(currentFloor.x, currentFloor.y, currentFloor.w, currentFloor.h);

  ctx.restore();

  document.getElementById("scoreVal").innerText = towerLevels.length;
  document.getElementById("livesVal").innerText = "PIĘTRO";

  requestAnimationFrame(updateTower);
}

function dropTowerFloor() {
  if (gameState !== "TOWER") return;

  let lastLvl = towerLevels[towerLevels.length - 1];
  let centerCurrent = currentFloor.x + currentFloor.w / 2;
  let centerLast = lastLvl.x + lastLvl.w / 2;
  let diff = Math.abs(centerCurrent - centerLast);

  let hit =
    currentFloor.x + currentFloor.w > lastLvl.x &&
    currentFloor.x < lastLvl.x + lastLvl.w;

  if (hit) {
    playSFX("point");

    let maxAllowedDiff = (currentFloor.w + lastLvl.w) / 2;
    let accuracy = Math.max(0, 100 - (diff / maxAllowedDiff) * 100);
    towerAccuracyArray.push(accuracy);

    towerLevels.push({
      x: currentFloor.x,
      y: currentFloor.y,
      w: currentFloor.w,
      h: currentFloor.h,
    });

    if (towerLevels.length >= MAX_FLOORS) {
      let finalScore = calculateAverageAccuracy();
      endGame(
        "MISTRZ WIEŻOWCÓW!",
        `Zbudowałeś 100 pięter!<br>Stabilność: <span style="color:var(--psd-red); font-size:40px;">${finalScore}%</span>`,
      );
    } else {
      if (currentFloor.y < 250) {
        towerLevels.forEach((l) => (l.y += 30));
      }
      resetFloor(towerLevels.length);
    }
  } else {
    playSFX("hit");
    let finalScore = calculateAverageAccuracy();
    endGame(
      "KATASTROFA!",
      `Wieża runęła na ${towerLevels.length} piętrze.<br>Średnia celność: ${finalScore}%`,
    );
  }
}

function calculateAverageAccuracy() {
  if (towerAccuracyArray.length === 0) return 0;
  let sum = towerAccuracyArray.reduce((a, b) => a + b, 0);
  return Math.round(sum / towerAccuracyArray.length);
}

// Obsługa sterowania
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" && gameState === "TOWER") {
    dropTowerFloor();
  }
});

canvas.addEventListener("mousedown", (e) => {
    // Zapobiegamy podwójnemu kliknięciu jeśli kliknięto w panel sterowania (mobile)
    if(e.target.closest('#mobile-controls')) return;
    
    if (gameState === "TOWER") {
        dropTowerFloor();
    }
});