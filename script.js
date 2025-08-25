let panorama, map, guessCoords, realCoords;
let round = 1;
let score = 0;

// Беларусь границы (для рандомных координат)
const minLat = 51.3, maxLat = 56.2;
const minLon = 23.1, maxLon = 32.7;

ymaps.ready(init);

function init() {
  // Панорама (рандомная точка)
  loadRandomPanorama();

  // Карта для выбора
  map = new ymaps.Map("map", {
    center: [53.9, 27.5667],
    zoom: 6,
    controls: ["zoomControl"]
  });

  let placemark;

  map.events.add("click", function (e) {
    const coords = e.get("coords");
    guessCoords = coords;

    if (placemark) {
      placemark.geometry.setCoordinates(coords);
    } else {
      placemark = new ymaps.Placemark(coords, {}, {preset: "islands#redIcon"});
      map.geoObjects.add(placemark);
    }
  });

  document.getElementById("guessBtn").addEventListener("click", makeGuess);
  document.getElementById("nextRoundBtn").addEventListener("click", nextRound);
}

function loadRandomPanorama() {
  const lat = Math.random() * (maxLat - minLat) + minLat;
  const lon = Math.random() * (maxLon - minLon) + minLon;
  realCoords = [lat, lon];

  ymaps.panorama.locate([lat, lon]).done(panos => {
    if (panos.length > 0) {
      panorama = new ymaps.panorama.Player("panorama", panos[0]);
    } else {
      loadRandomPanorama(); // если нет панорамы, пробуем снова
    }
  });
}

function makeGuess() {
  if (!guessCoords) {
    alert("Сначала выбери точку на карте!");
    return;
  }

  const distance = ymaps.coordSystem.geo.getDistance(guessCoords, realCoords) / 1000;
  score += Math.max(0, Math.round(5000 - distance));

  document.getElementById("result").textContent =
    `Ты угадал на ${distance.toFixed(1)} км. Баллы: ${score}`;

  document.getElementById("guessBtn").disabled = true;
  document.getElementById("nextRoundBtn").disabled = false;
}

function nextRound() {
  round++;
  if (round > 5) {
    document.getElementById("roundInfo").textContent = `Игра окончена! Твой результат: ${score} очков`;
    document.getElementById("nextRoundBtn").disabled = true;
    return;
  }

  document.getElementById("roundInfo").textContent = `Раунд ${round} из 5`;
  document.getElementById("result").textContent = "";

  guessCoords = null;
  loadRandomPanorama();

  document.getElementById("guessBtn").disabled = false;
  document.getElementById("nextRoundBtn").disabled = true;
}