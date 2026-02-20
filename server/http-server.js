/**
 * HTTP сервер для Render (без WebSocket)
 * Использует long-polling и REST API
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { parse } = require('url');

const config = require('./config');
const RoomManager = require(path.join(__dirname, 'managers/RoomManager'));
const PlayerManager = require(path.join(__dirname, 'managers/PlayerManager'));
const MessageHandler = require(path.join(__dirname, 'handlers/MessageHandler'));

class HTTPServer {
  constructor() {
    this.port = process.env.PORT || config.PORT;
    this.host = process.env.HOST || config.HOST;
    
    this.roomManager = new RoomManager();
    this.playerManager = new PlayerManager();
    
    // Хранилище сообщений для long-polling
    this.messageStore = new Map(); // playerId -> [messages]
    this.messageId = 0;
    
    this.server = null;
    
    // Игровой цикл
    this.gameLoopInterval = null;
  }
  
  start() {
    this.server = http.createServer((req, res) => this.handleRequest(req, res));
    
    this.server.listen(this.port, this.host, () => {
      console.log('='.repeat(50));
      console.log('🎮 Pudge Wars Server (HTTP Mode)');
      console.log('='.repeat(50));
      console.log(`📡 Server running on http://${this.host}:${this.port}`);
      console.log(`🎯 Tick rate: ${config.GAME.TICK_RATE} Hz`);
      console.log('⚠️  WebSocket disabled - using HTTP long-polling');
      console.log('='.repeat(50));
    });
    
    // Запуск игрового цикла
    this.startGameLoop();
    
    // Обработка закрытия
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }
  
  handleRequest(req, res) {
    const parsedUrl = parse(req.url, true);
    const pathname = parsedUrl.pathname;
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    // API routes
    if (pathname === '/api/register' && req.method === 'POST') {
      this.handleRegister(req, res);
    } else if (pathname === '/api/message' && req.method === 'POST') {
      this.handleMessage(req, res);
    } else if (pathname === '/api/poll' && req.method === 'GET') {
      this.handlePoll(req, res);
    } else if (pathname === '/api/rooms' && req.method === 'GET') {
      this.handleGetRooms(req, res);
    } else if (pathname.startsWith('/client/')) {
      this.serveClient(pathname, res);
    } else if (pathname === '/' || pathname === '/client') {
      this.serveClient('/client/index.html', res);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  }
  
  // Регистрация игрока
  async handleRegister(req, res) {
    const body = await this.readBody(req);
    const { name } = body;
    
    const playerId = require('uuid').v4();
    this.playerManager.registerPlayer(playerId, name, null);
    
    // Создаём пустую очередь сообщений
    this.messageStore.set(playerId, []);
    
    this.sendJSON(res, {
      type: 'registered',
      playerId: playerId,
      name: name
    });
    
    console.log(`[HTTP] Player registered: ${name} (${playerId})`);
  }
  
  // Получение сообщения от клиента
  async handleMessage(req, res) {
    const body = await this.readBody(req);
    const { playerId, type, ...data } = body;
    
    if (!playerId || !this.playerManager.getPlayer(playerId)) {
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }
    
    // Обработка сообщения
    this.processMessage(playerId, type, data);
    
    res.writeHead(200);
    res.end('OK');
  }
  
  // Long-polling - получение сообщений
  async handlePoll(req, res) {
    const query = req.query;
    const playerId = query.playerId;
    const lastId = parseInt(query.lastId) || 0;
    
    if (!playerId || !this.messageStore.has(playerId)) {
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }
    
    const messages = this.messageStore.get(playerId);
    const newMessages = messages.filter(m => m.id > lastId);
    
    if (newMessages.length > 0) {
      // Есть новые сообщения - отправляем сразу
      this.sendJSON(res, newMessages);
    } else {
      // Нет сообщений - ждём (long-polling)
      const startTime = Date.now();
      const timeout = 25000; // 25 секунд
      
      const checkMessages = () => {
        const msgs = this.messageStore.get(playerId);
        const newMsgs = msgs.filter(m => m.id > lastId);
        
        if (newMsgs.length > 0) {
          this.sendJSON(res, newMsgs);
        } else if (Date.now() - startTime > timeout) {
          // Таймаут - отправляем пустой массив
          this.sendJSON(res, []);
        } else {
          // Продолжаем ждать
          setTimeout(checkMessages, 500);
        }
      };
      
      checkMessages();
    }
  }
  
  // Получение списка комнат
  handleGetRooms(req, res) {
    const rooms = this.roomManager.getRoomList();
    this.sendJSON(res, { rooms });
  }
  
  // Обработка сообщения от игрока
  processMessage(playerId, type, data) {
    const message = { type, ...data };
    
    // Специальная обработка для input
    if (type === 'input') {
      const room = this.roomManager.getPlayerRoom(playerId);
      if (room) {
        room.handleInput(playerId, data.input, data.sequence);
      }
      return;
    }
    
    // Остальные сообщения через MessageHandler
    const mockSocket = {
      send: (msg) => {
        const parsed = JSON.parse(msg);
        this.storeMessage(playerId, parsed);
      },
      readyState: 1
    };
    
    const player = this.playerManager.getPlayer(playerId);
    if (player) {
      player.socket = mockSocket;
    }
    
    const handler = new MessageHandler(this.roomManager, this.playerManager);
    
    // Маппинг типов
    const typeMap = {
      'createRoom': 'createRoom',
      'joinRoom': 'joinRoom',
      'leaveRoom': 'leaveRoom',
      'getRoomList': 'getRoomList',
      'startCountdown': 'startCountdown',
      'cancelCountdown': 'cancelCountdown',
      'chatMessage': 'chatMessage'
    };
    
    if (typeMap[type]) {
      handler[typeMap[type]](mockSocket, { type, ...data });
    }
  }
  
  // Сохранение сообщения для игрока
  storeMessage(playerId, message) {
    if (!this.messageStore.has(playerId)) {
      this.messageStore.set(playerId, []);
    }
    
    this.messageId++;
    message.id = this.messageId;
    message.timestamp = Date.now();
    
    const messages = this.messageStore.get(playerId);
    messages.push(message);
    
    // Храним только последние 100 сообщений
    if (messages.length > 100) {
      messages.shift();
    }
  }
  
  // Чтение JSON тела запроса
  readBody(req) {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({});
        }
      });
    });
  }
  
  // Отправка JSON ответа
  sendJSON(res, data) {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify(data));
  }
  
  // Статический клиент
  serveClient(pathname, res) {
    const filePath = path.join(__dirname, '../client', pathname);
    const ext = path.extname(filePath);
    
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    };
    
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('File not found');
        return;
      }
      
      res.setHeader('Content-Type', mimeTypes[ext] || 'text/plain');
      res.writeHead(200);
      res.end(content);
    });
  }
  
  // Игровой цикл
  startGameLoop() {
    const tickInterval = 1000 / config.GAME.TICK_RATE;
    
    this.gameLoopInterval = setInterval(() => {
      this.roomManager.update();
    }, tickInterval);
    
    console.log(`[HTTP] Game loop started (${config.GAME.TICK_RATE} ticks/sec)`);
  }
  
  // Корректное завершение
  shutdown() {
    console.log('\n[HTTP] Shutting down...');
    
    if (this.gameLoopInterval) clearInterval(this.gameLoopInterval);
    
    this.roomManager.shutdown();
    this.playerManager.shutdown();
    
    if (this.server) {
      this.server.close(() => {
        console.log('[HTTP] Server closed');
        process.exit(0);
      });
    }
    
    setTimeout(() => process.exit(0), 5000);
  }
}

// Запуск сервера
const server = new HTTPServer();
server.start();

module.exports = HTTPServer;
