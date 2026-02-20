/**
 * Класс игрока
 * Управляет состоянием и действиями игрока
 */
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const config = require(path.join(__dirname, '../config'));

class Player {
  constructor(id, name, socket) {
    this.id = id || uuidv4();
    this.name = name || 'Player';
    this.socket = socket;
    
    // Позиция и движение
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.radius = config.GAME.PLAYER_RADIUS;
    this.speed = config.GAME.PLAYER_SPEED;
    
    // Здоровье
    this.hp = config.GAME.PLAYER_MAX_HP;
    this.maxHp = config.GAME.PLAYER_MAX_HP;
    this.isDead = false;
    this.respawnTime = 0;
    
    // Хук
    this.hook = {
      cooldown: 0,
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      targetId: null,
    };
    
    // Ввод
    this.input = {
      up: false,
      down: false,
      left: false,
      right: false,
      hook: false,
      hookAngle: 0,
    };
    
    // Статистика
    this.kills = 0;
    this.deaths = 0;
    this.hooksHit = 0;
    
    // Цвет для идентификации
    this.color = this.generateColor();
    
    // Время последнего обновления
    this.lastUpdate = Date.now();
    this.lastInputSequence = 0;
  }
  
  /**
   * Генерация случайного цвета для игрока
   */
  generateColor() {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
      '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
      '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  /**
   * Обновление позиции на основе ввода
   */
  updatePosition(deltaTime) {
    if (this.isDead) return;
    
    // Сброс скорости
    this.vx = 0;
    this.vy = 0;
    
    // Обработка ввода
    if (this.input.up) this.vy -= this.speed;
    if (this.input.down) this.vy += this.speed;
    if (this.input.left) this.vx -= this.speed;
    if (this.input.right) this.vx += this.speed;
    
    // Нормализация диагонального движения
    if (this.vx !== 0 && this.vy !== 0) {
      const factor = 1 / Math.sqrt(2);
      this.vx *= factor;
      this.vy *= factor;
    }
    
    // Применение движения
    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;
    
    // Ограничение ареной
    this.x = Math.max(this.radius, Math.min(config.GAME.ARENA_WIDTH - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(config.GAME.ARENA_HEIGHT - this.radius, this.y));
  }
  
  /**
   * Обновление перезарядки хука
   */
  updateCooldowns(deltaTime) {
    if (this.hook.cooldown > 0) {
      this.hook.cooldown -= deltaTime * 1000;
      if (this.hook.cooldown < 0) this.hook.cooldown = 0;
    }
    
    // Проверка возрождения
    if (this.isDead && Date.now() >= this.respawnTime) {
      this.respawn();
    }
  }
  
  /**
   * Активация хука
   */
  activateHook(angle) {
    if (this.isDead || this.hook.cooldown > 0 || this.hook.active) {
      return false;
    }
    
    this.hook.active = true;
    this.hook.x = this.x;
    this.hook.y = this.y;
    this.hook.vx = Math.cos(angle) * config.HOOK.SPEED;
    this.hook.vy = Math.sin(angle) * config.HOOK.SPEED;
    this.hook.targetId = null;
    this.hook.angle = angle;
    this.hook.distanceTraveled = 0;
    
    return true;
  }
  
  /**
   * Обновление состояния хука
   */
  updateHook(deltaTime) {
    if (!this.hook.active) return null;
    
    // Движение хука
    const dx = this.hook.vx * deltaTime;
    const dy = this.hook.vy * deltaTime;
    this.hook.x += dx;
    this.hook.y += dy;
    this.hook.distanceTraveled += Math.sqrt(dx * dx + dy * dy);
    
    // Проверка выхода за пределы дальности
    if (this.hook.distanceTraveled >= config.HOOK.RANGE) {
      this.resetHook();
      return { type: 'miss' };
    }
    
    // Проверка выхода за границы арены
    if (this.hook.x < 0 || this.hook.x > config.GAME.ARENA_WIDTH ||
        this.hook.y < 0 || this.hook.y > config.GAME.ARENA_HEIGHT) {
      this.resetHook();
      return { type: 'miss' };
    }
    
    return null;
  }
  
  /**
   * Сброс хука
   */
  resetHook() {
    this.hook.active = false;
    this.hook.targetId = null;
    this.hook.cooldown = config.HOOK.COOLDOWN;
  }
  
  /**
   * Притягивание цели к игроку
   */
  pullTarget(target, deltaTime) {
    if (!target) return;
    
    const dx = this.x - target.x;
    const dy = this.y - target.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < this.radius + target.radius) {
      // Цель достигнута
      target.takeDamage(config.HOOK.DAMAGE, this.id);
      this.resetHook();
      return;
    }
    
    // Притягивание
    const pullSpeed = config.HOOK.PULL_SPEED;
    const moveX = (dx / distance) * pullSpeed * deltaTime;
    const moveY = (dy / distance) * pullSpeed * deltaTime;
    
    target.x += moveX;
    target.y += moveY;
    
    // Ограничение ареной
    target.x = Math.max(target.radius, Math.min(config.GAME.ARENA_WIDTH - target.radius, target.x));
    target.y = Math.max(target.radius, Math.min(config.GAME.ARENA_HEIGHT - target.radius, target.y));
  }
  
  /**
   * Получение урона
   */
  takeDamage(amount, attackerId) {
    if (this.isDead) return;
    
    this.hp -= amount;
    
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(attackerId);
    }
  }
  
