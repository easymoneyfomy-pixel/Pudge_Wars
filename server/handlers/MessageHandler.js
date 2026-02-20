/**
 * Обработчик WebSocket сообщений
 * Маршрутизация и обработка входящих сообщений
 */
const { v4: uuidv4 } = require('uuid');

class MessageHandler {
  constructor(roomManager, playerManager) {
    this.roomManager = roomManager;
    this.playerManager = playerManager;
    
    // Маппинг обработчиков
    this.handlers = {
      // Авторизация
      'register': this.handleRegister.bind(this),
      
      // Комнаты
      'createRoom': this.handleCreateRoom.bind(this),
      'joinRoom': this.handleJoinRoom.bind(this),
      'leaveRoom': this.handleLeaveRoom.bind(this),
      'getRoomList': this.handleGetRoomList.bind(this),
      'getRoomInfo': this.handleGetRoomInfo.bind(this),
      
      // Игра
      'startCountdown': this.handleStartCountdown.bind(this),
      'cancelCountdown': this.handleCancelCountdown.bind(this),
      'input': this.handleInput.bind(this),
      
      // Чат
      'chatMessage': this.handleChatMessage.bind(this),
    };
  }
  
  /**
   * Обработка входящего сообщения
   */
  handleMessage(socket, data) {
    try {
      const message = JSON.parse(data);
      const handler = this.handlers[message.type];
      
      if (!handler) {
        console.warn(`[MessageHandler] Unknown message type: ${message.type}`);
        this.sendError(socket, 'unknown_message_type');
        return;
      }
      
      handler(socket, message);
    } catch (e) {
      console.error('[MessageHandler] Error parsing message:', e);
      this.sendError(socket, 'invalid_message');
    }
  }
  
  /**
   * Регистрация игрока
   */
  handleRegister(socket, message) {
    const playerId = uuidv4();
    const name = message.name || `Player_${playerId.substring(0, 4)}`;
    
    // Регистрация в менеджере игроков
    this.playerManager.registerPlayer(playerId, name, socket);
    
    // Отправка подтверждения
    this.send(socket, {
      type: 'registered',
      playerId: playerId,
      name: name,
    });
    
    console.log(`[Handler] Player registered: ${name} (${playerId})`);
  }
  
  /**
   * Создание комнаты
   */
  handleCreateRoom(socket, message) {
    const player = this.getPlayerBySocket(socket);
    if (!player) {
      this.sendError(socket, 'not_registered');
      return;
    }
    
    const name = message.roomName || `${player.name}'s Room`;
    const options = message.options || {};
    
    const room = this.roomManager.createRoom(player.id, name, options);
    
    // Автоматическое присоединение создателя
    const joinResult = room.addPlayer(player.id, player.name, socket);
    
    if (joinResult.success) {
      this.playerManager.setPlayerRoom(player.id, room.id);
      
      this.send(socket, {
        type: 'roomCreated',
        room: room.getInfo(),
        player: joinResult.player,
      });
      
      console.log(`[Handler] Room created: ${room.id} by ${player.name}`);
    } else {
      this.sendError(socket, joinResult.reason);
    }
  }
  
  /**
   * Присоединение к комнате
   */
  handleJoinRoom(socket, message) {
    const player = this.getPlayerBySocket(socket);
    if (!player) {
      this.sendError(socket, 'not_registered');
      return;
    }
    
    const roomId = message.roomId;
    if (!roomId) {
      this.sendError(socket, 'room_id_required');
      return;
    }
    
    const result = this.roomManager.joinRoom(roomId, player.id, player.name, socket);
    
    if (result.success) {
      this.playerManager.setPlayerRoom(player.id, roomId);
      
      this.send(socket, {
        type: 'roomJoined',
        room: this.roomManager.getRoom(roomId).getInfo(),
        player: result.player,
      });
      
      console.log(`[Handler] Player ${player.name} joined room ${roomId}`);
    } else {
      this.sendError(socket, result.reason);
    }
  }
  
