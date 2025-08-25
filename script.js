// Глобальные переменные
let gameState = {
    currentRound: 1,
    totalRounds: 5,
    score: 0,
    roundResults: [],
    currentLocation: null,
    usedLocations: [],
    guessMarker: null,
    correctMarker: null,
    gameMap: null,
    panoramaPlayer: null
};

let gameCoords = [];

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    loadGameData();
    loadStats();
    initializeYandexMaps();
});

// Загрузка данных игры
async function loadGameData() {
    try {
        const response = await fetch('coords.json');
        gameCoords = await response.json();
        console.log('Координаты загружены:', gameCoords.length);
    } catch (error) {
        console.error('Ошибка загрузки координат:', error);
        // Fallback координаты
        gameCoords = [
            { name: "Минск, Проспект Независимости", lat: 53.9045, lng: 27.5615, region: "Минская область" },
            { name: "Гродно, Старый город", lat: 53.6884, lng: 23.8258, region: "Гродненская область" },
            { name: "Брест, Центр", lat: 52.4345, lng: 30.9754, region: "Брестская область" },
            { name: "Витебск, Центральная площадь", lat: 55.1904, lng: 30.2049, region: "Витебская область" },
            { name: "Гомель, Парк Луначарского", lat: 52.4345, lng: 30.9754, region: "Гомельская область" }
        ];
    }
}

// Загрузка статистики
function loadStats() {
    const bestScore = localStorage.getItem('belarus-guessor-best-score') || 0;
    const gamesPlayed = localStorage.getItem('belarus-guessor-games-played') || 0;
    
    document.getElementById('best-score').textContent = bestScore;
    document.getElementById('games-played').textContent = gamesPlayed;
}

// Сохранение статистики
function saveStats() {
    const currentBest = parseInt(localStorage.getItem('belarus-guessor-best-score')) || 0;
    const gamesPlayed = parseInt(localStorage.getItem('belarus-guessor-games-played')) || 0;
    
    if (gameState.score > currentBest) {
        localStorage.setItem('belarus-guessor-best-score', gameState.score);
    }
    
    localStorage.setItem('belarus-guessor-games-played', gamesPlayed + 1);
}

// Инициализация Яндекс.Карт
function initializeYandexMaps() {
    if (typeof ymaps !== 'undefined') {
        ymaps.ready(function() {
            console.log('Яндекс.Карты готовы');
        });
    } else {
        console.error('Яндекс.Карты не загружены. Проверьте API ключ.');
    }
}

// Навигация между экранами
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function showMainMenu() {
    showScreen('main-menu');
    loadStats();
    cleanupGame();
}

function showMultiplayer() {
    showScreen('multiplayer-menu');
    initializeMultiplayer();
}

// Начало одиночной игры
function startSoloGame() {
    resetGameState();
    showScreen('game-screen');
    loadNewRound();
}

// Сброс состояния игры
function resetGameState() {
    gameState = {
        currentRound: 1,
        totalRounds: 5,
        score: 0,
        roundResults: [],
        currentLocation: null,
        usedLocations: [],
        guessMarker: null,
        correctMarker: null,
        gameMap: null,
        panoramaPlayer: null
    };
    
    updateGameUI();
    updateRoundProgress();
}

// Обновление интерфейса игры
function updateGameUI() {
    document.getElementById('current-round').textContent = gameState.currentRound;
    document.getElementById('current-score').textContent = gameState.score.toLocaleString();
}

// Обновление прогресса раундов
function updateRoundProgress() {
    document.querySelectorAll('.round-dot').forEach((dot, index) => {
        const roundNum = index + 1;
        dot.classList.remove('active', 'completed');
        
        if (roundNum < gameState.currentRound) {
            dot.classList.add('completed');
        } else if (roundNum === gameState.currentRound) {
            dot.classList.add('active');
        }
    });
}

