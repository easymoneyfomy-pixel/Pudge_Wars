/**
 * Физический движок
 * Обработка коллизий и физических взаимодействий
 */
const config = require('../config');

class PhysicsEngine {
  constructor() {
    this.collisionPairs = [];
  }
  
  /**
   * Проверка коллизии между двумя кругами
   */
  checkCircleCollision(x1, y1, r1, x2, y2, r2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < (r1 + r2);
  }
  
  /**
   * Проверка коллизии хука с игроком
   */
  checkHookCollision(hook, player) {
    if (player.isDead) return false;
    
    const dx = hook.x - player.x;
    const dy = hook.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance < (config.HOOK.RADIUS + player.radius);
  }
  
  /**
   * Обработка всех коллизий в игре
   * @param {Player[]} players - Массив всех игроков
   * @returns {Object[]} - Список событий коллизий
   */
  update(players) {
    const collisions = [];
    
    // Проверка коллизий хуков с игроками
    for (const player of players) {
      if (!player.hook.active) continue;
      
      for (const target of players) {
        if (target.id === player.id) continue;
        if (target.isDead) continue;
        if (player.hook.targetId !== null && player.hook.targetId !== target.id) continue;
        
        if (this.checkHookCollision(player.hook, target)) {
          // Попадание хуком
          player.hook.targetId = target.id;
          player.hooksHit++;
          
          collisions.push({
            type: 'hookHit',
            shooter: player.id,
            target: target.id,
            x: player.hook.x,
            y: player.hook.y,
          });
        }
      }
    }
    
    // Проверка столкновений игроков друг с другом (опционально)
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const p1 = players[i];
        const p2 = players[j];
        
        if (p1.isDead || p2.isDead) continue;
        
        if (this.checkCircleCollision(p1.x, p1.y, p1.radius, p2.x, p2.y, p2.radius)) {
          // Разделение игроков (простая физика отталкивания)
          this.resolvePlayerCollision(p1, p2);
          
          collisions.push({
            type: 'playerCollision',
            player1: p1.id,
            player2: p2.id,
          });
        }
      }
    }
    
    return collisions;
  }
  
  /**
   * Разрешение столкновения между двумя игроками
   */
  resolvePlayerCollision(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) return;
    
    // Минимальное расстояние
    const minDist = p1.radius + p2.radius;
    const overlap = minDist - distance;
    
    // Нормализация вектора
    const nx = dx / distance;
    const ny = dy / distance;
    
    // Разделение игроков
    const separation = overlap / 2;
    p1.x -= nx * separation;
    p1.y -= ny * separation;
    p2.x += nx * separation;
    p2.y += ny * separation;
    
    // Ограничение ареной
    this.clampToArena(p1);
    this.clampToArena(p2);
  }
  
  /**
   * Ограничение позиции игрока ареной
   */
  clampToArena(player) {
    player.x = Math.max(player.radius, Math.min(config.GAME.ARENA_WIDTH - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(config.GAME.ARENA_HEIGHT - player.radius, player.y));
  }
  
  /**
   * Проверка валидности позиции (анти-чит)
   */
  validatePosition(player, oldX, oldY, deltaTime) {
    const dx = player.x - oldX;
    const dy = player.y - oldY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Максимально возможное расстояние за время deltaTime
    const maxDistance = player.speed * config.ANTI_CHEAT.MAX_SPEED_MULTIPLIER * deltaTime;
    
    if (distance > maxDistance) {
      return {
        valid: false,
        reason: 'speed_hack',
        expectedMax: maxDistance,
        actual: distance,
      };
    }
    
    // Проверка границ арены
    if (player.x < -config.ANTI_CHEAT.MAX_POSITION_DIFF ||
        player.x > config.GAME.ARENA_WIDTH + config.ANTI_CHEAT.MAX_POSITION_DIFF ||
        player.y < -config.ANTI_CHEAT.MAX_POSITION_DIFF ||
        player.y > config.GAME.ARENA_HEIGHT + config.ANTI_CHEAT.MAX_POSITION_DIFF) {
      return {
        valid: false,
        reason: 'out_of_bounds',
      };
    }
    
    return { valid: true };
  }
}

module.exports = PhysicsEngine;
