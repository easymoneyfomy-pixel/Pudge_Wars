/**
 * Менеджер комнат
 * Управление созданием, поиском и удалением комнат
 */
const { Room, RoomState } = require('./Room');
const config = require('../config');

class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId -> Room
    this.playerRooms = new Map(); // playerId -> roomId
    
    // Интервал очистки пустых комнат
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }
  
  /**
   * Создание новой комнаты
   */
  createRoom(hostId, name, options = {}) {
    const room = new Room(null, name, hostId, options);
    
    // Обработчики событий комнаты
    room.onStateChange = (state) => {
      console.log(`[Room ${room.id}] State changed to: ${state}`);
    };
    
    room.onPlayerJoin = (player) => {
      this.playerRooms.set(player.id, room.id);
    };
    
    room.onPlayerLeave = (player) => {
      this.playerRooms.delete(player.id);
    };
    
    room.onGameStart = () => {
      console.log(`[Room ${room.id}] Game started with ${room.players.size} players`);
    };
    
    room.onGameEnd = (winner) => {
      console.log(`[Room ${room.id}] Game ended. Winner: ${winner ? winner.name : 'None'}`);
    };
    
    this.rooms.set(room.id, room);
    
    console.log(`[RoomManager] Room created: ${room.id} by ${hostId}`);
    
    return room;
  }
  
  /**
   * Получение комнаты по ID
   */
  getRoom(roomId) {
    return this.rooms.get(roomId);
  }
  
  /**
   * Получение комнаты игрока
   */
  getPlayerRoom(playerId) {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return null;
    return this.rooms.get(roomId);
  }
  
  /**
   * Добавление игрока в комнату
   */
  joinRoom(roomId, playerId, name, socket) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, reason: 'room_not_found' };
    }
    
    const result = room.addPlayer(playerId, name, socket);
    
    if (result.success) {
      this.playerRooms.set(playerId, roomId);
    }
    
    return result;
  }
  
  /**
   * Выход игрока из комнаты
   */
  leaveRoom(playerId) {
    const room = this.getPlayerRoom(playerId);
    if (!room) return;
    
    room.removePlayer(playerId);
    this.playerRooms.delete(playerId);
    
    // Удаление пустой комнаты
    if (room.players.size === 0) {
      this.rooms.delete(room.id);
      console.log(`[RoomManager] Room ${room.id} removed (empty)`);
    }
  }
  
  /**
   * Получение списка доступных комнат
   */
  getRoomList() {
    const list = [];
    for (const room of this.rooms.values()) {
      if (room.state === RoomState.LOBBY || room.state === RoomState.COUNTDOWN) {
        list.push(room.getInfo());
      }
    }
    return list;
  }
  
  /**
   * Удаление комнаты
   */
  deleteRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    
    // Удаление всех игроков из маппинга
    for (const playerId of room.players.keys()) {
      this.playerRooms.delete(playerId);
    }
    
    this.rooms.delete(roomId);
    console.log(`[RoomManager] Room ${roomId} deleted`);
    
    return true;
  }
  
  /**
   * Очистка пустых и завершённых комнат
   */
  cleanup() {
    const now = Date.now();
    const roomsToRemove = [];
    
    for (const [roomId, room] of this.rooms.entries()) {
      // Удаление пустых комнат в лобби
      if (room.state === RoomState.LOBBY && room.players.size === 0) {
        roomsToRemove.push(roomId);
        continue;
      }
      
      // Удаление завершённых игр старше 5 минут
      if (room.state === RoomState.FINISHED) {
        if (now - room.gameEndTime > 300000) {
          roomsToRemove.push(roomId);
        }
      }
    }
    
    for (const roomId of roomsToRemove) {
      this.deleteRoom(roomId);
    }
    
    if (roomsToRemove.length > 0) {
      console.log(`[RoomManager] Cleaned up ${roomsToRemove.length} rooms`);
    }
  }
  
  /**
   * Обновление всех комнат
   */
  update() {
    for (const room of this.rooms.values()) {
      room.update();
    }
  }
  
  /**
   * Отключение всех игроков и очистка
   */
  shutdown() {
    clearInterval(this.cleanupInterval);
    
    for (const room of this.rooms.values()) {
      for (const socket of room.sockets.values()) {
        if (socket.readyState === 1) {
          socket.send(JSON.stringify({
            type: 'serverShutdown',
            reason: 'Server is shutting down',
          }));
          socket.close();
        }
      }
    }
    
    this.rooms.clear();
    this.playerRooms.clear();
    
    console.log('[RoomManager] Shutdown complete');
  }
}

module.exports = RoomManager;