// Загрузка нового раунда
async function loadNewRound() {
    showLoader('Загрузка нового раунда...');
    
    try {
        // Выбор случайной неиспользованной локации
        const availableLocations = gameCoords.filter(loc => 
            !gameState.usedLocations.some(used => used.lat === loc.lat && used.lng === loc.lng)
        );
        
        if (availableLocations.length === 0) {
            throw new Error('Нет доступных локаций');
        }
        
        const randomLocation = availableLocations[Math.floor(Math.random() * availableLocations.length)];
        gameState.currentLocation = randomLocation;
        gameState.usedLocations.push(randomLocation);
        
        // Загрузка панорамы
        await loadPanorama(randomLocation);
        
        // Инициализация карты для выбора
        initializeGuessMap();
        
        // Обновление подсказки
        updateLocationHint();
        
        hideLoader();
        
    } catch (error) {
        console.error('Ошибка загрузки раунда:', error);
        hideLoader();
        alert('Ошибка загрузки раунда. Попробуйте снова.');
    }
}

// Загрузка панорамы
async function loadPanorama(location) {
    return new Promise((resolve, reject) => {
        if (typeof ymaps === 'undefined') {
            reject(new Error('Яндекс.Карты не загружены'));
            return;
        }
        
        ymaps.panorama.locate([location.lat, location.lng]).then(
            function(panoramas) {
                if (panoramas.length > 0) {
                    // Удаление предыдущей панорамы
                    if (gameState.panoramaPlayer) {
                        gameState.panoramaPlayer.destroy();
                    }
                    
                    // Создание новой панорамы
                    gameState.panoramaPlayer = new ymaps.panorama.Player(
                        'panorama',
                        panoramas[0],
                        {
                            direction: [Math.random() * 360, -10 + Math.random() * 20],
                            span: [90, 90],
                            controls: []
                        }
                    );
                    
                    resolve();
                } else {
                    reject(new Error('Панорама не найдена'));
                }
            },
            function(error) {
                reject(error);
            }
        );
    });
}

// Инициализация карты для выбора
function initializeGuessMap() {
    if (typeof ymaps === 'undefined') return;
    
    if (gameState.gameMap) {
        gameState.gameMap.destroy();
    }
    
    gameState.gameMap = new ymaps.Map('guess-map', {
        center: [53.9, 27.5], // Центр Беларуси
        zoom: 7,
        controls: ['zoomControl', 'typeSelector']
    });
    
    // Обработчик клика по карте
    gameState.gameMap.events.add('click', function(e) {
        const coords = e.get('coords');
        placeGuessMarker(coords);
    });
    
    // Сброс маркеров
    gameState.guessMarker = null;
    gameState.correctMarker = null;
    
    // Отключение кнопки выбора
    document.getElementById('make-guess-btn').disabled = true;
    document.getElementById('mobile-guess-btn').disabled = true;
}

// Размещение маркера выбора
function placeGuessMarker(coords) {
    // Удаление предыдущего маркера
    if (gameState.guessMarker) {
        gameState.gameMap.geoObjects.remove(gameState.guessMarker);
    }
    
    // Создание нового маркера
    gameState.guessMarker = new ymaps.Placemark(coords, {
        hintContent: 'Ваш выбор'
    }, {
        preset: 'islands#redDotIcon',
        draggable: false
    });
    
    gameState.gameMap.geoObjects.add(gameState.guessMarker);
    
    // Включение кнопки выбора
    document.getElementById('make-guess-btn').disabled = false;
    document.getElementById('mobile-guess-btn').disabled = false;
}

// Обновление подсказки о локации
function updateLocationHint() {
    const hints = [
        '🇧🇾 Где это в Беларуси?',
        '🏛️ Найдите это место на карте',
        '🗺️ Сделайте свой выбор',
        '📍 Укажите локацию',
        '🎯 Покажите, где это находится'
    ];
    
    const randomHint = hints[Math.floor(Math.random() * hints.length)];
    document.getElementById('location-hint').textContent = randomHint;
}

