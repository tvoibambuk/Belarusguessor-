// --- Добавленные / обновлённые функции (вставь в script.js, заменив имеющиеся заглушки) ---

// Утилита: перемешать массив in-place (Fisher–Yates)
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

// Загрузка данных игры (coords.json) и подготовка gameCoords
async function loadGameData() {
    try {
        console.log('[Game] Загрузка coords.json...');
        const res = await fetch('coords.json', {cache: "no-store"});
        if (!res.ok) {
            throw new Error(`Не удалось загрузить coords.json: ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
            console.warn('[Game] coords.json пустой или не массив.');
            gameCoords = [];
            return;
        }
        // Ожидаем, что каждый элемент имеет {lat, lon, name, region, ...}
        gameCoords = data.slice(); // копия
        shuffleArray(gameCoords);
        console.log(`[Game] Загружено ${gameCoords.length} локаций.`);
    } catch (err) {
        console.error('[Game] Ошибка при loadGameData:', err);
        gameCoords = [];
    }
}

// Загрузка панорамы по координатам (использует ymaps.panorama.locate / Player)
async function loadPanorama(location) {
    showLoader('Загрузка панорамы...');
    try {
        if (typeof ymaps === 'undefined' || !ymaps.panorama) {
            throw new Error('ymaps или ymaps.panorama не доступны. Проверь API ключ и подключение скрипта Яндекс.Карт.');
        }

        console.log('[Game] Ищем панорамы около', location);
        // ymaps.panorama.locate возвращает Promise, который резолвится массивом панорам
        const panoramas = await ymaps.panorama.locate([location.lat, location.lon], {results: 10});
        if (!panoramas || panoramas.length === 0) {
            throw new Error('Панорама не найдена для этой локации');
        }

        // Берём первую панораму
        const panoData = panoramas[0];
        // Уничтожаем предыдущий плеер если есть
        if (gameState.panoramaPlayer && typeof gameState.panoramaPlayer.destroy === 'function') {
            try { gameState.panoramaPlayer.destroy(); } catch (e) { console.warn('Ошибка при destroy panorama player', e); }
            gameState.panoramaPlayer = null;
        }

        // Создаём плеер в контейнере с id="panorama"
        gameState.panoramaPlayer = new ymaps.panorama.Player('panorama', panoData, {
            // опции плеера — можно настроить контролы
            suppressMapOpenBlock: true
        });

        // Установим начальное направление, если нужно
        gameState.initialPanoramaDirection = gameState.panoramaPlayer.getDirection ? gameState.panoramaPlayer.getDirection() : null;

        console.log('[Game] Панорама загружена.');
    } catch (err) {
        console.error('[Game] Ошибка при loadPanorama:', err);
        alert('Не удалось загрузить панораму для выбранной локации. Попробуйте начать игру снова.');
        // Пробуем перейти к следующей локации, не завершая игру
        hideLoader();
        return Promise.reject(err);
    } finally {
        hideLoader();
    }
}

// Загрузить новый раунд: выбрать локацию, загрузить панораму и стартовать таймер
async function loadNewRound() {
    try {
        // Если уже превысили количество раундов — показать финальную форму
        if (gameState.currentRound > gameState.totalRounds) {
            console.log('[Game] Все раунды сыграны — показываем результаты');
            showFinalResults();
            return;
        }

        // Убедимся, что есть данные локаций
        if (!Array.isArray(gameCoords) || gameCoords.length === 0) {
            console.warn('[Game] gameCoords пуст, выполняю загрузку данных...');
            await loadGameData();
            if (!Array.isArray(gameCoords) || gameCoords.length === 0) {
                console.error('[Game] Нет доступных локаций после загрузки — завершаем игру.');
                showFinalResults();
                return;
            }
        }

        // Берём локацию (pop — чтобы не повторять)
        const location = gameCoords.pop();
        gameState.currentLocation = location;
        console.log(`[Game] Раунд ${gameState.currentRound}: выбранa локация`, location);

        // Скрыть предыдущие метки/линии
        if (gameState.guessMarker) {
            try { gameState.guessMarker.setMap(null); } catch (e) {}
            gameState.guessMarker = null;
        }
        if (gameState.correctMarker) {
            try { gameState.correctMarker.setMap(null); } catch (e) {}
            gameState.correctMarker = null;
        }
        if (gameState.lineToTarget) {
            try { gameState.lineToTarget.setMap(null); } catch (e) {}
            gameState.lineToTarget = null;
        }

        // Загрузить панораму для выбранной локации
        await loadPanorama(location);

        // Пометить время старта раунда
        gameState.roundStartTime = Date.now();

        // Обновить интерфейс
        updateGameUI();
        updateRoundProgress();

        // Если требуется — запустить таймер раунда
        startRoundTimer && startRoundTimer();

    } catch (err) {
        console.error('[Game] Ошибка в loadNewRound:', err);
        // Если не удалось загрузить панораму, попробуем следующий раунд автоматически (с ограничением)
        setTimeout(() => {
            // Если осталось локаций — пробуем следующую
            if (gameCoords.length > 0 && gameState.currentRound <= gameState.totalRounds) {
                loadNewRound();
            } else {
                showFinalResults();
            }
        }, 800);
    }
}

// Пример безопасного старта соло-игры (уже есть startSoloGame, но на всякий случай)
async function startSoloGame() {
    resetGameState();
    showScreen('game-screen');

    // Убедимся, что локации загружены
    if (!gameCoords || gameCoords.length === 0) {
        await loadGameData();
    }

    // Запускаем первый раунд
    loadNewRound();
}

// --- Конец вставки ---