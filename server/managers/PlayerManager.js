/**
 * Менеджер игроков
 * Глобальное управление подключёнными игроками
 */
const path = require('path');
const Player = require(path.join(__dirname, '../models/Player'));

class PlayerManager {
  constructor() {
    this.players = new Map(); // playerId -> { id, name, socket, connectedAt }
  }
  
  /**
   * Регистрация нового игрока
   */
  registerPlayer(playerId, name, socket) {
    const playerData = {
      id: playerId,
      name: name,
      socket: socket,
      connectedAt: Date.now(),
      roomId: null,
    };
    
    this.players.set(playerId, playerData);
    
    console.log(`[PlayerManager] Player registered: ${name} (${playerId})`);
    
    return playerData;
  }
  
  /**
   * Получение данных игрока
   */
  getPlayer(playerId) {
    return this.players.get(playerId);
  }
  
  /**
   * Обновление комнаты игрока
   */
  setPlayerRoom(playerId, roomId) {
    const player = this.players.get(playerId);
    if (player) {
      player.roomId = roomId;
    }
  }
  
  /**
   * Удаление игрока
   */
  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      this.players.delete(playerId);
      console.log(`[PlayerManager] Player removed: ${player.name} (${playerId})`);
      return player;
    }
    return null;
  }
  
  /**
   * Отключение игрока
   */
  disconnectPlayer(playerId) {
    const player = this.players.get(playerId);
    if (player && player.socket) {
      try {
        if (player.socket.readyState === 1) {
          player.socket.close();
        }
      } catch (e) {
        console.error(`[PlayerManager] Error disconnecting player ${playerId}:`, e);
      }
    }
    
    return this.removePlayer(playerId);
  }
  
  /**
   * Отправка сообщения игроку
   */
  sendTo(playerId, message) {
    const player = this.players.get(playerId);
    if (player && player.socket && player.socket.readyState === 1) {
      try {
        player.socket.send(JSON.stringify(message));
        return true;
      } catch (e) {
        console.error(`[PlayerManager] Error sending to player ${playerId}:`, e);
      }
    }
    return false;
  }
  
  /**
   * Отправка сообщения всем игрокам
   */
  broadcast(message, excludeId = null) {
    for (const [playerId, player] of this.players.entries()) {
      if (playerId === excludeId) continue;
      if (player.socket && player.socket.readyState === 1) {
        try {
          player.socket.send(JSON.stringify(message));
        } catch (e) {
          console.error(`[PlayerManager] Error broadcasting to ${playerId}:`, e);
        }
      }
    }
  }
  
  /**
   * Получение количества онлайн игроков
   */
  getOnlineCount() {
    return this.players.size;
  }
  
  /**
   * Получение списка всех игроков
   */
  getAllPlayers() {
    const list = [];
    for (const player of this.players.values()) {
      list.push({
        id: player.id,
        name: player.name,
        connectedAt: player.connectedAt,
        roomId: player.roomId,
      });
    }
    return list;
  }
  
  /**
   * Очистка неактивных игроков
   */
  cleanup(maxIdleTime = 300000) {
    const now = Date.now();
    const toRemove = [];
    
    for (const [playerId, player] of this.players.entries()) {
      // Проверка на длительное отсутствие в комнате
      if (player.roomId === null && now - player.connectedAt > maxIdleTime) {
        toRemove.push(playerId);
      }
    }
    
    for (const playerId of toRemove) {
      this.disconnectPlayer(playerId);
    }
    
    if (toRemove.length > 0) {
      console.log(`[PlayerManager] Cleaned up ${toRemove.length} inactive players`);
    }
  }
  
  /**
   * Отключение всех игроков
   */
  shutdown() {
    for (const player of this.players.values()) {
      if (player.socket && player.socket.readyState === 1) {
        try {
          player.socket.send(JSON.stringify({
            type: 'serverShutdown',
            reason: 'Server is shutting down',
          }));
          player.socket.close();
        } catch (e) {
          console.error(`[PlayerManager] Error during shutdown:`, e);
        }
      }
    }
    
    this.players.clear();
    console.log('[PlayerManager] Shutdown complete');
  }
}

module.exports = PlayerManager;
