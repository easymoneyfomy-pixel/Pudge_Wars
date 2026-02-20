/**
 * UI Module
 * Управление пользовательским интерфейсом
 */
class UI {
  constructor(network, game) {
    this.network = network;
    this.game = game;
    
    // Элементы DOM
    this.screens = {
      connect: document.getElementById('connect-screen'),
      lobby: document.getElementById('lobby-screen'),
      room: document.getElementById('room-screen'),
      game: document.getElementById('game-screen'),
    };
    
    // Элементы подключения
    this.connectElements = {
      nameInput: document.getElementById('player-name'),
      serverInput: document.getElementById('server-url'),
      connectBtn: document.getElementById('connect-btn'),
      status: document.getElementById('connect-status'),
    };
    
    // Элементы лобби
    this.lobbyElements = {
      playerName: document.getElementById('lobby-player-name'),
      disconnectBtn: document.getElementById('disconnect-btn'),
      roomsList: document.getElementById('rooms-list'),
      refreshBtn: document.getElementById('refresh-rooms-btn'),
      roomNameInput: document.getElementById('room-name'),
      maxPlayersSelect: document.getElementById('max-players'),
      createRoomBtn: document.getElementById('create-room-btn'),
    };
    
    // Элементы комнаты
    this.roomElements = {
      nameDisplay: document.getElementById('room-name-display'),
      playersCount: document.getElementById('room-players-count'),
      playersList: document.getElementById('room-players-list'),
      leaveRoomBtn: document.getElementById('leave-room-btn'),
      hostControls: document.getElementById('host-controls'),
      startGameBtn: document.getElementById('start-game-btn'),
      cancelStartBtn: document.getElementById('cancel-start-btn'),
      waitingMessage: document.getElementById('waiting-message'),
      countdownDisplay: document.getElementById('countdown-display'),
      countdownNumber: document.getElementById('countdown-number'),
    };
    
    // Элементы игры
    this.gameElements = {
      canvas: document.getElementById('game-canvas'),
      hpBar: document.getElementById('player-hp-bar'),
      hpText: document.getElementById('player-hp-text'),
      hookCooldownBar: document.querySelector('#hook-cooldown-bar .cooldown-fill'),
      gameTimer: document.getElementById('game-timer'),
      gameMessage: document.getElementById('game-message'),
      statKills: document.getElementById('stat-kills'),
      statDeaths: document.getElementById('stat-deaths'),
      statHooks: document.getElementById('stat-hooks'),
      deathScreen: document.getElementById('death-screen'),
      respawnTimer: document.getElementById('respawn-timer'),
      gameoverScreen: document.getElementById('gameover-screen'),
      gameoverTitle: document.getElementById('gameover-title'),
      gameoverWinner: document.getElementById('gameover-winner'),
      leaderboardTable: document.getElementById('leaderboard-table').querySelector('tbody'),
      backToLobbyBtn: document.getElementById('back-to-lobby-btn'),
      exitGameBtn: document.getElementById('exit-game-btn'),
    };
    
    // Состояние
    this.isHost = false;
    
    // Привязка обработчиков
    this.bindEvents();
    
    console.log('[UI] Initialized');
  }
  
