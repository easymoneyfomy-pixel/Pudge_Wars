/**
 * Game Module
 * Основной игровой цикл и логика
 */
class Game {
  constructor(network, renderer, input) {
    this.network = network;
    this.renderer = renderer;
    this.input = input;
    
    // Состояние игры
    this.state = {
      status: 'none', // none, lobby, room, countdown, playing, gameover
      roomId: null,
      roomName: null,
      players: [],
      localPlayerId: null,
      localPlayer: null,
    };
    
    // Игровые данные
    this.arena = {
      width: 1200,
      height: 800,
    };
    
    this.gameTimer = 0;
    this.gameDuration = 300000; // 5 минут
    
    this.countdown = 0;
    this.countdownActive = false;
    
    // Статистика
    this.stats = {
      kills: 0,
      deaths: 0,
      hooksHit: 0,
    };
    
    // Таймеры
    this.lastInputTime = 0;
    this.inputInterval = 33; // 30 раз в секунду
    
    this.lastRenderTime = 0;
    
    // Флаги
    this.isRunning = false;
    this.isDead = false;
    this.respawnTimer = 0;
    
    // Лидерборд
    this.leaderboard = [];
    
    console.log('[Game] Initialized');
  }
  
  /**
   * Запуск игры
   */
  start() {
    this.isRunning = true;
    this.lastRenderTime = performance.now();
    this.gameLoop();
    console.log('[Game] Started');
  }
  
  /**
   * Остановка игры
   */
  stop() {
    this.isRunning = false;
    console.log('[Game] Stopped');
  }
  
  /**
   * Игровой цикл
   */
  gameLoop(currentTime = performance.now()) {
    if (!this.isRunning) return;
    
    const deltaTime = (currentTime - this.lastRenderTime) / 1000;
    this.lastRenderTime = currentTime;
    
    // Обновление
    this.update(deltaTime, currentTime);
    
    // Рендер
    this.render();
    
    // Следующий кадр
    requestAnimationFrame((time) => this.gameLoop(time));
  }
  
  /**
   * Обновление игрового состояния
   */
  update(deltaTime, currentTime) {
    // Обновление таймера игры
    if (this.state.status === 'playing' && !this.isDead) {
      this.gameTimer += deltaTime * 1000;
    }
    
    // Обновление отсчёта
    if (this.countdownActive) {
      this.countdown -= deltaTime * 1000;
      if (this.countdown <= 0) {
        this.countdownActive = false;
      }
    }
    
    // Отправка ввода
    if (currentTime - this.lastInputTime >= this.inputInterval) {
      this.sendInput();
      this.lastInputTime = currentTime;
    }
    
    // Обновление таймера возрождения
    if (this.isDead) {
      this.respawnTimer -= deltaTime * 1000;
      if (this.respawnTimer <= 0) {
        this.isDead = false;
      }
    }
  }
  
  /**
   * Отправка ввода на сервер
   */
  sendInput() {
    if (this.state.status !== 'playing' || this.isDead) return;
    
    const inputState = this.input.getInputState(
      this.state.localPlayer?.x,
      this.state.localPlayer?.y
    );
    
    const sequence = this.input.nextSequence();
    this.network.sendInput(inputState, sequence);
    
    // Сброс хука после отправки
    if (inputState.hook) {
      this.input.resetHook();
    }
  }
  
  /**
   * Рендер кадра
   */
  render() {
    // Получение позиции мыши
    const mousePos = {
      x: this.input.mouse.x,
      y: this.input.mouse.y,
    };
    
    // Рендер игры
    this.renderer.render(
      { players: this.state.players },
      this.state.localPlayerId,
      mousePos.x,
      mousePos.y
    );
  }
  
  /**
   * Обработка сообщения о присоединении к комнате
   */
  handleRoomJoined(data) {
    this.state.status = 'room';
    this.state.roomId = data.room.id;
    this.state.roomName = data.room.name;
    this.state.localPlayerId = data.player.id;
    this.state.localPlayer = data.player;
    
    console.log('[Game] Joined room:', data.room.name);
  }
  
  /**
   * Обработка сообщения о создании комнаты
   */
  handleRoomCreated(data) {
    this.state.status = 'room';
    this.state.roomId = data.room.id;
    this.state.roomName = data.room.name;
    this.state.localPlayerId = data.player.id;
    this.state.localPlayer = data.player;
    
    console.log('[Game] Created room:', data.room.name);
  }
  
  /**
   * Обработка выхода из комнаты
   */
  handleRoomLeft() {
    this.state.status = 'lobby';
    this.state.roomId = null;
    this.state.roomName = null;
    this.state.players = [];
    this.state.localPlayer = null;
    
    console.log('[Game] Left room');
  }
  
  /**
   * Обработка списка комнат
   */
  handleRoomList(data) {
    console.log('[Game] Received room list:', data.rooms.length, 'rooms');
  }
  
  /**
   * Обработка присоединения игрока
   */
  handlePlayerJoined(data) {
    this.state.players.push(data.player);
    console.log('[Game] Player joined:', data.player.name);
  }
  
