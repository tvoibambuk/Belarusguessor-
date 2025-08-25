let panorama, map, guessCoords, realCoords;
let round = 1, score = 0;
let coordsList = [[53.9,27.5667],[53.6778,23.8293],[52.0976,23.7341],[52.4345,30.9754],[55.1904,30.2049],[53.1336,26.0139]];

ymaps.ready(init);

function init() {
  loadRandomPanorama();
  map = new ymaps.Map("map", { center:[53.9,27.5667], zoom:6, controls:["zoomControl"] });

  let placemark;
  map.events.add("click", e => {
    const coords = e.get("coords");
    guessCoords = coords;
    if (placemark) placemark.geometry.setCoordinates(coords);
    else {
      placemark = new ymaps.Placemark(coords, {}, {preset:"islands#redIcon"});
      map.geoObjects.add(placemark);
    }
  });

  document.getElementById("guessBtn").addEventListener("click", makeGuess);
  document.getElementById("nextRoundBtn").addEventListener("click", nextRound);
}

function loadRandomPanorama() {
  realCoords = coordsList[Math.floor(Math.random()*coordsList.length)];
  ymaps.panorama.locate(realCoords).done(panos => {
    if(panos.length>0) panorama = new ymaps.panorama.Player("panorama", panos[0]);
    else loadRandomPanorama();
  });
}

function makeGuess() {
  if(!guessCoords){ alert("Сначала выбери точку на карте!"); return; }
  const distance = ymaps.coordSystem.geo.getDistance(guessCoords, realCoords)/1000;
  score += Math.max(0, Math.round(5000 - distance));
  
  // Показ правильной точки
  let correctMark = new ymaps.Placemark(realCoords, {}, {preset:"islands#greenIcon"});
  map.geoObjects.add(correctMark);

  document.getElementById("result").textContent = `Расстояние: ${distance.toFixed(1)} км. Баллы: ${score}`;
  document.getElementById("guessBtn").disabled = true;
  document.getElementById("nextRoundBtn").disabled = false;
}

function nextRound() {
  round++;
  if(round>5){
    document.getElementById("roundInfo").textContent = `Игра окончена! Очки: ${score}`;
    document.getElementById("nextRoundBtn").disabled = true;
    return;
  }
  document.getElementById("roundInfo").textContent = `Раунд ${round} из 5`;
  document.getElementById("result").textContent = "";
  guessCoords = null;

  map.geoObjects.removeAll(); // убираем старые метки
  loadRandomPanorama();
  document.getElementById("guessBtn").disabled = false;
  document.getElementById("nextRoundBtn").disabled = true;
}