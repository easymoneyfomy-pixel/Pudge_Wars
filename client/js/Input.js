/**
 * Input Module
 * Обработка ввода игрока (клавиатура, мышь)
 */
class Input {
  constructor() {
    // Состояние клавиш
    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false,
    };
    
    // Состояние мыши
    this.mouse = {
      x: 0,
      y: 0,
      hookPressed: false,
    };
    
    // Последовательность ввода для анти-чита
    this.sequence = 0;
    
    // Флаг активации хука
    this.hookActivated = false;
    
    // Canvas для расчёта позиции мыши
    this.canvas = null;
    
    // Привязка контекста
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);
  }
  
  /**
   * Инициализация обработчиков событий
   */
  init(canvas) {
    this.canvas = canvas;
    
    // Клавиатура
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    
    // Мышь
    canvas.addEventListener('mousemove', this.handleMouseMove);
    canvas.addEventListener('mousedown', this.handleMouseDown);
    canvas.addEventListener('mouseup', this.handleMouseUp);
    canvas.addEventListener('contextmenu', this.handleContextMenu);
    
    console.log('[Input] Initialized');
  }
  
  /**
   * Обработка нажатия клавиши
   */
  handleKeyDown(event) {
    const key = event.code;
    
    switch (key) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.up = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.down = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = true;
        break;
    }
  }
  
  /**
   * Обработка отпускания клавиши
   */
  handleKeyUp(event) {
    const key = event.code;
    
    switch (key) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.up = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.down = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = false;
        break;
    }
  }
  
  /**
   * Обработка движения мыши
   */
  handleMouseMove(event) {
    if (!this.canvas) return;
    
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = event.clientX - rect.left;
    this.mouse.y = event.clientY - rect.top;
  }
  
  /**
   * Обработка нажатия кнопки мыши
   */
  handleMouseDown(event) {
    if (event.button === 0) { // Левая кнопка
      this.mouse.hookPressed = true;
      this.hookActivated = true;
    }
  }
  
  /**
   * Обработка отпускания кнопки мыши
   */
  handleMouseUp(event) {
    if (event.button === 0) {
      this.mouse.hookPressed = false;
    }
  }
  
  /**
   * Блокировка контекстного меню
   */
  handleContextMenu(event) {
    event.preventDefault();
    return false;
  }
  
  /**
   * Получение текущего состояния ввода
   */
  getInputState(playerX, playerY) {
    // Расчёт угла хука относительно игрока
    let hookAngle = 0;
    
    if (this.canvas && playerX !== undefined && playerY !== undefined) {
      const rect = this.canvas.getBoundingClientRect();
      const canvasCenterX = rect.width / 2;
      const canvasCenterY = rect.height / 2;
      
      // Позиция мыши относительно центра канваса
      const mouseX = this.mouse.x - canvasCenterX;
      const mouseY = this.mouse.y - canvasCenterY;
      
      // Угол в радианах
      hookAngle = Math.atan2(mouseY, mouseX);
    }
    
    return {
      up: this.keys.up,
      down: this.keys.down,
      left: this.keys.left,
      right: this.keys.right,
      hook: this.hookActivated,
      hookAngle: hookAngle,
    };
  }
  
  /**
   * Сброс активации хука (после отправки)
   */
  resetHook() {
    this.hookActivated = false;
  }
  
  /**
   * Увеличение последовательности ввода
   */
  nextSequence() {
    this.sequence++;
    return this.sequence;
  }
  
  /**
   * Очистка обработчиков событий
   */
  destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    
    if (this.canvas) {
      this.canvas.removeEventListener('mousemove', this.handleMouseMove);
      this.canvas.removeEventListener('mousedown', this.handleMouseDown);
      this.canvas.removeEventListener('mouseup', this.handleMouseUp);
      this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
    }
    
    console.log('[Input] Destroyed');
  }
}

// Экспорт
window.Input = Input;
