/**
 * Класс игровой комнаты
 * Управляет состоянием игры в конкретной комнате
 */
const { v4: uuidv4 } = require('uuid');
const Player = require('../models/Player');
const PhysicsEngine = require('../physics/PhysicsEngine');
const config = require('../config');

// Состояния комнаты
const RoomState = {
  LOBBY: 'lobby',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  FINISHED: 'finished',
};

class Room {
  constructor(id, name, hostId, options = {}) {
    this.id = id || uuidv4();
    this.name = name || 'Room';
    this.hostId = hostId;
    this.options = {
      maxPlayers: options.maxPlayers || config.ROOM.MAX_PLAYERS,
      minPlayers: options.minPlayers || config.ROOM.MIN_PLAYERS,
      gameDuration: options.gameDuration || 300000, // 5 минут
    };
    
    this.state = RoomState.LOBBY;
    this.players = new Map(); // id -> Player
    this.sockets = new Map(); // playerId -> socket
    
    // Игровые данные
    this.gameStartTime = 0;
    this.gameEndTime = 0;
    this.countdownStart = 0;
    this.countdownDuration = 5000;
    
    // Физика
    this.physics = new PhysicsEngine();
    
    // Последнее время обновления
    this.lastUpdate = Date.now();
    
    // События
    this.onStateChange = null;
    this.onPlayerJoin = null;
    this.onPlayerLeave = null;
    this.onGameStart = null;
    this.onGameEnd = null;
  }
  
  /**
   * Добавление игрока в комнату
   */
  addPlayer(playerId, name, socket) {
    if (this.players.size >= this.options.maxPlayers) {
      return { success: false, reason: 'room_full' };
    }
    
    if (this.state !== RoomState.LOBBY) {
      return { success: false, reason: 'game_in_progress' };
    }
    
    // Создание игрока
    const player = new Player(playerId, name, socket);
    
    // Случайная позиция на арене
    player.x = player.radius + Math.random() * (config.GAME.ARENA_WIDTH - 2 * player.radius);
    player.y = player.radius + Math.random() * (config.GAME.ARENA_HEIGHT - 2 * player.radius);
    
    this.players.set(playerId, player);
    this.sockets.set(playerId, socket);
    
    // Уведомление других игроков
    this.broadcast({
      type: 'playerJoined',
      player: player.getState(),
    }, playerId);
    
    if (this.onPlayerJoin) {
      this.onPlayerJoin(player);
    }
    
    return { success: true, player: player.getState() };
  }
  
  /**
   * Удаление игрока из комнаты
   */
  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (!player) return;
    
    this.players.delete(playerId);
    this.sockets.delete(playerId);
    
    // Уведомление других игроков
    this.broadcast({
      type: 'playerLeft',
      playerId: playerId,
    });
    
    if (this.onPlayerLeave) {
      this.onPlayerLeave(player);
    }
    
