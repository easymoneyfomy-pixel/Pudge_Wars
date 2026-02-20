/**
 * Pudge Wars - Pure HTTP Server для Render Free
 * НЕ использует WebSocket - только HTTP Long Polling
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { parse } = require('url');

// ═══════════════════════════════════════════════════════════
// КОНФИГУРАЦИЯ
// ═══════════════════════════════════════════════════════════
const CONFIG = {
  PORT: process.env.PORT || 3000,
  HOST: process.env.HOST || '0.0.0.0',
  ARENA_WIDTH: 1200,
  ARENA_HEIGHT: 800,
  PLAYER_RADIUS: 20,
  PLAYER_SPEED: 200,
  PLAYER_MAX_HP: 100,
  HOOK_SPEED: 600,
  HOOK_RANGE: 500,
  HOOK_COOLDOWN: 2000,
  HOOK_DAMAGE: 25,
  RESPAWN_TIME: 3000,
  TICK_RATE: 30,
};

// ═══════════════════════════════════════════════════════════
// СОСТОЯНИЕ СЕРВЕРА
// ═══════════════════════════════════════════════════════════
const state = {
  rooms: new Map(),
  players: new Map(),
  messages: new Map(),
  messageId: 0,
};

// ═══════════════════════════════════════════════════════════
// КЛАСС ИГРОКА
// ═══════════════════════════════════════════════════════════
class Player {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.x = Math.random() * (CONFIG.ARENA_WIDTH - 40) + 20;
    this.y = Math.random() * (CONFIG.ARENA_HEIGHT - 40) + 20;
    this.hp = CONFIG.PLAYER_MAX_HP;
    this.isDead = false;
    this.color = this.generateColor();
    this.hook = { active: false, x: 0, y: 0, cooldown: 0 };
    this.input = { up: false, down: false, left: false, right: false };
    this.kills = 0;
    this.deaths = 0;
  }

  generateColor() {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  update(deltaTime) {
    if (this.isDead) return;

    let vx = 0, vy = 0;
    if (this.input.up) vy -= CONFIG.PLAYER_SPEED;
    if (this.input.down) vy += CONFIG.PLAYER_SPEED;
    if (this.input.left) vx -= CONFIG.PLAYER_SPEED;
    if (this.input.right) vx += CONFIG.PLAYER_SPEED;

    if (vx !== 0 && vy !== 0) {
      const f = 1 / Math.sqrt(2);
      vx *= f;
      vy *= f;
    }

    this.x = Math.max(CONFIG.PLAYER_RADIUS, Math.min(CONFIG.ARENA_WIDTH - CONFIG.PLAYER_RADIUS, this.x + vx * deltaTime));
    this.y = Math.max(CONFIG.PLAYER_RADIUS, Math.min(CONFIG.ARENA_HEIGHT - CONFIG.PLAYER_RADIUS, this.y + vy * deltaTime));

    if (this.hook.cooldown > 0) {
      this.hook.cooldown -= deltaTime * 1000;
      if (this.hook.cooldown < 0) this.hook.cooldown = 0;
    }
  }

  activateHook(angle) {
    if (this.isDead || this.hook.cooldown > 0 || this.hook.active) return false;
    this.hook.active = true;
    this.hook.x = this.x;
    this.hook.y = this.y;
    this.hook.vx = Math.cos(angle) * CONFIG.HOOK_SPEED;
    this.hook.vy = Math.sin(angle) * CONFIG.HOOK_SPEED;
    this.hook.distanceTraveled = 0;
    return true;
  }

  updateHook(deltaTime) {
    if (!this.hook.active) return null;
    const dx = this.hook.vx * deltaTime;
    const dy = this.hook.vy * deltaTime;
    this.hook.x += dx;
    this.hook.y += dy;
    this.hook.distanceTraveled += Math.sqrt(dx * dx + dy * dy);

    if (this.hook.distanceTraveled >= CONFIG.HOOK_RANGE ||
        this.hook.x < 0 || this.hook.x > CONFIG.ARENA_WIDTH ||
        this.hook.y < 0 || this.hook.y > CONFIG.ARENA_HEIGHT) {
      this.hook.active = false;
      this.hook.cooldown = CONFIG.HOOK_COOLDOWN;
      return { type: 'miss' };
    }
    return null;
  }

  getState() {
    return {
      id: this.id,
      name: this.name,
      x: this.x,
      y: this.y,
      hp: this.hp,
      maxHp: CONFIG.PLAYER_MAX_HP,
      isDead: this.isDead,
      color: this.color,
      hook: { active: this.hook.active, x: this.hook.x, y: this.hook.y, cooldown: this.hook.cooldown },
      kills: this.kills,
      deaths: this.deaths,
    };
  }
}

// ═══════════════════════════════════════════════════════════
// КЛАСС КОМНАТЫ
// ═══════════════════════════════════════════════════════════
class Room {
  constructor(id, name, hostId) {
    this.id = id;
    this.name = name;
    this.hostId = hostId;
    this.players = new Map();
    this.state = 'lobby';
    this.countdown = 0;
    this.gameTime = 0;
    this.maxTime = 300000;
  }

  addPlayer(playerId, name) {
    if (this.state !== 'lobby' || this.players.size >= 10) return false;
    const player = new Player(playerId, name);
    this.players.set(playerId, player);
    return true;
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    if (this.players.size === 0) return true;
    if (this.hostId === playerId && this.players.size > 0) {
      this.hostId = this.players.keys().next().value;
    }
    return false;
  }

  startCountdown() {
    if (this.players.size < 2) return false;
    this.state = 'countdown';
    this.countdown = 5000;
    return true;
  }

  update(deltaTime) {
    if (this.state === 'countdown') {
      this.countdown -= deltaTime * 1000;
      if (this.countdown <= 0) {
        this.state = 'playing';
        this.gameTime = 0;
      }
    } else if (this.state === 'playing') {
      this.gameTime += deltaTime * 1000;
      
      for (const player of this.players.values()) {
        player.update(deltaTime);
        const hookResult = player.updateHook(deltaTime);
        
        // Проверка попаданий хука
        if (player.hook.active) {
          for (const target of this.players.values()) {
            if (target.id !== player.id && !target.isDead) {
              const dx = player.hook.x - target.x;
              const dy = player.hook.y - target.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < CONFIG.PLAYER_RADIUS + 8) {
                player.hook.targetId = target.id;
              }
            }
          }
        }
        
        // Притягивание
        if (player.hook.active && player.hook.targetId) {
          const target = this.players.get(player.hook.targetId);
          if (target) {
            const dx = player.x - target.x;
            const dy = player.y - target.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < CONFIG.PLAYER_RADIUS * 2) {
              target.hp -= CONFIG.HOOK_DAMAGE;
              if (target.hp <= 0) {
                target.hp = 0;
                target.isDead = true;
                target.deaths++;
                player.kills++;
                target.respawnTime = Date.now() + CONFIG.RESPAWN_TIME;
              }
              player.hook.active = false;
              player.hook.cooldown = CONFIG.HOOK_COOLDOWN;
            } else {
              const pullSpeed = 300;
              target.x += (dx / dist) * pullSpeed * deltaTime;
              target.y += (dy / dist) * pullSpeed * deltaTime;
            }
          }
        }
      }

      if (this.gameTime >= this.maxTime) {
        this.state = 'finished';
      }
    }

    // Возрождение
    for (const player of this.players.values()) {
      if (player.isDead && player.respawnTime && Date.now() >= player.respawnTime) {
        player.x = Math.random() * (CONFIG.ARENA_WIDTH - 40) + 20;
        player.y = Math.random() * (CONFIG.ARENA_HEIGHT - 40) + 20;
        player.hp = CONFIG.PLAYER_MAX_HP;
        player.isDead = false;
        player.respawnTime = null;
      }
    }
  }

  getState() {
    return {
      id: this.id,
      name: this.name,
      hostId: this.hostId,
      state: this.state,
      playerCount: this.players.size,
      maxPlayers: 10,
      players: Array.from(this.players.values()).map(p => p.getState()),
      countdown: this.countdown,
      gameTime: this.gameTime,
    };
  }

  getInfo() {
    return {
      id: this.id,
      name: this.name,
      hostId: this.hostId,
      state: this.state,
      playerCount: this.players.size,
      maxPlayers: 10,
      players: Array.from(this.players.values()).map(p => p.getState()),
    };
  }
}

// ═══════════════════════════════════════════════════════════
// HTTP СЕРВЕР
// ═══════════════════════════════════════════════════════════
class GameServer {
  constructor() {
    this.server = http.createServer((req, res) => this.handleRequest(req, res));
    this.lastTick = Date.now();
    
    // Игровой цикл
    setInterval(() => this.gameLoop(), 1000 / CONFIG.TICK_RATE);
  }

  start() {
    this.server.listen(CONFIG.PORT, CONFIG.HOST, () => {
      console.log('='.repeat(50));
      console.log('🎮 Pudge Wars - HTTP Server');
      console.log('='.repeat(50));
      console.log(`📡 Running on http://${CONFIG.HOST}:${CONFIG.PORT}`);
      console.log(`🎯 Tick rate: ${CONFIG.TICK_RATE} Hz`);
      console.log('⚠️  WebSocket disabled - HTTP Long Polling only');
      console.log('='.repeat(50));
    });
  }

  gameLoop() {
    const now = Date.now();
    const deltaTime = (now - this.lastTick) / 1000;
    this.lastTick = now;

    for (const room of state.rooms.values()) {
      room.update(deltaTime);
    }
  }

  handleRequest(req, res) {
    const parsed = parse(req.url, true);
    const pathname = parsed.pathname;

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // API Routes
    if (pathname === '/api/register' && req.method === 'POST') {
      this.handleRegister(req, res);
    } else if (pathname === '/api/message' && req.method === 'POST') {
      this.handleMessage(req, res);
    } else if (pathname === '/api/poll' && req.method === 'GET') {
      this.handlePoll(req, res);
    } else if (pathname === '/api/rooms' && req.method === 'GET') {
      this.handleGetRooms(req, res);
    } else if (pathname === '/api/create-room' && req.method === 'POST') {
      this.handleCreateRoom(req, res);
    } else if (pathname === '/api/join-room' && req.method === 'POST') {
      this.handleJoinRoom(req, res);
    } else if (pathname === '/api/leave-room' && req.method === 'POST') {
      this.handleLeaveRoom(req, res);
    } else if (pathname.startsWith('/client/')) {
      this.serveFile(pathname.substring(1), res);
    } else if (pathname === '/' || pathname === '/index.html' || pathname === '/client') {
      this.serveFile('client/index-http.html', res);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  }

  async readBody(req) {
    return new Promise(resolve => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { resolve({}); }
      });
    });
  }

  sendJSON(res, data) {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify(data));
  }

  storeMessage(playerId, message) {
    if (!state.messages.has(playerId)) {
      state.messages.set(playerId, []);
    }
    state.messageId++;
    message.id = state.messageId;
    message.timestamp = Date.now();
    const msgs = state.messages.get(playerId);
    msgs.push(message);
    if (msgs.length > 100) msgs.shift();
  }

  // ═══════════════════════════════════════════════════════════
  // API HANDLERS
  // ═══════════════════════════════════════════════════════════

  async handleRegister(req, res) {
    const { name } = await this.readBody(req);
    const playerId = uuidv4();
    const player = { id: playerId, name: name || 'Player', roomId: null };
    state.players.set(playerId, player);
    state.messages.set(playerId, []);
    
    this.sendJSON(res, { type: 'registered', playerId, name: player.name });
    console.log(`[Register] ${player.name} (${playerId})`);
  }

  async handleMessage(req, res) {
    const { playerId, type, ...data } = await this.readBody(req);
    const player = state.players.get(playerId);
    
    if (!player) {
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }

    // Обработка команд
    if (type === 'input' && player.roomId) {
      const room = state.rooms.get(player.roomId);
      if (room && room.state === 'playing') {
        const gamePlayer = room.players.get(playerId);
        if (gamePlayer) {
          gamePlayer.input = data.input || {};
          if (data.input.hook) {
            gamePlayer.activateHook(data.input.hookAngle);
            this.broadcastToRoom(player.roomId, {
              type: 'hookActivated',
              playerId,
              angle: data.input.hookAngle,
              x: gamePlayer.hook.x,
              y: gamePlayer.hook.y,
            }, playerId);
          }
        }
      }
    } else if (type === 'createRoom') {
      const roomId = uuidv4();
      const room = new Room(roomId, data.roomName || 'Room', playerId);
      room.addPlayer(playerId, player.name);
      state.rooms.set(roomId, room);
      player.roomId = roomId;
      
      this.sendJSON(res, { type: 'roomCreated', room: room.getInfo(), player: room.players.get(playerId).getState() });
      return;
    } else if (type === 'joinRoom' && data.roomId) {
      const room = state.rooms.get(data.roomId);
      if (room && room.addPlayer(playerId, player.name)) {
        player.roomId = data.roomId;
        this.broadcastToRoom(data.roomId, { type: 'playerJoined', player: room.players.get(playerId).getState() }, playerId);
        this.sendJSON(res, { type: 'roomJoined', room: room.getInfo(), player: room.players.get(playerId).getState() });
        return;
      }
    } else if (type === 'leaveRoom' && player.roomId) {
      const room = state.rooms.get(player.roomId);
      if (room) {
        room.removePlayer(playerId);
        this.broadcastToRoom(player.roomId, { type: 'playerLeft', playerId });
        if (room.players.size === 0) state.rooms.delete(player.roomId);
      }
      player.roomId = null;
    } else if (type === 'startCountdown' && player.roomId) {
      const room = state.rooms.get(player.roomId);
      if (room && room.hostId === playerId && room.startCountdown()) {
        this.broadcastToRoom(player.roomId, { type: 'countdownStart', duration: 5000 });
      }
    } else if (type === 'getRoomList') {
      const rooms = Array.from(state.rooms.values())
        .filter(r => r.state === 'lobby' || r.state === 'countdown')
        .map(r => r.getInfo());
      this.sendJSON(res, { type: 'roomList', rooms });
      return;
    }

    res.writeHead(200);
    res.end('OK');
  }

  async handlePoll(req, res) {
    const { playerId, lastId } = req.query;
    const player = state.players.get(playerId);
    
    if (!player) {
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }

    const messages = state.messages.get(playerId) || [];
    const newMessages = messages.filter(m => m.id > (parseInt(lastId) || 0));

    if (newMessages.length > 0) {
      this.sendJSON(res, newMessages);
    } else {
      // Long polling - ждём сообщения
      const start = Date.now();
      const timeout = 25000;
      
      const check = () => {
        const msgs = state.messages.get(playerId) || [];
        const newMsgs = msgs.filter(m => m.id > (parseInt(lastId) || 0));
        
        if (newMsgs.length > 0) {
          this.sendJSON(res, newMsgs);
        } else if (Date.now() - start > timeout) {
          this.sendJSON(res, []);
        } else {
          setTimeout(check, 500);
        }
      };
      check();
    }
  }

  handleGetRooms(req, res) {
    const rooms = Array.from(state.rooms.values())
      .filter(r => r.state === 'lobby' || r.state === 'countdown')
      .map(r => r.getInfo());
    this.sendJSON(res, { type: 'roomList', rooms });
  }

  async handleCreateRoom(req, res) {
    const { playerId, roomName } = await this.readBody(req);
    const player = state.players.get(playerId);
    if (!player) {
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }

    const roomId = uuidv4();
    const room = new Room(roomId, roomName || 'Room', playerId);
    room.addPlayer(playerId, player.name);
    state.rooms.set(roomId, room);
    player.roomId = roomId;

    this.sendJSON(res, { type: 'roomCreated', room: room.getInfo(), player: room.players.get(playerId).getState() });
  }

  async handleJoinRoom(req, res) {
    const { playerId, roomId } = await this.readBody(req);
    const player = state.players.get(playerId);
    if (!player) {
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }

    const room = state.rooms.get(roomId);
    if (room && room.addPlayer(playerId, player.name)) {
      player.roomId = roomId;
      this.broadcastToRoom(roomId, { type: 'playerJoined', player: room.players.get(playerId).getState() }, playerId);
      this.sendJSON(res, { type: 'roomJoined', room: room.getInfo(), player: room.players.get(playerId).getState() });
    } else {
      res.writeHead(404);
      res.end('Room not found or full');
    }
  }

  async handleLeaveRoom(req, res) {
    const { playerId } = await this.readBody(req);
    const player = state.players.get(playerId);
    if (!player) {
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }

    if (player.roomId) {
      const room = state.rooms.get(player.roomId);
      if (room) {
        room.removePlayer(playerId);
        this.broadcastToRoom(player.roomId, { type: 'playerLeft', playerId });
        if (room.players.size === 0) state.rooms.delete(player.roomId);
      }
      player.roomId = null;
    }
    res.writeHead(200);
    res.end('OK');
  }

  broadcastToRoom(roomId, message, excludeId = null) {
    const room = state.rooms.get(roomId);
    if (!room) return;
    
    for (const player of room.players.values()) {
      if (player.id !== excludeId) {
        this.storeMessage(player.id, message);
      }
    }
  }

  serveFile(filename, res) {
    const filePath = path.join(__dirname, '..', filename);
    const ext = path.extname(filePath);
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
    };

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('File not found: ' + filename);
        return;
      }
      res.setHeader('Content-Type', mimeTypes[ext] || 'text/plain');
      res.writeHead(200);
      res.end(content);
    });
  }
}

// ═══════════════════════════════════════════════════════════
// ЗАПУСК
// ═══════════════════════════════════════════════════════════
const server = new GameServer();
server.start();

module.exports = GameServer;