  /**
   * Выход из комнаты
   */
  handleLeaveRoom(socket, message) {
    const player = this.getPlayerBySocket(socket);
    if (!player) {
      this.sendError(socket, 'not_registered');
      return;
    }
    
    this.roomManager.leaveRoom(player.id);
    
    this.send(socket, {
      type: 'roomLeft',
    });
    
    console.log(`[Handler] Player ${player.name} left room`);
  }
  
  /**
   * Получение списка комнат
   */
  handleGetRoomList(socket, message) {
    const rooms = this.roomManager.getRoomList();
    
    this.send(socket, {
      type: 'roomList',
      rooms: rooms,
    });
  }
  
  /**
   * Получение информации о комнате
   */
  handleGetRoomInfo(socket, message) {
    const room = this.roomManager.getRoom(message.roomId);
    
    if (room) {
      this.send(socket, {
        type: 'roomInfo',
        room: room.getInfo(),
      });
    } else {
      this.sendError(socket, 'room_not_found');
    }
  }
  
  /**
   * Запуск отсчёта до начала игры
   */
  handleStartCountdown(socket, message) {
    const player = this.getPlayerBySocket(socket);
    if (!player) {
      this.sendError(socket, 'not_registered');
      return;
    }
    
    const room = this.roomManager.getPlayerRoom(player.id);
    if (!room) {
      this.sendError(socket, 'not_in_room');
      return;
    }
    
    // Только хост может начать игру
    if (room.hostId !== player.id) {
      this.sendError(socket, 'not_host');
      return;
    }
    
    room.startCountdown();
  }
  
  /**
   * Отмена отсчёта
   */
  handleCancelCountdown(socket, message) {
    const player = this.getPlayerBySocket(socket);
    if (!player) {
      this.sendError(socket, 'not_registered');
      return;
    }
    
    const room = this.roomManager.getPlayerRoom(player.id);
    if (!room) {
      this.sendError(socket, 'not_in_room');
      return;
    }
    
    // Только хост может отменить
    if (room.hostId !== player.id) {
      this.sendError(socket, 'not_host');
      return;
    }
    
    room.cancelCountdown();
  }
  
  /**
   * Обработка ввода игрока
   */
  handleInput(socket, message) {
    const player = this.getPlayerBySocket(socket);
    if (!player) return;
    
    const room = this.roomManager.getPlayerRoom(player.id);
    if (!room) return;
    
    // Обработка ввода в комнате
    room.handleInput(player.id, message.input, message.sequence);
  }
  
  /**
   * Обработка сообщения чата
   */
  handleChatMessage(socket, message) {
    const player = this.getPlayerBySocket(socket);
    if (!player) return;
    
    const room = this.roomManager.getPlayerRoom(player.id);
    if (!room) {
      // Глобальный чат (в лобби)
      this.playerManager.broadcast({
        type: 'chatMessage',
        playerId: player.id,
        playerName: player.name,
        message: message.message,
        global: true,
      }, player.id);
    } else {
      // Чат комнаты
      room.broadcast({
        type: 'chatMessage',
        playerId: player.id,
        playerName: player.name,
        message: message.message,
        global: false,
      });
    }
  }
  
  /**
   * Отправка сообщения
   */
  send(socket, message) {
    if (socket.readyState === 1) {
      socket.send(JSON.stringify(message));
    }
  }
  
  /**
   * Отправка ошибки
   */
  sendError(socket, error, details = null) {
    this.send(socket, {
      type: 'error',
      error: error,
      details: details,
    });
  }
  
  /**
   * Получение игрока по сокету
   */
  getPlayerBySocket(socket) {
    for (const player of this.playerManager.players.values()) {
      if (player.socket === socket) {
        return player;
      }
    }
    return null;
  }
}

module.exports = MessageHandler;