  /**
   * Смерть игрока
   */
  die(killerId) {
    this.isDead = true;
    this.deaths++;
    this.respawnTime = Date.now() + config.GAME.RESPAWN_TIME;
    
    // Уведомление сокета
    if (this.socket && this.socket.readyState === 1) {
      this.socket.send(JSON.stringify({
        type: 'death',
        killerId: killerId,
        respawnIn: config.GAME.RESPAWN_TIME,
      }));
    }
  }
  
  /**
   * Возрождение игрока
   */
  respawn() {
    // Случуазная позиция на арене
    this.x = this.radius + Math.random() * (config.GAME.ARENA_WIDTH - 2 * this.radius);
    this.y = this.radius + Math.random() * (config.GAME.ARENA_HEIGHT - 2 * this.radius);
    this.hp = this.maxHp;
    this.isDead = false;
    this.respawnTime = 0;
    this.hook.cooldown = 0;
    
    // Уведомление сокета
    if (this.socket && this.socket.readyState === 1) {
      this.socket.send(JSON.stringify({
        type: 'respawn',
        x: this.x,
        y: this.y,
        hp: this.hp,
      }));
    }
  }
  
  /**
   * Обработка входящего ввода
   */
  processInput(inputData, sequence) {
    // Анти-чит: проверка последовательности
    if (sequence <= this.lastInputSequence) {
      return false;
    }
    this.lastInputSequence = sequence;
    
    // Обновление ввода
    this.input.up = inputData.up || false;
    this.input.down = inputData.down || false;
    this.input.left = inputData.left || false;
    this.input.right = inputData.right || false;
    
    if (inputData.hook) {
      this.input.hook = true;
      this.input.hookAngle = inputData.hookAngle || 0;
    }
    
    return true;
  }
  
  /**
   * Сброс состояния хука для ввода
   */
  resetInput() {
    this.input.hook = false;
  }
  
  /**
   * Получение полного состояния игрока
   */
  getState() {
    return {
      id: this.id,
      name: this.name,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      hp: this.hp,
      maxHp: this.maxHp,
      isDead: this.isDead,
      color: this.color,
      hook: {
        active: this.hook.active,
        x: this.hook.x,
        y: this.hook.y,
        cooldown: this.hook.cooldown,
      },
      kills: this.kills,
      deaths: this.deaths,
    };
  }
  
  /**
   * Получение состояния для отправки клиенту
   */
  getSyncState() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      hp: this.hp,
      isDead: this.isDead,
      hook: {
        active: this.hook.active,
        x: this.hook.x,
        y: this.hook.y,
        cooldown: this.hook.cooldown,
      },
    };
  }
}

module.exports = Player;
