/**
 * Network Module
 * Управление WebSocket соединением и сетевыми сообщениями
 */
class Network {
  constructor() {
    this.socket = null;
    this.playerId = null;
    this.playerName = null;
    this.serverUrl = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    
    // Обработчики событий
    this.eventHandlers = new Map();
    
    // Буфер исходящих сообщений
    this.messageQueue = [];
  }
  
  /**
   * Подключение к серверу
   */
  connect(url, playerName) {
    return new Promise((resolve, reject) => {
      this.serverUrl = url;
      this.playerName = playerName;
      
      try {
        this.socket = new WebSocket(url);
        
        this.socket.onopen = () => {
          console.log('[Network] Connected to server');
          this.connected = true;
          this.reconnectAttempts = 0;
          
          // Отправка регистрации
          this.send('register', { name: playerName });
          
          // Отправка queued сообщений
          this.flushMessageQueue();
        };
        
        this.socket.onmessage = (event) => {
          this.handleMessage(event.data);
        };
        
        this.socket.onclose = (event) => {
          console.log('[Network] Disconnected from server', event.code, event.reason);
          this.connected = false;
          this.triggerEvent('disconnect', { code: event.code, reason: event.reason });
          
          // Попытка переподключения
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`[Network] Reconnecting... Attempt ${this.reconnectAttempts}`);
            setTimeout(() => this.connect(url, playerName), 2000);
          }
        };
        
        this.socket.onerror = (error) => {
          console.error('[Network] WebSocket error:', error);
          reject(error);
        };
        
        // Таймаут подключения
        setTimeout(() => {
          if (!this.connected) {
            reject(new Error('Connection timeout'));
          }
        }, 10000);
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Обработка входящего сообщения
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      console.log('[Network] Received:', message.type);
      
      // Обработка специальных сообщений
      switch (message.type) {
        case 'registered':
          this.playerId = message.playerId;
          console.log('[Network] Registered as:', message.name);
          break;
      }
      
      // Вызов обработчика события
      this.triggerEvent(message.type, message);
      
    } catch (error) {
      console.error('[Network] Error parsing message:', error);
    }
  }
  
  /**
   * Отправка сообщения
   */
  send(type, data = {}) {
    const message = { type, ...data };
    
    if (this.connected && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('[Network] Error sending message:', error);
        return false;
      }
    } else {
      // Добавление в очередь
      this.messageQueue.push(message);
      return false;
    }
  }
  
  /**
   * Отправка queued сообщений
   */
  flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.send(message.type, message);
    }
  }
  
  /**
   * Отправка ввода
   */
  sendInput(input, sequence) {
    this.send('input', {
      input: input,
      sequence: sequence,
    });
  }
  
  /**
   * Создание комнаты
   */
  createRoom(roomName, maxPlayers) {
    this.send('createRoom', {
      roomName: roomName,
      options: { maxPlayers: maxPlayers },
    });
  }
  
  /**
   * Присоединение к комнате
   */
  joinRoom(roomId) {
    this.send('joinRoom', { roomId: roomId });
  }
  
  /**
   * Выход из комнаты
   */
  leaveRoom() {
    this.send('leaveRoom');
  }
  
  /**
   * Запрос списка комнат
   */
  getRoomList() {
    this.send('getRoomList');
  }
  
  /**
   * Запуск игры
   */
  startGame() {
    this.send('startCountdown');
  }
  
  /**
   * Отмена запуска
   */
  cancelGame() {
    this.send('cancelCountdown');
  }
  
  /**
   * Отправка сообщения чата
   */
  sendChatMessage(message) {
    this.send('chatMessage', { message: message });
  }
  
  /**
   * Подписка на событие
   */
  on(eventType, handler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType).push(handler);
  }
  
  /**
   * Отписка от события
   */
  off(eventType, handler) {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }
  
  /**
   * Вызов обработчиков события
   */
  triggerEvent(eventType, data) {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          console.error(`[Network] Error in event handler for ${eventType}:`, error);
        }
      }
    }
  }
  
  /**
   * Отключение
   */
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.connected = false;
    this.playerId = null;
  }
  
  /**
   * Проверка подключения
   */
  isConnected() {
    return this.connected && this.socket && this.socket.readyState === WebSocket.OPEN;
  }
}

// Экспорт для использования в других модулях
window.Network = Network;