    // Проверка условия победы
    if (this.state === RoomState.PLAYING && this.players.size <= 1) {
      this.endGame(this.players.values().next().value);
    }
  }
  
  /**
   * Запуск отсчёта до начала игры
   */
  startCountdown() {
    if (this.state !== RoomState.LOBBY) return;
    if (this.players.size < this.options.minPlayers) {
      return { success: false, reason: 'not_enough_players' };
    }
    
    this.state = RoomState.COUNTDOWN;
    this.countdownStart = Date.now();
    
    this.broadcast({
      type: 'countdownStart',
      duration: this.countdownDuration,
    });
    
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }
  
  /**
   * Отмена отсчёта
   */
  cancelCountdown() {
    if (this.state !== RoomState.COUNTDOWN) return;
    
    this.state = RoomState.LOBBY;
    this.countdownStart = 0;
    
    this.broadcast({
      type: 'countdownCancelled',
    });
    
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }
  
  /**
   * Начало игры
   */
  startGame() {
    if (this.players.size < this.options.minPlayers) {
      return { success: false, reason: 'not_enough_players' };
    }
    
    this.state = RoomState.PLAYING;
    this.gameStartTime = Date.now();
    this.gameEndTime = this.gameStartTime + this.options.gameDuration;
    
    // Сброс всех игроков
    for (const player of this.players.values()) {
      player.respawn();
      player.kills = 0;
      player.deaths = 0;
      player.hooksHit = 0;
    }
    
    this.broadcast({
      type: 'gameStart',
      players: this.getPlayersState(),
      arena: {
        width: config.GAME.ARENA_WIDTH,
        height: config.GAME.ARENA_HEIGHT,
      },
    });
    
    if (this.onGameStart) {
      this.onGameStart();
    }
    
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
    
    return { success: true };
  }
  
  /**
   * Завершение игры
   */
  endGame(winner) {
    this.state = RoomState.FINISHED;
    
    this.broadcast({
      type: 'gameEnd',
      winner: winner ? winner.getState() : null,
      leaderboard: this.getLeaderboard(),
    });
    
    if (this.onGameEnd) {
      this.onGameEnd(winner);
    }
    
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }
  
  /**
   * Обработка ввода игрока
   */
  handleInput(playerId, inputData, sequence) {
    const player = this.players.get(playerId);
    if (!player || player.isDead) return;
    
    // Обработка ввода
    player.processInput(inputData, sequence);
    
    // Активация хука
    if (inputData.hook) {
      const activated = player.activateHook(inputData.hookAngle);
      if (activated) {
        this.broadcast({
          type: 'hookActivated',
          playerId: playerId,
          angle: inputData.hookAngle,
          x: player.hook.x,
          y: player.hook.y,
        });
      }
      player.resetInput();
    }
  }
  
  /**
   * Обновление игрового состояния
   */
  update() {
    const now = Date.now();
    const deltaTime = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;
    
    // Обновление отсчёта
    if (this.state === RoomState.COUNTDOWN) {
      const elapsed = now - this.countdownStart;
      
      // Отправка оставшегося времени
      const remaining = Math.max(0, this.countdownDuration - elapsed);
      if (remaining > 0 && Math.floor(remaining / 1000) !== Math.floor((remaining + deltaTime * 1000) / 1000)) {
        this.broadcast({
          type: 'countdownUpdate',
          remaining: remaining,
        });
      }
      
      // Конец отсчёта
      if (elapsed >= this.countdownDuration) {
        this.startGame();
      }
      
      return;
    }
    
    // Обновление игры
    if (this.state !== RoomState.PLAYING) return;
    
    // Проверка времени игры
    if (now >= this.gameEndTime) {
      const leaderboard = this.getLeaderboard();
      const winner = leaderboard.length > 0 ? this.players.get(leaderboard[0].id) : null;
      this.endGame(winner);
      return;
    }
    
    // Обновление всех игроков
    const oldPositions = new Map();
    for (const player of this.players.values()) {
      oldPositions.set(player.id, { x: player.x, y: player.y });
      player.updatePosition(deltaTime);
      player.updateCooldowns(deltaTime);
    }
    
    // Анти-чит: проверка позиций
    for (const player of this.players.values()) {
      const oldPos = oldPositions.get(player.id);
      const validation = this.physics.validatePosition(player, oldPos.x, oldPos.y, deltaTime);
      
      if (!validation.valid) {
        console.warn(`[Anti-Cheat] Player ${player.name}: ${validation.reason}`);
        // Коррекция позиции
        player.x = oldPos.x;
        player.y = oldPos.y;
      }
    }
    
    // Обработка хуков
    for (const player of this.players.values()) {
      const hookResult = player.updateHook(deltaTime);
      
      if (hookResult) {
        if (hookResult.type === 'miss') {
          this.broadcast({
            type: 'hookMiss',
            playerId: player.id,
            x: player.hook.x,
            y: player.hook.y,
          });
        }
      }
      
      // Притягивание цели
      if (player.hook.active && player.hook.targetId) {
        const target = this.players.get(player.hook.targetId);
        if (target) {
          player.pullTarget(target, deltaTime);
        }
      }
    }
    
    // Проверка коллизий
    const collisions = this.physics.update(Array.from(this.players.values()));
    
    // Обработка событий коллизий
    for (const collision of collisions) {
      if (collision.type === 'hookHit') {
        const shooter = this.players.get(collision.shooter);
        const target = this.players.get(collision.target);
        
        if (shooter && target) {
          this.broadcast({
            type: 'hookHit',
            shooter: shooter.id,
            target: target.id,
            x: collision.x,
            y: collision.y,
          });
        }
      }
    }
    
    // Проверка смерти от хука (если цель притянута)
    for (const player of this.players.values()) {
      if (player.hook.active && player.hook.targetId) {
        const target = this.players.get(player.hook.targetId);
        if (target && target.isDead) {
          player.kills++;
          player.resetHook();
          
          this.broadcast({
            type: 'playerKilled',
            killer: player.id,
            victim: target.id,
          });
        }
      }
    }
  }
  
  /**
   * Отправка состояния всем игрокам
   */
  broadcastState() {
    if (this.state !== RoomState.PLAYING) return;
    
    const state = {
      type: 'gameState',
      timestamp: Date.now(),
      players: [],
    };
    
    for (const player of this.players.values()) {
      state.players.push(player.getSyncState());
    }
    
    this.broadcast(state);
  }
  
  /**
   * Отправка сообщения всем игрокам
   */
  broadcast(message, excludeId = null) {
    for (const [playerId, socket] of this.sockets.entries()) {
      if (playerId === excludeId) continue;
      if (socket.readyState === 1) { // WebSocket.OPEN
        socket.send(JSON.stringify(message));
      }
    }
  }
  
  /**
   * Отправка сообщения конкретному игроку
   */
  sendTo(playerId, message) {
    const socket = this.sockets.get(playerId);
    if (socket && socket.readyState === 1) {
      socket.send(JSON.stringify(message));
    }
  }
  
  /**
   * Получение состояния всех игроков
   */
  getPlayersState() {
    const states = [];
    for (const player of this.players.values()) {
      states.push(player.getState());
    }
    return states;
  }
  
  /**
   * Получение таблицы лидеров
   */
  getLeaderboard() {
    const leaderboard = [];
    for (const player of this.players.values()) {
      leaderboard.push({
        id: player.id,
        name: player.name,
        kills: player.kills,
        deaths: player.deaths,
        hooksHit: player.hooksHit,
        score: player.kills * 10 - player.deaths * 5 + player.hooksHit * 2,
      });
    }
    
    // Сортировка по очкам
    leaderboard.sort((a, b) => b.score - a.score);
    
    return leaderboard;
  }
  
  /**
   * Получение информации о комнате
   */
  getInfo() {
    return {
      id: this.id,
      name: this.name,
      hostId: this.hostId,
      state: this.state,
      playerCount: this.players.size,
      maxPlayers: this.options.maxPlayers,
      players: this.getPlayersState(),
    };
  }
}

module.exports = { Room, RoomState };