// Сделать выбор
function makeGuess() {
    if (!gameState.guessMarker) return;
    
    const guessCoords = gameState.guessMarker.geometry.getCoordinates();
    const actualCoords = [gameState.currentLocation.lat, gameState.currentLocation.lng];
    
    // Вычисление расстояния
    const distance = calculateDistance(guessCoords, actualCoords);
    
    // Вычисление очков
    const points = calculatePoints(distance);
    
    // Сохранение результата раунда
    const roundResult = {
        round: gameState.currentRound,
        location: gameState.currentLocation,
        guessCoords: guessCoords,
        actualCoords: actualCoords,
        distance: distance,
        points: points
    };
    
    gameState.roundResults.push(roundResult);
    gameState.score += points;
    
    // Показ правильной точки
    showCorrectLocation(actualCoords);
    
    // Показ результата раунда
    showRoundResult(roundResult);
    
    updateGameUI();
}

// Показ правильной локации на карте
function showCorrectLocation(coords) {
    gameState.correctMarker = new ymaps.Placemark(coords, {
        hintContent: 'Правильное место'
    }, {
        preset: 'islands#greenDotIcon',
        draggable: false
    });
    
    gameState.gameMap.geoObjects.add(gameState.correctMarker);
    
    // Показ линии между выбором и правильным местом
    if (gameState.guessMarker) {
        const line = new ymaps.Polyline([
            gameState.guessMarker.geometry.getCoordinates(),
            coords
        ], {}, {
            strokeColor: '#FF0000',
            strokeWidth: 3,
            strokeOpacity: 0.8
        });
        
        gameState.gameMap.geoObjects.add(line);
    }
    
    // Подгонка масштаба карты
    gameState.gameMap.setBounds(gameState.gameMap.geoObjects.getBounds(), {
        checkZoomRange: true,
        zoomMargin: 50
    });
}

