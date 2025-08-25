// Мультиплеер функциональность
class MultiplayerManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.roomCode = null;
        this.playerId = null;
        this.players = [];
        this.gameState = null;
    }

    // Инициализация мультиплеера
    initialize() {
        this.generatePlayerId();
        this.connectToServer();
    }

    // Генерация уникального ID игрока
    generatePlayerId() {
        this.playerId = 'player_' + Math.random().toString(36).substr(2, 9);
    }

    // Подключение к серверу WebSocket
    connectToServer() {
        try {
            // В реальном приложении здесь будет адрес вашего WebSocket сервера
            const wsUrl = 'wss://your-websocket-server.com/multiplayer';
            
            this.socket = new WebSocket(wsUrl);
            
            this.socket.onopen = () => {
                console.log('Подключено к серверу мультиплеера');
                this.isConnected = true;
                this.updateConnectionStatus(true);
            };
            
            this.socket.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };
            
            this.socket.onclose = () => {
                console.log('Отключено от сервера');
                this.isConnected = false;
                this.updateConnectionStatus(false);
            };
            
            this.socket.onerror = (error) => {
                console.error('Ошибка WebSocket:', error);
                this.showConnectionError();
            };
            
        } catch (error) {
            console.error('Не удалось подключиться к серверу:', error);
            this.showConnectionError();
        }
    }

    // Обработка сообщений от сервера
    handleMessage(message) {
        switch (message.type) {
            case 'room_created':
                this.handleRoomCreated(message.data);
                break;
            case 'room_joined':
                this.handleRoomJoined(message.data);
                break;
            case 'player_joined':
                this.handlePlayerJoined(message.data);
                break;
            case 'player_left':
                this.handlePlayerLeft(message.data);
                break;
            case 'game_started':
                this.handleGameStarted(message.data);
                break;
            case 'round_started':
                this.handleRoundStarted(message.data);
                break;
            case 'player_guessed':
                this.handlePlayerGuessed(message.data);
                break;
            case 'round_ended':
                this.handleRoundEnded(message.data);
                break;
            case 'game_ended':
                this.handleGameEnded(message.data);
                break;
            case 'error':
                this.handleError(message.data);
                break;
        }
    }

    // Отправка сообщения на сервер
    sendMessage(type, data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: type,
                playerId: this.playerId,
                data: data
            }));
        }
    }

    // Создание комнаты
    createRoom() {
        if (!this.isConnected) {
            this.showConnectionError();
            return;
        }

        this.sendMessage('create_room', {
            playerName: this.getPlayerName(),
            gameSettings: {
                rounds: 5,
                timeLimit: 120000, // 2 минуты на раунд
                difficulty: 'mixed'
            }
        });
    }

    // Присоединение к комнате
    joinRoom() {
        if (!this.isConnected) {
            this.showConnectionError();
            return;
        }

        const roomCode = prompt('Введите код комнаты:');
        if (roomCode) {
            this.sendMessage('join_room', {
                roomCode: roomCode.toUpperCase(),
                playerName: this.getPlayerName()
            });
        }
    }

    // Получение имени игрока
    getPlayerName() {
        let playerName = localStorage.getItem('belarus-guessor-player-name');
        if (!playerName) {
            playerName = prompt('Введите ваше имя:') || 'Анонимный игрок';
            localStorage.setItem('belarus-guessor-player-name', playerName);
        }
        return playerName;
    }

    // Обработчики событий
    handleRoomCreated(data) {
        this.roomCode = data.roomCode;
        this.updateRoomInfo(data);
        document.getElementById('room-info').classList.remove('hidden');
    }

    handleRoomJoined(data) {
        this.roomCode = data.roomCode;
        this.players = data.players;
        this.updateRoomInfo(data);
        document.getElementById('room-info').classList.remove('hidden');
    }

    handlePlayerJoined(data) {
        this.players.push(data.player);
        this.updatePlayersList();
        this.showNotification(`${data.player.name} присоединился к игре`);
    }

    handlePlayerLeft(data) {
        this.players = this.players.filter(p => p.id !== data.playerId);
        this.updatePlayersList();
        this.showNotification(`Игрок покинул игру`);
    }

    handleGameStarted(data) {
        this.gameState = data.gameState;
        this.showNotification('Игра началась!');
        
        // Переход к игровому экрану
        showScreen('game-screen');
        this.startMultiplayerRound(data.roundData);
    }

    handleRoundStarted(data) {
        this.startMultiplayerRound(data);
    }

    handlePlayerGuessed(data) {
        this.showPlayerGuess(data);
    }

    handleRoundEnded(data) {
        this.showRoundResults(data);
    }

    handleGameEnded(data) {
        this.showFinalResults(data);
    }

    handleError(data) {
        alert(`Ошибка: ${data.message}`);
    }

    // Начало мультиплеерного раунда
    startMultiplayerRound(roundData) {
        // Загрузка панорамы для всех игроков одновременно
        gameState.currentLocation = roundData.location;
        loadPanorama(roundData.location).then(() => {
            initializeGuessMap();
            this.startRoundTimer(roundData.timeLimit);
        });
    }

    // Таймер раунда
    startRoundTimer(timeLimit) {
        let timeLeft = timeLimit;
        const timerInterval = setInterval(() => {
            timeLeft -= 1000;
            this.updateTimer(timeLeft);
            
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                this.forceSubmitGuess();
            }
        }, 1000);
    }

    // Принудительная отправка догадки по таймеру
    forceSubmitGuess() {
        if (gameState.guessMarker) {
            this.submitGuess();
        } else {
            // Случайная догадка, если игрок не успел
            this.sendMessage('submit_guess', {
                coords: null,
                isTimeout: true
            });
        }
    }

    // Отправка догадки
    submitGuess() {
        if (!gameState.guessMarker) return;
        
        const coords = gameState.guessMarker.geometry.getCoordinates();
        this.sendMessage('submit_guess', {
            coords: coords,
            timestamp: Date.now()
        });
        
        // Блокировка повторной отправки
        document.getElementById('make-guess-btn').disabled = true;
        document.getElementById('mobile-guess-btn').disabled = true;
    }

    // Обновление интерфейса
    updateConnectionStatus(connected) {
        const statusText = connected ? 'Подключено к серверу' : 'Подключение к серверу...';
        document.querySelector('#multiplayer-menu p').textContent = statusText;
    }

    updateRoomInfo(data) {
        document.getElementById('room-code').textContent = data.roomCode;
        this.players = data.players;
        this.updatePlayersList();
    }

    updatePlayersList() {
        const playersList = document.getElementById('players-list');
        playersList.innerHTML = '<h4>Игроки в комнате:</h4>';
        
        this.players.forEach(player => {
            const playerElement = document.createElement('div');
            playerElement.className = 'player-item';
            playerElement.innerHTML = `
                <span>${player.name}</span>
                <span class="player-status">${player.ready ? '✅' : '⏳'}</span>
            `;
            playersList.appendChild(playerElement);
        });
    }

    updateTimer(timeLeft) {
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        const timerText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Обновление таймера в интерфейсе
        let timerElement = document.getElementById('multiplayer-timer');
        if (!timerElement) {
            timerElement = document.createElement('div');
            timerElement.id = 'multiplayer-timer';
            timerElement.className = 'multiplayer-timer';
            document.querySelector('.game-header').appendChild(timerElement);
        }
        timerElement.textContent = `⏱️ ${timerText}`;
    }

    showPlayerGuess(data) {
        // Показ маркера догадки другого игрока на карте
        const marker = new ymaps.Placemark(data.coords, {
            hintContent: data.playerName
        }, {
            preset: 'islands#blueDotIcon',
            iconColor: data.playerColor || '#0099ff'
        });
        
        gameState.gameMap.geoObjects.add(marker);
    }

    showRoundResults(data) {
        // Показ результатов раунда для всех игроков
        this.displayMultiplayerResults(data.results);
    }

    showFinalResults(data) {
        // Показ финальных результатов игры
        this.displayFinalMultiplayerResults(data.finalResults);
    }

    displayMultiplayerResults(results) {
        // Создание таблицы результатов
        let resultsHTML = '<div class="multiplayer-results"><h3>Результаты раунда</h3><table>';
        resultsHTML += '<tr><th>Игрок</th><th>Расстояние</th><th>Очки</th></tr>';
        
        results.forEach(result => {
            resultsHTML += `
                <tr>
                    <td>${result.playerName}</td>
                    <td>${Math.round(result.distance)} км</td>
                    <td>${result.points.toLocaleString()}</td>
                </tr>
            `;
        });
        
        resultsHTML += '</table></div>';
        
        // Показ в модальном окне
        const modal = document.createElement('div');
        modal.className = 'modal multiplayer-results-modal';
        modal.innerHTML = `
            <div class="modal-content">
                ${resultsHTML}
                <button onclick="this.parentElement.parentElement.remove()">Продолжить</button>
            </div>
        `;
        document.body.appendChild(modal);
    }

    showNotification(message) {
        // Простая система уведомлений
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4facfe;
            color: white;
            padding: 1rem;
            border-radius: 8px;
            z-index: 9999;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    showConnectionError() {
        alert('Не удалось подключиться к серверу мультиплеера.\n\nВозможные причины:\n- Сервер временно недоступен\n- Проблемы с интернет-соединением\n- Необходимо настроить WebSocket сервер\n\nПопробуйте позже или играйте в одиночном режиме.');
    }

    // Выход из комнаты
    leaveRoom() {
        if (this.roomCode) {
            this.sendMessage('leave_room', {});
            this.roomCode = null;
            this.players = [];
            document.getElementById('room-info').classList.add('hidden');
        }
    }

    // Отключение от сервера
    disconnect() {
        if (this.socket) {
            this.socket.close();
        }
    }
}

