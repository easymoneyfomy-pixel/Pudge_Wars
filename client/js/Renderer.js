/**
 * Renderer Module
 * Отрисовка игры на Canvas
 */
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Размеры арены
    this.arenaWidth = 1200;
    this.arenaHeight = 800;
    
    // Камера
    this.camera = {
      x: 0,
      y: 0,
      zoom: 1,
    };
    
    // Настройки отрисовки
    this.settings = {
      showGrid: true,
      showHookTrajectory: false,
      particleEffects: true,
    };
    
    // Частицы
    this.particles = [];
    
    // Адаптация размера канваса
    this.resize();
    window.addEventListener('resize', () => this.resize());
    
    console.log('[Renderer] Initialized');
  }
  
  /**
   * Адаптация размера канваса
   */
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.updateCamera();
  }
  
  /**
   * Обновление камеры
   */
  updateCamera() {
    // Центрирование арены на экране
    const scaleX = this.canvas.width / this.arenaWidth;
    const scaleY = this.canvas.height / this.arenaHeight;
    this.camera.zoom = Math.min(scaleX, scaleY) * 0.95;
    
    this.camera.x = (this.canvas.width - this.arenaWidth * this.camera.zoom) / 2;
    this.camera.y = (this.canvas.height - this.arenaHeight * this.camera.zoom) / 2;
  }
  
  /**
   * Преобразование координат мира в экранные
   */
  worldToScreen(worldX, worldY) {
    return {
      x: this.camera.x + worldX * this.camera.zoom,
      y: this.camera.y + worldY * this.camera.zoom,
    };
  }
  
  /**
   * Преобразование экранных координат в мировые
   */
  screenToWorld(screenX, screenY) {
    return {
      x: (screenX - this.camera.x) / this.camera.zoom,
      y: (screenY - this.camera.y) / this.camera.zoom,
    };
  }
  
  /**
   * Очистка экрана
   */
  clear() {
    this.ctx.fillStyle = '#0a0a15';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
  
  /**
   * Отрисовка арены
   */
  drawArena() {
    const topLeft = this.worldToScreen(0, 0);
    const bottomRight = this.worldToScreen(this.arenaWidth, this.arenaHeight);
    
    const arenaWidth = this.arenaWidth * this.camera.zoom;
    const arenaHeight = this.arenaHeight * this.camera.zoom;
    
    // Фон арены
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(topLeft.x, topLeft.y, arenaWidth, arenaHeight);
    
    // Граница арены
    this.ctx.strokeStyle = '#4ECDC4';
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(topLeft.x, topLeft.y, arenaWidth, arenaHeight);
    
    // Сетка
    if (this.settings.showGrid) {
      this.drawGrid(topLeft.x, topLeft.y, arenaWidth, arenaHeight);
    }
  }
  
  /**
   * Отрисовка сетки
   */
  drawGrid(x, y, width, height) {
    this.ctx.strokeStyle = 'rgba(78, 205, 196, 0.1)';
    this.ctx.lineWidth = 1;
    
    const gridSize = 100 * this.camera.zoom;
    
    // Вертикальные линии
    for (let i = 0; i <= this.arenaWidth; i += 100) {
      const screenX = x + i * this.camera.zoom;
      this.ctx.beginPath();
      this.ctx.moveTo(screenX, y);
      this.ctx.lineTo(screenX, y + height);
      this.ctx.stroke();
    }
    
    // Горизонтальные линии
    for (let i = 0; i <= this.arenaHeight; i += 100) {
      const screenY = y + i * this.camera.zoom;
      this.ctx.beginPath();
      this.ctx.moveTo(x, screenY);
      this.ctx.lineTo(x + width, screenY);
      this.ctx.stroke();
    }
  }
  
  /**
   * Отрисовка игроков
   */
  drawPlayers(players, localPlayerId) {
    for (const player of players) {
      this.drawPlayer(player, player.id === localPlayerId);
    }
  }
  
  /**
   * Отрисовка одного игрока
   */
  drawPlayer(player, isLocal) {
    const pos = this.worldToScreen(player.x, player.y);
    const radius = 20 * this.camera.zoom;
    
    // Тень
    this.ctx.beginPath();
    this.ctx.arc(pos.x + 2, pos.y + 2, radius, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.ctx.fill();
    
    // Тело игрока
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    
    // Градиент для игрока
    const gradient = this.ctx.createRadialGradient(
      pos.x - radius * 0.3, pos.y - radius * 0.3, 0,
      pos.x, pos.y, radius
    );
    gradient.addColorStop(0, player.color || '#4ECDC4');
    gradient.addColorStop(1, this.darkenColor(player.color || '#4ECDC4', 30));
    
    this.ctx.fillStyle = gradient;
    this.ctx.fill();
    
    // Обводка для локального игрока
    if (isLocal) {
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 3;
      this.ctx.stroke();
    }
    
    // Индикатор смерти
    if (player.isDead) {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      this.ctx.fill();
      
      // Крестик
      this.ctx.strokeStyle = '#FF6B6B';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(pos.x - radius * 0.7, pos.y - radius * 0.7);
      this.ctx.lineTo(pos.x + radius * 0.7, pos.y + radius * 0.7);
      this.ctx.moveTo(pos.x + radius * 0.7, pos.y - radius * 0.7);
      this.ctx.lineTo(pos.x - radius * 0.7, pos.y + radius * 0.7);
      this.ctx.stroke();
    }
    
    // Имя игрока
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = `${12 * this.camera.zoom}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.fillText(player.name || '', pos.x, pos.y - radius - 8);
    
    // Полоска здоровья
    if (!player.isDead && player.maxHp) {
      this.drawHealthBar(pos.x, pos.y - radius - 20, 40 * this.camera.zoom, 6 * this.camera.zoom, player.hp, player.maxHp);
    }
  }
  
  /**
   * Отрисовка полоски здоровья
   */
  drawHealthBar(x, y, width, height, current, max) {
    // Фон
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(x - width / 2, y, width, height);
    
    // Здоровье
    const percent = current / max;
    const healthWidth = width * percent;
    
    // Градиент здоровья
    const gradient = this.ctx.createLinearGradient(x - width / 2, 0, x + width / 2, 0);
    gradient.addColorStop(0, '#FF6B6B');
    gradient.addColorStop(0.5, '#FFD93D');
    gradient.addColorStop(1, '#4ECDC4');
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(x - width / 2, y, healthWidth, height);
    
    // Обводка
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x - width / 2, y, width, height);
  }
  
  /**
   * Отрисовка хуков
   */
  drawHooks(players) {
    for (const player of players) {
      if (player.hook && player.hook.active) {
        this.drawHook(player);
      }
    }
  }
  
  /**
   * Отрисовка хука
   */
  drawHook(player) {
    const hook = player.hook;
    const playerPos = this.worldToScreen(player.x, player.y);
    const hookPos = this.worldToScreen(hook.x, hook.y);
    
    // Линия хука
    this.ctx.beginPath();
    this.ctx.moveTo(playerPos.x, playerPos.y);
    this.ctx.lineTo(hookPos.x, hookPos.y);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    
    // Головка хука
    const hookRadius = 8 * this.camera.zoom;
    
    // Свечение
    const gradient = this.ctx.createRadialGradient(
      hookPos.x, hookPos.y, 0,
      hookPos.x, hookPos.y, hookRadius * 2
    );
    gradient.addColorStop(0, 'rgba(255, 217, 61, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 217, 61, 0)');
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(hookPos.x, hookPos.y, hookRadius * 2, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Тело хука
    this.ctx.beginPath();
    this.ctx.arc(hookPos.x, hookPos.y, hookRadius, 0, Math.PI * 2);
    this.ctx.fillStyle = '#FFD93D';
    this.ctx.fill();
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }
  
  /**
   * Отрисовка частиц
   */
  drawParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      const pos = this.worldToScreen(particle.x, particle.y);
      
      this.ctx.globalAlpha = particle.life;
      this.ctx.fillStyle = particle.color;
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, particle.size * this.camera.zoom, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
      
      // Обновление частицы
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.life -= particle.decay;
      
      // Удаление мёртвых частиц
      if (particle.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }
  
  /**
   * Создание частиц
   */
  spawnParticles(x, y, color, count = 10) {
    if (!this.settings.particleEffects) return;
    
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
      const speed = 50 + Math.random() * 100;
      
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.02 + Math.random() * 0.02,
        size: 3 + Math.random() * 3,
        color: color,
      });
    }
  }
  
  /**
   * Отрисовка прицела
   */
  drawCrosshair(mouseX, mouseY) {
    const size = 10 * this.camera.zoom;
    const thickness = 2;
    
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = thickness;
    
    // Горизонтальная линия
    this.ctx.beginPath();
    this.ctx.moveTo(mouseX - size, mouseY);
    this.ctx.lineTo(mouseX + size, mouseY);
    this.ctx.stroke();
    
    // Вертикальная линия
    this.ctx.beginPath();
    this.ctx.moveTo(mouseX, mouseY - size);
    this.ctx.lineTo(mouseX, mouseY + size);
    this.ctx.stroke();
    
    // Точка в центре
    this.ctx.fillStyle = '#FF6B6B';
    this.ctx.beginPath();
    this.ctx.arc(mouseX, mouseY, 2, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  /**
   * Отрисовка индикатора перезарядки
   */
  drawCooldownIndicator(playerX, playerY, cooldown, maxCooldown) {
    if (cooldown <= 0) return;
    
    const pos = this.worldToScreen(playerX, playerY);
    const radius = 25 * this.camera.zoom;
    
    // Фон
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Прогресс
    const percent = cooldown / maxCooldown;
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (Math.PI * 2 * (1 - percent));
    
    this.ctx.strokeStyle = '#FFD93D';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, radius - 5, startAngle, endAngle);
    this.ctx.stroke();
  }
  
  /**
   * Полный рендер кадра
   */
  render(gameState, localPlayerId, mouseX, mouseY) {
    this.clear();
    this.drawArena();
    
    if (gameState && gameState.players) {
      this.drawPlayers(gameState.players, localPlayerId);
      this.drawHooks(gameState.players);
    }
    
    this.drawParticles();
    
    if (mouseX !== undefined && mouseY !== undefined) {
      this.drawCrosshair(mouseX, mouseY);
    }
  }
  
  /**
   * Затемнение цвета
   */
  darkenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max((num >> 16) - amt, 0);
    const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
    const B = Math.max((num & 0x0000FF) - amt, 0);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }
  
  /**
   * Установка размеров арены
   */
  setArenaSize(width, height) {
    this.arenaWidth = width;
    this.arenaHeight = height;
    this.updateCamera();
  }
}

// Экспорт
window.Renderer = Renderer;
