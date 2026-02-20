/**
 * Pudge Wars - Главный файл клиента
 * Инициализация и запуск приложения
 */

// Глобальные экземпляры
let network = null;
let renderer = null;
let input = null;
let game = null;
let ui = null;

/**
 * Инициализация приложения
 */
function init() {
  console.log('🎮 Pudge Wars Client');
  console.log('====================');
  
  // Создание экземпляров
  network = new Network();
  
  const canvas = document.getElementById('game-canvas');
  renderer = new Renderer(canvas);
  input = new Input();
  input.init(canvas);
  
  game = new Game(network, renderer, input);
  ui = new UI(network, game);
  
  // Сохранение в глобальной области для отладки
  window.gameInstance = {
    network,
    renderer,
    input,
    game,
    ui,
  };
  
  console.log('✅ Client initialized');
  console.log('📖 Controls:');
  console.log('   WASD - Move');
  console.log('   Mouse - Aim hook');
  console.log('   Left Click - Shoot hook');
}

/**
 * Обработка загрузки страницы
 */
document.addEventListener('DOMContentLoaded', () => {
  init();
});

/**
 * Обработка закрытия страницы
 */
window.addEventListener('beforeunload', () => {
  if (network) {
    network.disconnect();
  }
  if (game) {
    game.stop();
  }
  if (input) {
    input.destroy();
  }
});

/**
 * Обработка изменения размера окна
 */
window.addEventListener('resize', () => {
  if (renderer) {
    renderer.resize();
  }
});
