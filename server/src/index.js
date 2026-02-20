/**
 * Pudge Wars - Игровой сервер
 * Главный файл запуска сервера
 */

const WebSocket = require('ws');
const config = require('./config');
const RoomManager = require('./managers/RoomManager');
const PlayerManager = require('./managers/PlayerManager');
const MessageHandler = require('./handlers/MessageHandler');

class GameServer {
  constructor() {
    this.wss = null;
    this.roomManager = new RoomManager();
    this.playerManager = new PlayerManager();
    this.messageHandler = new MessageHandler(this.roomManager, this.playerManager);
    
    // Игровой цикл
    this.gameLoopInterval = null;
    this.syncInterval = null;
    
    // Статистика
    this.stats = {
      connections: 0,
      messagesReceived: 0,
      messagesSent: 0,
      startTime: Date.now(),
    };
  }
  
  /**
   * Запуск сервера
   */
  start() {
    // Создание WebSocket сервера
    this.wss = new WebSocket.Server({
      port: config.PORT,
      host: config.HOST,
    });
    
    // Обработчики событий WebSocket
    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
    this.wss.on('error', (error) => this.handleError(error));
    
    // Запуск игрового цикла
    this.startGameLoop();
    
    // Запуск цикла синхронизации
    this.startSyncLoop();
    
    // Обработка закрытия сервера
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
    
    console.log('='.repeat(50));
    console.log('🎮 Pudge Wars Server');
    console.log('='.repeat(50));
    console.log(`📡 Server running on ws://${config.HOST}:${config.PORT}`);
    console.log(`🎯 Tick rate: ${config.GAME.TICK_RATE} Hz`);
    console.log(`👥 Max players per room: ${config.ROOM.MAX_PLAYERS}`);
    console.log('='.repeat(50));
  }
  
  /**
   * Обработка нового подключения
   */
  handleConnection(ws, req) {
    this.stats.connections++;
    console.log(`[Server] New connection. Total: ${this.stats.connections}`);
    
    // Обработка входящих сообщений
    ws.on('message', (data) => {
      this.stats.messagesReceived++;
      this.messageHandler.handleMessage(ws, data);
    });
    
    // Обработка отключения
    ws.on('close', () => this.handleDisconnect(ws));
    
    // Обработка ошибок
    ws.on('error', (error) => {
      console.error('[Server] WebSocket error:', error);
    });
    
    // Ping для поддержания соединения
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
  }
  
  /**
   * Обработка отключения игрока
   */
  handleDisconnect(ws) {
    const player = this.getPlayerBySocket(ws);
    
    if (player) {
      console.log(`[Server] Player disconnected: ${player.name} (${player.id})`);
      
      // Выход из комнаты
      this.roomManager.leaveRoom(player.id);
      
      // Удаление из менеджера игроков
      this.playerManager.removePlayer(player.id);
    }
  }
  
  /**
   * Обработка ошибок сервера
   */
  handleError(error) {
    console.error('[Server] Fatal error:', error);
  }
  
  /**
   * Запуск игрового цикла
   */
  startGameLoop() {
    const tickInterval = 1000 / config.GAME.TICK_RATE;
    
    this.gameLoopInterval = setInterval(() => {
      // Обновление всех комнат
      this.roomManager.update();
    }, tickInterval);
    
    console.log(`[Server] Game loop started (${config.GAME.TICK_RATE} ticks/sec)`);
  }
  
  /**
   * Запуск цикла синхронизации состояния
   */
  startSyncLoop() {
    this.syncInterval = setInterval(() => {
      // Отправка состояния всем комнатам
      for (const room of this.roomManager.rooms.values()) {
        if (room.state === 'playing') {
          room.broadcastState();
        }
      }
    }, config.SYNC.STATE_BROADCAST_INTERVAL);
    
    console.log(`[Server] Sync loop started (${1000 / config.SYNC.STATE_BROADCAST_INTERVAL} syncs/sec)`);
  }
  
  /**
   * Интервал проверки живых соединений (ping)
   */
  startPingInterval() {
    this.pingInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }
  
  /**
   * Получение игрока по сокету
   */
  getPlayerBySocket(ws) {
    for (const player of this.playerManager.players.values()) {
      if (player.socket === ws) {
        return player;
      }
    }
    return null;
  }
  
  /**
   * Корректное завершение работы сервера
   */
  shutdown() {
    console.log('\n[Server] Shutting down...');
    
    // Остановка таймеров
    if (this.gameLoopInterval) clearInterval(this.gameLoopInterval);
    if (this.syncInterval) clearInterval(this.syncInterval);
    if (this.pingInterval) clearInterval(this.pingInterval);
    
    // Закрытие менеджеров
    this.roomManager.shutdown();
    this.playerManager.shutdown();
    
    // Закрытие WebSocket сервера
    if (this.wss) {
      this.wss.close(() => {
        console.log('[Server] WebSocket server closed');
        process.exit(0);
      });
    }
    
    // Принудительное завершение через 5 секунд
    setTimeout(() => {
      console.log('[Server] Force shutdown');
      process.exit(0);
    }, 5000);
  }
  
  /**
   * Получение статистики сервера
   */
  getStats() {
    const uptime = Date.now() - this.stats.startTime;
    return {
      ...this.stats,
      uptime: uptime,
      uptimeFormatted: this.formatUptime(uptime),
      activeRooms: this.roomManager.rooms.size,
      onlinePlayers: this.playerManager.getOnlineCount(),
    };
  }
  
  /**
   * Форматирование времени работы
   */
  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
}

// Запуск сервера
const server = new GameServer();
server.start();

// Экспорт для тестов
module.exports = GameServer;