  /**
   * Привязка событий
   */
  bindEvents() {
    // Подключение
    this.connectElements.connectBtn.addEventListener('click', () => this.handleConnect());
    this.connectElements.serverInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleConnect();
    });
    
    // Лобби
    this.lobbyElements.disconnectBtn.addEventListener('click', () => this.handleDisconnect());
    this.lobbyElements.refreshBtn.addEventListener('click', () => this.handleRefreshRooms());
    this.lobbyElements.createRoomBtn.addEventListener('click', () => this.handleCreateRoom());
    
    // Комната
    this.roomElements.leaveRoomBtn.addEventListener('click', () => this.handleLeaveRoom());
    this.roomElements.startGameBtn.addEventListener('click', () => this.handleStartGame());
    this.roomElements.cancelStartBtn.addEventListener('click', () => this.handleCancelGame());
    
    // Игра
    this.gameElements.backToLobbyBtn.addEventListener('click', () => this.handleBackToLobby());
    this.gameElements.exitGameBtn.addEventListener('click', () => this.handleLeaveRoom());
    
    // Сетевые события
    this.bindNetworkEvents();
  }
  
  /**
   * Привязка сетевых событий
   */
  bindNetworkEvents() {
    // Авторизация
    this.network.on('registered', (data) => {
      this.lobbyElements.playerName.textContent = data.name;
      this.showScreen('lobby');
      this.network.getRoomList();
    });
    
    // Ошибки
    this.network.on('error', (data) => {
      this.showError(data.error, data.details);
    });
    
    // Комнаты
    this.network.on('roomCreated', (data) => {
      this.game.handleRoomCreated(data);
      this.updateRoomView(data.room);
      this.isHost = true;
      this.showScreen('room');
    });
    
    this.network.on('roomJoined', (data) => {
      this.game.handleRoomJoined(data);
      this.updateRoomView(data.room);
      this.isHost = false;
      this.showScreen('room');
    });
    
    this.network.on('roomLeft', () => {
      this.game.handleRoomLeft();
      this.isHost = false;
      this.showScreen('lobby');
      this.network.getRoomList();
    });
    
    this.network.on('roomList', (data) => {
      this.updateRoomsList(data.rooms);
    });
    
    this.network.on('roomInfo', (data) => {
      this.updateRoomView(data.room);
    });
    
    // Игроки
    this.network.on('playerJoined', (data) => {
      this.game.handlePlayerJoined(data);
      this.addPlayerToRoomList(data.player);
    });
    
    this.network.on('playerLeft', (data) => {
      this.game.handlePlayerLeft(data);
      this.removePlayerFromRoomList(data.playerId);
    });
    
    // Игра
    this.network.on('countdownStart', (data) => {
      this.game.handleCountdownStart(data);
      this.showCountdown(data.duration);
    });
    
    this.network.on('countdownUpdate', (data) => {
      this.game.handleCountdownUpdate(data);
      this.updateCountdown(data.remaining);
    });
    
    this.network.on('countdownCancelled', () => {
      this.game.handleCountdownCancelled();
      this.hideCountdown();
    });
    
    this.network.on('gameStart', (data) => {
      this.game.handleGameStart(data);
      this.showScreen('game');
      this.hideCountdown();
      this.game.start();
    });
    
    this.network.on('gameEnd', (data) => {
      this.game.handleGameEnd(data);
      this.showGameover(data);
    });
    
    this.network.on('gameState', (data) => {
      this.game.handleGameState(data);
      this.updateHUD();
    });
    
    // Хук
    this.network.on('hookActivated', (data) => {
      this.game.handleHookActivated(data);
    });
    
    this.network.on('hookHit', (data) => {
      this.game.handleHookHit(data);
    });
    
    this.network.on('hookMiss', (data) => {
      this.game.handleHookMiss(data);
    });
    
    this.network.on('playerKilled', (data) => {
      this.game.handlePlayerKilled(data);
    });
    
    // Смерть и возрождение
    this.network.on('death', (data) => {
      this.game.handleDeath(data);
      this.showDeathScreen(data.respawnIn);
    });
    
    this.network.on('respawn', (data) => {
      this.game.handleRespawn(data);
      this.hideDeathScreen();
    });
    
    // Сервер
    this.network.on('serverShutdown', (data) => {
      this.showStatus('Server shutting down: ' + data.reason, 'error');
      this.network.disconnect();
      this.showScreen('connect');
    });
    
    // Отключение
    this.network.on('disconnect', () => {
      this.showStatus('Disconnected from server', 'error');
      this.showScreen('connect');
    });
  }
  
  /**
   * Обработка подключения
   */
  async handleConnect() {
    const name = this.connectElements.nameInput.value.trim() || 'Player';
    const serverUrl = this.connectElements.serverInput.value.trim() || 'ws://localhost:3000';
    
    this.setConnectButtonLoading(true);
    this.showStatus('Connecting...', 'info');
    
    try {
      await this.network.connect(serverUrl, name);
      this.showStatus('Connected!', 'success');
    } catch (error) {
      this.showStatus('Connection failed: ' + error.message, 'error');
      this.setConnectButtonLoading(false);
    }
  }
  
  /**
   * Обработка отключения
   */
  handleDisconnect() {
    this.network.disconnect();
    this.game.reset();
    this.showScreen('connect');
  }
  
  /**
   * Обновление списка комнат
   */
  handleRefreshRooms() {
    this.network.getRoomList();
    this.lobbyElements.roomsList.innerHTML = '<div class="empty-message">Loading...</div>';
  }
  
  /**
   * Создание комнаты
   */
  handleCreateRoom() {
    const roomName = this.lobbyElements.roomNameInput.value.trim() || 'Room';
    const maxPlayers = parseInt(this.lobbyElements.maxPlayersSelect.value);
    
    this.network.createRoom(roomName, maxPlayers);
  }
  
  /**
   * Выход из комнаты
   */
  handleLeaveRoom() {
    this.network.leaveRoom();
    this.game.stop();
  }
  
  /**
   * Запуск игры
   */
  handleStartGame() {
    this.network.startGame();
  }
  
  /**
   * Отмена запуска
   */
  handleCancelGame() {
    this.network.cancelGame();
  }
  
  /**
   * Возврат в лобби после игры
   */
  handleBackToLobby() {
    this.gameElements.gameoverScreen.classList.remove('show');
    this.game.stop();
    this.network.leaveRoom();
  }
  
  /**
   * Обновление списка комнат
   */
  updateRoomsList(rooms) {
    const list = this.lobbyElements.roomsList;
    
    if (rooms.length === 0) {
      list.innerHTML = '<div class="empty-message">No rooms available. Create one!</div>';
      return;
    }
    
    list.innerHTML = '';
    
    for (const room of rooms) {
      const item = document.createElement('div');
      item.className = 'room-item';
      item.innerHTML = `
        <div class="room-item-info">
          <div class="room-item-name">${this.escapeHtml(room.name)}</div>
          <div class="room-item-details">Host: ${this.escapeHtml(room.players.find(p => p.id === room.hostId)?.name || 'Unknown')}</div>
        </div>
        <div class="room-item-players">
          <span class="badge">${room.playerCount}/${room.maxPlayers}</span>
          <span class="room-item-state ${room.state}">${room.state}</span>
        </div>
      `;
      
      item.addEventListener('click', () => {
        if (room.state === 'lobby') {
          this.network.joinRoom(room.id);
        }
      });
      
      list.appendChild(item);
    }
  }
  
  /**
   * Обновление вида комнаты
   */
  updateRoomView(room) {
    this.roomElements.nameDisplay.textContent = room.name;
    this.roomElements.playersCount.textContent = `${room.playerCount}/${room.maxPlayers}`;
    
    // Обновление списка игроков
    this.roomElements.playersList.innerHTML = '';
    for (const player of room.players) {
      this.addPlayerToRoomList(player);
    }
    
    // Показ элементов хоста
    if (room.hostId === this.game.state.localPlayerId) {
      this.isHost = true;
      this.roomElements.hostControls.classList.remove('hidden');
      this.roomElements.waitingMessage.classList.add('hidden');
    } else {
      this.isHost = false;
      this.roomElements.hostControls.classList.add('hidden');
      this.roomElements.waitingMessage.classList.remove('hidden');
    }
    
    // Блокировка кнопки старта если недостаточно игроков
    const startBtn = this.roomElements.startGameBtn;
    startBtn.disabled = room.playerCount < 2;
    
    if (room.playerCount < 2) {
      startBtn.textContent = `Need ${2 - room.playerCount} more player(s)`;
    } else {
      startBtn.textContent = '🎮 Start Game';
    }
  }
  
  /**
   * Добавление игрока в список комнаты
   */
  addPlayerToRoomList(player) {
    const list = this.roomElements.playersList;
    
    // Проверка на дубликат
    if (list.querySelector(`[data-player-id="${player.id}"]`)) return;
    
    const item = document.createElement('div');
    item.className = 'player-item';
    item.dataset.playerId = player.id;
    item.innerHTML = `
      <div class="player-color" style="background: ${player.color}"></div>
      <span class="player-name">${this.escapeHtml(player.name)}</span>
      ${player.id === this.game.state.roomHostId ? '<span class="player-role host">HOST</span>' : ''}
    `;
    
    list.appendChild(item);
  }
  
  /**
   * Удаление игрока из списка комнаты
   */
  removePlayerFromRoomList(playerId) {
    const item = this.roomElements.playersList.querySelector(`[data-player-id="${playerId}"]`);
    if (item) {
      item.remove();
    }
  }
  
  /**
   * Показ отсчёта
   */
  showCountdown(duration) {
    this.roomElements.countdownDisplay.classList.remove('hidden');
    this.roomElements.countdownNumber.textContent = Math.ceil(duration / 1000);
    this.roomElements.startGameBtn.classList.add('hidden');
    this.roomElements.cancelStartBtn.classList.remove('hidden');
  }
  
  /**
   * Обновление отсчёта
   */
  updateCountdown(remaining) {
    const seconds = Math.ceil(remaining / 1000);
    this.roomElements.countdownNumber.textContent = seconds;
  }
  
  /**
   * Скрытие отсчёта
   */
  hideCountdown() {
    this.roomElements.countdownDisplay.classList.add('hidden');
    this.roomElements.startGameBtn.classList.remove('hidden');
    this.roomElements.cancelStartBtn.classList.add('hidden');
  }
  
  /**
   * Обновление HUD
   */
  updateHUD() {
    // Здоровье
    const hpPercent = this.game.getHealthPercent();
    this.gameElements.hpBar.style.width = `${hpPercent}%`;
    this.gameElements.hpText.textContent = `${Math.ceil(this.game.state.localPlayer?.hp || 0)}/${this.game.state.localPlayer?.maxHp || 100}`;
    
    // Перезарядка хука
    const cooldownPercent = this.game.getHookCooldownPercent();
    this.gameElements.hookCooldownBar.style.width = `${cooldownPercent}%`;
    
    // Таймер
    this.gameElements.gameTimer.textContent = this.game.getRemainingTime();
    
    // Статистика
    this.gameElements.statKills.textContent = this.game.stats.kills;
    this.gameElements.statDeaths.textContent = this.game.stats.deaths;
    this.gameElements.statHooks.textContent = this.game.stats.hooksHit;
  }
  
  /**
   * Показ экрана смерти
   */
  showDeathScreen(respawnIn) {
    this.gameElements.deathScreen.classList.remove('hidden');
    this.updateRespawnTimer(respawnIn);
    
    // Таймер обратного отсчёта
    const interval = setInterval(() => {
      respawnIn -= 100;
      this.updateRespawnTimer(respawnIn);
      
      if (respawnIn <= 0) {
        clearInterval(interval);
      }
    }, 100);
  }
  
  /**
   * Обновление таймера возрождения
   */
  updateRespawnTimer(respawnIn) {
    const seconds = Math.ceil(respawnIn / 1000);
    this.gameElements.respawnTimer.textContent = seconds;
  }
  
  /**
   * Скрытие экрана смерти
   */
  hideDeathScreen() {
    this.gameElements.deathScreen.classList.add('hidden');
  }
  
  /**
   * Показ экрана конца игры
   */
  showGameover(data) {
    const winner = data.winner;
    const leaderboard = data.leaderboard || [];
    
    // Заголовок
    if (winner && winner.id === this.game.state.localPlayerId) {
      this.gameElements.gameoverTitle.textContent = '🏆 Victory!';
      this.gameElements.gameoverWinner.textContent = `You are the winner!`;
    } else if (winner) {
      this.gameElements.gameoverTitle.textContent = '💀 Defeat';
      this.gameElements.gameoverWinner.textContent = `Winner: ${winner.name}`;
    } else {
      this.gameElements.gameoverTitle.textContent = '🏁 Game Over';
      this.gameElements.gameoverWinner.textContent = '';
    }
    
    // Таблица лидеров
    const tbody = this.gameElements.leaderboardTable;
    tbody.innerHTML = '';
    
    leaderboard.forEach((player, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${this.escapeHtml(player.name)}</td>
        <td>${player.kills}</td>
        <td>${player.deaths}</td>
        <td>${player.hooksHit}</td>
        <td>${player.score}</td>
      `;
      tbody.appendChild(row);
    });
    
    this.gameElements.gameoverScreen.classList.add('show');
  }
  
  /**
   * Переключение экрана
   */
  showScreen(screenName) {
    for (const [name, element] of Object.entries(this.screens)) {
      if (name === screenName) {
        element.classList.add('active');
      } else {
        element.classList.remove('active');
      }
    }
  }
  
  /**
   * Показ статуса подключения
   */
  showStatus(message, type = 'info') {
    const status = this.connectElements.status;
    status.textContent = message;
    status.className = `status show ${type}`;
    
    setTimeout(() => {
      status.classList.remove('show');
    }, 5000);
  }
  
  /**
   * Показ ошибки
   */
  showError(error, details) {
    console.error('[UI] Error:', error, details);
    
    let message = error;
    if (details) {
      message += ': ' + details;
    }
    
    // Показ в зависимости от текущего экрана
    if (this.screens.connect.classList.contains('active')) {
      this.showStatus(message, 'error');
    } else {
      alert('Error: ' + message);
    }
  }
  
  /**
   * Установка состояния кнопки подключения
   */
  setConnectButtonLoading(loading) {
    const btn = this.connectElements.connectBtn;
    btn.disabled = loading;
    btn.textContent = loading ? 'Connecting...' : 'Connect to Server';
  }
  
  /**
   * Экранирование HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Экспорт
window.UI = UI;