// Глобальный экземпляр менеджера мультиплеера
const multiplayerManager = new MultiplayerManager();

// Функции для интеграции с основным интерфейсом
function initializeMultiplayer() {
    multiplayerManager.initialize();
}

function createRoom() {
    multiplayerManager.createRoom();
}

function joinRoom() {
    multiplayerManager.joinRoom();
}

// Интеграция с основной игрой
function makeMultiplayerGuess() {
    multiplayerManager.submitGuess();
}

// Очистка при выходе
window.addEventListener('beforeunload', () => {
    multiplayerManager.disconnect();
});

// CSS стили для мультиплеера (добавляются динамически)
const multiplayerStyles = `
    .multiplayer-timer {
        background: rgba(255,255,255,0.1);
        padding: 0.5rem 1rem;
        border-radius: 8px;
        font-weight: bold;
        color: #ffd23f;
    }
    
    .player-item {
        display: flex;
        justify-content: space-between;
        padding: 0.5rem;
        margin: 0.25rem 0;
        background: rgba(255,255,255,0.1);
        border-radius: 6px;
    }
    
    .notification {
        animation: slideIn 0.3s ease;
    }
    
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .multiplayer-results table {
        width: 100%;
        border-collapse: collapse;
        margin: 1rem 0;
    }
    
    .multiplayer-results th,
    .multiplayer-results td {
        padding: 0.5rem;
        text-align: left;
        border-bottom: 1px solid rgba(255,255,255,0.2);
    }
    
    .multiplayer-results th {
        background: rgba(255,255,255,0.1);
        font-weight: bold;
    }
`;

// Добавление стилей в документ
const styleSheet = document.createElement('style');
styleSheet.textContent = multiplayerStyles;
document.head.appendChild(styleSheet);