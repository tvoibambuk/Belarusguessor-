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
    panoramaPlayer: null,
    roundTimer: null,
    roundStartTime: null,
    isMobileView: false,
    isFullscreen: false,
    lineToTarget: null,
    initialPanoramaDirection: null
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
    
    // Обновление статуса выбора
    updateGuessStatus();
}

// Обновление прогресса раундов
function updateRoundProgress() {
    document.querySelectorAll('.round-dot').forEach((dot, index) => {
        const roundNum = index + 1;
        const scoreElement = dot.querySelector('.dot-score');
        
        dot.classList.remove('active', 'completed');
        
        if (roundNum < gameState.currentRound) {
            dot.classList.add('completed');
            const roundResult = gameState.roundResults[index];
            if (roundResult) {
                scoreElement.textContent = roundResult.points.toLocaleString();
            }
        } else if (roundNum === gameState.currentRound) {
            dot.classList.add('active');
            scoreElement.textContent = '...';
        } else {
            scoreElement.textContent = '0';
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
        showPanoramaLoader(true);
        
        if (typeof ymaps === 'undefined') {
            // Демо-режим с красивыми фото
            loadDemoPanorama(location);
            showPanoramaLoader(false);
            resolve();
            return;
        }
        
        ymaps.panorama.locate([location.lat, location.lng]).then(
            function(panoramas) {
                if (panoramas.length > 0) {
                    // Удаление предыдущей панорамы
                    if (gameState.panoramaPlayer) {
                        gameState.panoramaPlayer.destroy();
                    }
                    
                    // Случайное направление обзора
                    const randomDirection = [Math.random() * 360, -15 + Math.random() * 30];
                    gameState.initialPanoramaDirection = randomDirection;
                    
                    // Создание новой панорамы
                    gameState.panoramaPlayer = new ymaps.panorama.Player(
                        'panorama',
                        panoramas[0],
                        {
                            direction: randomDirection,
                            span: [90, 90],
                            controls: ['zoomControl', 'fullscreenControl']
                        }
                    );
                    
                    // Обработчики событий панорамы
                    setupPanoramaEvents();
                    
                    showPanoramaLoader(false);
                    resolve();
                } else {
                    // Падбэк на демо-режим
                    loadDemoPanorama(location);
                    showPanoramaLoader(false);
                    resolve();
                }
            },
            function(error) {
                console.warn('Ошибка загрузки панорамы:', error);
                loadDemoPanorama(location);
                showPanoramaLoader(false);
                resolve();
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
    
    // Создание нового маркера с красивой иконкой
    gameState.guessMarker = new ymaps.Placemark(coords, {
        hintContent: 'Ваш выбор',
        balloonContent: `
            <div style="text-align: center; padding: 10px;">
                <strong>📍 Ваш выбор</strong><br>
                <small>Координаты: ${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}</small>
            </div>
        `
    }, {
        preset: 'islands#redIcon',
        iconColor: '#ff4757',
        draggable: true
    });
    
    // Обработчик перетаскивания
    gameState.guessMarker.events.add('dragend', function() {
        const newCoords = gameState.guessMarker.geometry.getCoordinates();
        updateGuessStatus();
        showLiveDistance(newCoords);
    });
    
    gameState.gameMap.geoObjects.add(gameState.guessMarker);
    
    // Обновление интерфейса
    updateGuessStatus();
    showLiveDistance(coords);
    
    // Включение кнопок
    document.getElementById('make-guess-btn').disabled = false;
    document.getElementById('mobile-guess-btn').disabled = false;
    document.getElementById('clear-guess-btn').style.display = 'block';
    document.getElementById('mobile-clear-btn').style.display = 'flex';
}

// Обновление подсказки о локации
function updateLocationHint() {
    const hints = [
        {
            icon: '🇧🇾',
            text: 'Где это в Беларуси?'
        },
        {
            icon: '🏛️',
            text: 'Найдите это место на карте'
        },
        {
            icon: '🗺️',
            text: 'Сделайте свой выбор'
        },
        {
            icon: '📍',
            text: 'Укажите локацию'
        },
        {
            icon: '🎯',
            text: 'Покажите, где это находится'
        }
    ];
    
    const randomHint = hints[Math.floor(Math.random() * hints.length)];
    const hintElement = document.getElementById('location-hint');
    const iconElement = hintElement ? hintElement.querySelector('.hint-icon') : null;
    const textElement = hintElement ? hintElement.querySelector('.hint-text') : null;
    
    if (iconElement && textElement) {
        iconElement.textContent = randomHint.icon;
        textElement.textContent = randomHint.text;
    } else {
        // Fallback для старого формата
        if (hintElement) {
            hintElement.textContent = randomHint.icon + ' ' + randomHint.text;
        }
    }
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
    // Красивый маркер правильного места
    gameState.correctMarker = new ymaps.Placemark(coords, {
        hintContent: 'Правильное место',
        balloonContent: `
            <div style="text-align: center; padding: 15px;">
                <strong>✅ Правильное место</strong><br>
                <h4 style="margin: 10px 0; color: #2d8659;">${gameState.currentLocation.name}</h4>
                <small style="color: #666;">${gameState.currentLocation.region}</small><br>
                <small style="color: #888;">Координаты: ${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}</small>
            </div>
        `
    }, {
        preset: 'islands#greenIcon',
        iconColor: '#2ed573',
        draggable: false
    });
    
    gameState.gameMap.geoObjects.add(gameState.correctMarker);
    
    // Красивая линия между выбором и правильным местом
    if (gameState.guessMarker) {
        const guessCoords = gameState.guessMarker.geometry.getCoordinates();
        const distance = calculateDistance(guessCoords, coords);
        
        // Цвет линии в зависимости от расстояния
        let lineColor = '#ff4757'; // Красный по умолчанию
        if (distance < 25) lineColor = '#2ed573'; // Зеленый для хороших результатов
        else if (distance < 100) lineColor = '#ffa726'; // Оранжевый для средних
        
        gameState.lineToTarget = new ymaps.Polyline([
            guessCoords,
            coords
        ], {
            hintContent: `Расстояние: ${Math.round(distance)} км`
        }, {
            strokeColor: lineColor,
            strokeWidth: 4,
            strokeOpacity: 0.8,
            strokeStyle: 'shortdash'
        });
        
        gameState.gameMap.geoObjects.add(gameState.lineToTarget);
        
        // Анимация появления линии
        animateLineAppearance();
    }
    
    // Плавный переход к обзору всех маркеров
    setTimeout(() => {
        gameState.gameMap.setBounds(gameState.gameMap.geoObjects.getBounds(), {
            checkZoomRange: true,
            zoomMargin: [20, 20, 20, 20],
            duration: 1000
        });
    }, 300);
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

// Новые функции для улучшенного интерфейса

// Обновление статуса выбора
function updateGuessStatus() {
    const statusElement = document.getElementById('guess-status');
    const statusText = statusElement ? statusElement.querySelector('.status-text') : null;
    
    if (statusText) {
        if (gameState.guessMarker) {
            statusText.textContent = 'Маркер размещен ✓';
            statusElement.style.background = 'rgba(46, 213, 115, 0.2)';
            statusElement.style.borderColor = 'rgba(46, 213, 115, 0.5)';
        } else {
            statusText.textContent = 'Нажмите на карту';
            statusElement.style.background = 'rgba(255,255,255,0.1)';
            statusElement.style.borderColor = 'rgba(255,255,255,0.2)';
        }
    }
}

// Лоадер панорамы
function showPanoramaLoader(show) {
    const loader = document.getElementById('panorama-loader');
    if (loader) {
        loader.style.display = show ? 'block' : 'none';
    }
}

// Демо-панорама
function loadDemoPanorama(location) {
    const panoramaDiv = document.getElementById('panorama');
    
    // Красивые градиенты для разных мест
    const gradients = [
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'linear-gradient(135deg, #43e97b 0%, #38d9a9 100%)',
        'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
    ];
    
    const randomGradient = gradients[Math.floor(Math.random() * gradients.length)];
    
    panoramaDiv.innerHTML = `
        <div style="
            width: 100%; 
            height: 100%; 
            background: ${randomGradient};
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            text-align: center;
            font-size: 1.2rem;
            font-weight: 600;
            flex-direction: column;
            padding: 2rem;
        ">
            <div style="font-size: 4rem; margin-bottom: 1rem; animation: bounce 2s infinite;">🏢</div>
            <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">Панорамный вид</div>
            <div style="font-size: 1.1rem; opacity: 0.9; margin-bottom: 1rem;">${location.name}</div>
            <div style="font-size: 0.9rem; opacity: 0.7; text-align: center; line-height: 1.4;">
                Для настоящих панорам Yandex Maps<br>
                добавьте API ключ в index.html
            </div>
        </div>
    `;
    
    console.log('Panorama loaded for location:', location.name.split(',')[0]);
}

// Настройка событий панорамы
function setupPanoramaEvents() {
    if (!gameState.panoramaPlayer) return;
    
    // Обработчик изменения направления
    gameState.panoramaPlayer.events.add('directionchange', function() {
        // Можно добавить логику отслеживания поворотов
    });
}

// Полноэкранный режим панорамы
function toggleFullscreen() {
    const panoramaContainer = document.querySelector('.panorama-container');
    
    if (!gameState.isFullscreen) {
        if (panoramaContainer.requestFullscreen) {
            panoramaContainer.requestFullscreen();
        } else if (panoramaContainer.webkitRequestFullscreen) {
            panoramaContainer.webkitRequestFullscreen();
        } else if (panoramaContainer.mozRequestFullScreen) {
            panoramaContainer.mozRequestFullScreen();
        }
        gameState.isFullscreen = true;
        const btn = document.getElementById('fullscreen-btn');
        if (btn && btn.querySelector('.btn-text')) {
            btn.querySelector('.btn-text').textContent = 'Выйти из полного';
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        }
        gameState.isFullscreen = false;
        const btn = document.getElementById('fullscreen-btn');
        if (btn && btn.querySelector('.btn-text')) {
            btn.querySelector('.btn-text').textContent = 'Полный экран';
        }
    }
}

// Сброс вида панорамы
function resetPanoramaView() {
    if (gameState.panoramaPlayer && gameState.initialPanoramaDirection) {
        gameState.panoramaPlayer.setDirection(gameState.initialPanoramaDirection);
        gameState.panoramaPlayer.setSpan([90, 90]);
    }
}

// Очистка выбора
function clearGuess() {
    if (gameState.guessMarker) {
        gameState.gameMap.geoObjects.remove(gameState.guessMarker);
        gameState.guessMarker = null;
    }
    
    // Обновление интерфейса
    updateGuessStatus();
    document.getElementById('make-guess-btn').disabled = true;
    document.getElementById('mobile-guess-btn').disabled = true;
    const clearBtn = document.getElementById('clear-guess-btn');
    const mobileClearBtn = document.getElementById('mobile-clear-btn');
    if (clearBtn) clearBtn.style.display = 'none';
    if (mobileClearBtn) mobileClearBtn.style.display = 'none';
    
    // Скрытие информации о расстоянии
    const distanceInfo = document.getElementById('distance-info');
    if (distanceInfo) distanceInfo.style.display = 'none';
}

// Показ расстояния в реальном времени
function showLiveDistance(guessCoords) {
    if (!gameState.currentLocation) return;
    
    const actualCoords = [gameState.currentLocation.lat, gameState.currentLocation.lng];
    const distance = calculateDistance(guessCoords, actualCoords);
    
    const distanceInfo = document.getElementById('distance-info');
    const liveDistance = document.getElementById('live-distance');
    
    if (distanceInfo && liveDistance) {
        liveDistance.textContent = `${Math.round(distance)} км`;
        distanceInfo.style.display = 'block';
        
        // Цветовая индикация точности
        if (distance < 25) {
            liveDistance.style.color = '#2ed573';
        } else if (distance < 100) {
            liveDistance.style.color = '#ffa726';
        } else {
            liveDistance.style.color = '#ff4757';
        }
    }
}

// Мобильное переключение вида
function toggleMobileView() {
    const gameContent = document.querySelector('.game-content');
    const toggleIcon = document.getElementById('toggle-icon');
    const toggleText = document.getElementById('toggle-text');
    
    if (gameContent && toggleIcon && toggleText) {
        gameState.isMobileView = !gameState.isMobileView;
        
        if (gameState.isMobileView) {
            // Показать только карту
            gameContent.style.gridTemplateRows = '0fr 1fr';
            toggleIcon.textContent = '📷';
            toggleText.textContent = 'Панорама';
        } else {
            // Показать оба элемента
            gameContent.style.gridTemplateRows = '2fr 1fr';
            toggleIcon.textContent = '🗺️';
            toggleText.textContent = 'Карта';
        }
    }
}

// Анимация появления линии
function animateLineAppearance() {
    if (!gameState.lineToTarget) return;
    
    // Простая анимация мигания
    let opacity = 0;
    const fadeIn = setInterval(() => {
        opacity += 0.1;
        if (gameState.lineToTarget) {
            gameState.lineToTarget.options.set('strokeOpacity', opacity);
        }
        if (opacity >= 0.8) {
            clearInterval(fadeIn);
        }
    }, 50);
}

// Автосохранение при закрытии страницы
window.addEventListener('beforeunload', function() {
    cleanupGame();
});

// Обработчик выхода из полноэкранного режима
document.addEventListener('fullscreenchange', function() {
    if (!document.fullscreenElement) {
        gameState.isFullscreen = false;
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        if (fullscreenBtn && fullscreenBtn.querySelector('.btn-text')) {
            fullscreenBtn.querySelector('.btn-text').textContent = 'Полный экран';
        }
    }
});

// Оптимизация для мобильных устройств
if (window.innerWidth <= 768) {
    // Автоматическое переключение на мобильные элементы управления
    document.addEventListener('DOMContentLoaded', function() {
        const mobileControls = document.querySelector('.mobile-controls');
        const roundProgress = document.querySelector('.round-progress');
        
        if (mobileControls) mobileControls.style.display = 'flex';
        if (roundProgress) roundProgress.style.bottom = '100px';
    });
}