  /**
   * Обработка выхода игрока
   */
  handlePlayerLeft(data) {
    this.state.players = this.state.players.filter(p => p.id !== data.playerId);
    console.log('[Game] Player left:', data.playerId);
  }
  
  /**
   * Обработка начала отсчёта
   */
  handleCountdownStart(data) {
    this.state.status = 'countdown';
    this.countdown = data.duration;
    this.countdownActive = true;
    
    console.log('[Game] Countdown started');
  }
  
  /**
   * Обработка обновления отсчёта
   */
  handleCountdownUpdate(data) {
    this.countdown = data.remaining;
  }
  
  /**
   * Обработка отмены отсчёта
   */
  handleCountdownCancelled() {
    this.state.status = 'room';
    this.countdownActive = false;
    
    console.log('[Game] Countdown cancelled');
  }
  
  /**
   * Обработка начала игры
   */
  handleGameStart(data) {
    this.state.status = 'playing';
    this.state.players = data.players;
    this.arena.width = data.arena.width;
    this.arena.height = data.arena.height;
    
    this.gameTimer = 0;
    this.stats = { kills: 0, deaths: 0, hooksHit: 0 };
    
    // Обновление локального игрока
    this.state.localPlayer = this.state.players.find(p => p.id === this.state.localPlayerId);
    
    // Установка размеров арены в рендерере
    this.renderer.setArenaSize(this.arena.width, this.arena.height);
    
    console.log('[Game] Game started!');
  }
  
  /**
   * Обработка завершения игры
   */
  handleGameEnd(data) {
    this.state.status = 'gameover';
    this.leaderboard = data.leaderboard || [];
    
    console.log('[Game] Game ended');
  }
  
  /**
   * Обработка состояния игры
   */
  handleGameState(data) {
    if (this.state.status !== 'playing') return;
    
    // Обновление игроков
    this.state.players = data.players;
    
    // Обновление локального игрока
    this.state.localPlayer = this.state.players.find(p => p.id === this.state.localPlayerId);
    
    // Проверка смерти
    if (this.state.localPlayer && this.state.localPlayer.isDead && !this.isDead) {
      this.isDead = true;
      this.respawnTimer = 3000; // 3 секунды
    }
  }
  
  /**
   * Обработка активации хука
   */
  handleHookActivated(data) {
    const player = this.state.players.find(p => p.id === data.playerId);
    if (player) {
      player.hook = {
        active: true,
        x: data.x,
        y: data.y,
      };
    }
    
    // Частицы
    this.renderer.spawnParticles(data.x, data.y, '#FFD93D', 5);
  }
  
  /**
   * Обработка попадания хуком
   */
  handleHookHit(data) {
    // Частицы при попадании
    this.renderer.spawnParticles(data.x, data.y, '#FF6B6B', 15);
    
    if (data.target === this.state.localPlayerId) {
      console.log('[Game] Hooked!');
    }
  }
  
  /**
   * Обработка промаха хуком
   */
  handleHookMiss(data) {
    const player = this.state.players.find(p => p.id === data.playerId);
    if (player && player.hook) {
      player.hook.active = false;
    }
  }
  
  /**
   * Обработка убийства игрока
   */
  handlePlayerKilled(data) {
    if (data.killer === this.state.localPlayerId) {
      this.stats.kills++;
    }
    if (data.victim === this.state.localPlayerId) {
      this.stats.deaths++;
    }
  }
  
  /**
   * Обработка смерти
   */
  handleDeath(data) {
    this.isDead = true;
    this.respawnTimer = data.respawnIn;
    this.stats.deaths++;
  }
  
  /**
   * Обработка возрождения
   */
  handleRespawn(data) {
    this.isDead = false;
    
    if (this.state.localPlayer) {
      this.state.localPlayer.x = data.x;
      this.state.localPlayer.y = data.y;
      this.state.localPlayer.hp = data.hp;
      this.state.localPlayer.isDead = false;
    }
  }
  
  /**
   * Получение оставшегося времени игры
   */
  getRemainingTime() {
    const remaining = Math.max(0, this.gameDuration - this.gameTimer);
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  /**
   * Получение прогресса перезарядки хука
   */
  getHookCooldownPercent() {
    if (!this.state.localPlayer || !this.state.localPlayer.hook) return 0;
    
    const cooldown = this.state.localPlayer.hook.cooldown || 0;
    const maxCooldown = 2000;
    return (cooldown / maxCooldown) * 100;
  }
  
  /**
   * Получение прогресса здоровья
   */
  getHealthPercent() {
    if (!this.state.localPlayer) return 100;
    
    return (this.state.localPlayer.hp / this.state.localPlayer.maxHp) * 100;
  }
  
  /**
   * Сброс состояния
   */
  reset() {
    this.state = {
      status: 'none',
      roomId: null,
      roomName: null,
      players: [],
      localPlayerId: null,
      localPlayer: null,
    };
    
    this.gameTimer = 0;
    this.countdown = 0;
    this.countdownActive = false;
    this.isDead = false;
    this.respawnTimer = 0;
    this.leaderboard = [];
  }
}

// Экспорт
window.Game = Game;