// Вычисление расстояния между точками (в км)
function calculateDistance(coords1, coords2) {
    const R = 6371; // Радиус Земли в км
    const dLat = (coords2[0] - coords1[0]) * Math.PI / 180;
    const dLon = (coords2[1] - coords1[1]) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(coords1[0] * Math.PI / 180) * Math.cos(coords2[0] * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Вычисление очков на основе расстояния
function calculatePoints(distance) {
    const maxPoints = 5000;
    const maxDistance = 500; // Максимальное расстояние для получения очков
    
    if (distance >= maxDistance) return 0;
    
    // Экспоненциальное уменьшение очков
    const points = Math.round(maxPoints * Math.exp(-distance / 100));
    return Math.max(0, points);
}

// Показ результата раунда
function showRoundResult(result) {
    document.getElementById('result-distance').textContent = `${Math.round(result.distance)} км`;
    document.getElementById('result-points').textContent = result.points.toLocaleString();
    document.getElementById('result-total').textContent = gameState.score.toLocaleString();
    document.getElementById('correct-location').textContent = `${result.location.name}, ${result.location.region}`;
    
    // Эмодзи в зависимости от результата
    let emoji = '🎯';
    if (result.distance < 1) emoji = '🎯';
    else if (result.distance < 25) emoji = '🔥';
    else if (result.distance < 100) emoji = '👍';
    else if (result.distance < 250) emoji = '👌';
    else emoji = '🎲';
    
    document.getElementById('result-emoji').textContent = emoji;
    
    // Настройка кнопки следующего раунда
    const nextBtn = document.getElementById('next-round-btn');
    if (gameState.currentRound >= gameState.totalRounds) {
        nextBtn.textContent = '🏆 Показать итоги';
        nextBtn.onclick = showFinalResults;
    } else {
        nextBtn.textContent = '➡️ Следующий раунд';
        nextBtn.onclick = nextRound;
    }
    
    // Показ модального окна
    document.getElementById('round-result-modal').style.display = 'flex';
}

// Следующий раунд
function nextRound() {
    document.getElementById('round-result-modal').style.display = 'none';
    
    if (gameState.currentRound >= gameState.totalRounds) {
        showFinalResults();
        return;
    }
    
    gameState.currentRound++;
    updateGameUI();
    updateRoundProgress();
    loadNewRound();
}

// Пропуск раунда
function skipRound() {
    if (!confirm('Вы уверены, что хотите пропустить этот раунд?')) return;
    
    const roundResult = {
        round: gameState.currentRound,
        location: gameState.currentLocation,
        guessCoords: null,
        actualCoords: [gameState.currentLocation.lat, gameState.currentLocation.lng],
        distance: 1000, // Максимальное расстояние
        points: 0
    };
    
    gameState.roundResults.push(roundResult);
    showRoundResult(roundResult);
}

// Показ финальных результатов
function showFinalResults() {
    document.getElementById('round-result-modal').style.display = 'none';
    
    const finalScore = gameState.score;
    document.getElementById('final-score-value').textContent = finalScore.toLocaleString();
    
    // Эмодзи в зависимости от итогового счёта
    let emoji = '🎉';
    if (finalScore >= 20000) emoji = '🏆';
    else if (finalScore >= 15000) emoji = '🥇';
    else if (finalScore >= 10000) emoji = '🥈';
    else if (finalScore >= 5000) emoji = '🥉';
    
    document.getElementById('final-emoji').textContent = emoji;
    
    // Разбивка по раундам
    const breakdown = document.getElementById('rounds-breakdown');
    breakdown.innerHTML = '';
    
    gameState.roundResults.forEach((result, index) => {
        const roundItem = document.createElement('div');
        roundItem.className = 'round-item';
        roundItem.innerHTML = `
            <span>Раунд ${index + 1}: ${result.location.name}</span>
            <span>${result.points.toLocaleString()} очков</span>
        `;
        breakdown.appendChild(roundItem);
    });
    
    // Сохранение статистики
    saveStats();
    
    // Показ модального окна
    document.getElementById('final-result-modal').style.display = 'flex';
}

// Показ результатов на карте
function showResultsOnMap() {
    document.getElementById('round-result-modal').style.display = 'none';
    // Карта уже показывает результаты
}

// Поделиться результатами
function shareResults() {
    const text = `🇧🇾 BelarusGuessor PRO 🇧🇾\n\nМой результат: ${gameState.score.toLocaleString()} очков!\nРаундов пройдено: ${gameState.roundResults.length}/${gameState.totalRounds}\n\nПопробуй и ты: [ссылка на игру]`;
    
    if (navigator.share) {
        navigator.share({
            title: 'BelarusGuessor PRO - Мои результаты',
            text: text
        });
    } else {
        // Копирование в буфер обмена
        navigator.clipboard.writeText(text).then(() => {
            alert('Результаты скопированы в буфер обмена!');
        });
    }
}

// Очистка ресурсов игры
function cleanupGame() {
    if (gameState.panoramaPlayer) {
        gameState.panoramaPlayer.destroy();
        gameState.panoramaPlayer = null;
    }
    
    if (gameState.gameMap) {
        gameState.gameMap.destroy();
        gameState.gameMap = null;
    }
}

// Лоадер
function showLoader(message = 'Загрузка...') {
    const loader = document.getElementById('loader');
    loader.querySelector('p').textContent = message;
    loader.classList.remove('hidden');
}

function hideLoader() {
    document.getElementById('loader').classList.add('hidden');
}

// Обработчики закрытия модальных окон
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
});

// Обработчик клавиш
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        // Закрытие модальных окон
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }
});

// Функции настроек (заглушки)
function showSettings() {
    alert('Настройки будут добавлены в будущих обновлениях!');
}

// Автосохранение при закрытии страницы
window.addEventListener('beforeunload', function() {
    cleanupGame();
});