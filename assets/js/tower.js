let towerLevels = [];
let currentFloor = { x: 0, y: 0, w: 200, h: 30, speed: 4, dir: 1 };
let towerActive = false;
let towerAccuracyArray = [];
const MAX_FLOORS = 100;

function initTowerMode() {
  // 1. Zatrzymujemy poprzednie dźwięki
  stopMusic();

  // 2. Uruchamiamy muzykę tła (zakładając, że sounds.music jest w game.js)
  if (sounds.music) {
    sounds.music.loop = true;
    sounds.music.volume = document.getElementById("musicVol").value;
    sounds.music
      .play()
      .catch((e) =>
        console.log("Muzyka czeka na interakcję lub błąd ścieżki:", e),
      );
  }

  gameState = "TOWER";
  towerActive = true;
  overlay.style.display = "none";

  towerLevels = [];
  towerAccuracyArray = []; // Resetujemy statystyki przy starcie

  // Pierwsze piętro (fundament)
  towerLevels.push({
    x: canvas.width / 2 - 100,
    y: canvas.height - 40,
    w: 200,
    h: 30,
  });

  resetFloor(1);
  updateTower();
  updateMobileUI(); // Telefon Sterowanie
}

function resetFloor(level) {
  currentFloor.speed = 4 + level * 0.15;
  let width = 200 - level * 1.5; // Opcjonalnie: piętra mogą się lekko zwężać
  if (width < 40) width = 40;

  currentFloor = {
    x: 0,
    y: towerLevels[towerLevels.length - 1].y - 30,
    w: width,
    h: 30,
    speed: 4 + level * 0.1, // Coraz szybciej
    dir: 1,
  };
}

function updateTower() {
  if (gameState !== "TOWER") return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Efekt trzęsienia ziemi powyżej 20 piętra
  let shakeX = 0;
  let shakeY = 0;
  if (towerLevels.length > 20) {
    let intensity = (towerLevels.length - 20) * 0.2;
    shakeX = (Math.random() - 0.5) * intensity;
    shakeY = (Math.random() - 0.5) * intensity;
  }

  ctx.save();
  ctx.translate(shakeX, shakeY);

  // --- RYSOWANIE DŹWIGU ---
  const craneY = 0; // Wysokość szyny dźwigu na górze ekranu
  const centerX = canvas.width / 2;

  // 1. Szyna pozioma dźwigu
  ctx.fillStyle = "#FFD700"; // Żółty kolor ostrzegawczy
  ctx.fillRect(0, craneY, canvas.width, 10);

  // 2. Wózek dźwigu (porusza się nad klockiem)
  ctx.fillRect(currentFloor.x + currentFloor.w / 2 - 15, craneY, 30, 20);

  // 3. Liny trzymające piętro
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 2;
  ctx.beginPath();
  // Lewa lina
  ctx.moveTo(currentFloor.x + 10, currentFloor.y);
  ctx.lineTo(currentFloor.x + currentFloor.w / 2 - 10, craneY + 20);
  // Prawa lina
  ctx.moveTo(currentFloor.x + currentFloor.w - 10, currentFloor.y);
  ctx.lineTo(currentFloor.x + currentFloor.w / 2 + 10, craneY + 20);
  ctx.stroke();

  // --- KONIEC DŹWIGU ---

  // Rysowanie postawionych pięter
  towerLevels.forEach((lvl, index) => {
    ctx.fillStyle = index === MAX_FLOORS - 1 ? "#FFD700" : "#E31E24"; // Złoty dach
    ctx.fillRect(lvl.x, lvl.y, lvl.w, lvl.h);
    ctx.strokeStyle = "white";
    ctx.strokeRect(lvl.x, lvl.y, lvl.w, lvl.h);
  });

  // Ruch aktualnego piętra
  currentFloor.x += currentFloor.speed * currentFloor.dir;
  if (currentFloor.x <= 0 || currentFloor.x + currentFloor.w >= canvas.width) {
    currentFloor.dir *= -1;
  }

  // Rysowanie aktualnego piętra
  ctx.fillStyle = towerLevels.length === MAX_FLOORS - 1 ? "#FFD700" : "#E31E24";
  ctx.fillRect(currentFloor.x, currentFloor.y, currentFloor.w, currentFloor.h);

  ctx.restore();

  // UI
  document.getElementById("scoreVal").innerText = towerLevels.length;
  document.getElementById("livesVal").innerText = "PIĘTRO";

  requestAnimationFrame(updateTower);
}

function dropTowerFloor() {
  if (gameState !== "TOWER") return;

  let lastLvl = towerLevels[towerLevels.length - 1];

  // Obliczamy różnicę środków (offset)
  let centerCurrent = currentFloor.x + currentFloor.w / 2;
  let centerLast = lastLvl.x + lastLvl.w / 2;
  let diff = Math.abs(centerCurrent - centerLast);

  // Hit następuje, jeśli krawędzie się dotykają (Twój warunek pixela)
  let hit =
    currentFloor.x + currentFloor.w > lastLvl.x &&
    currentFloor.x < lastLvl.x + lastLvl.w;

  if (hit) {
    playSFX("point");

    // OBLICZANIE PROCENTÓW dla tego konkretnego piętra:
    // 100% to idealne pokrycie środków. 0% to dotknięcie samym krawędzią (pixelem).
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
        `Zbudowałeś 100 pięter!<br>Stabilność konstrukcji: <span style="color:var(--psd-red); font-size:40px;">${finalScore}%</span>`,
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

// Obsługa sterowania dla nowego trybu
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" && gameState === "TOWER") {
    dropTowerFloor();
  }
});

canvas.addEventListener("mousedown", () => {
  if (gameState === "TOWER") {
    dropTowerFloor();
  }
});