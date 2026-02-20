/**
 * Альтернативный Network модуль с HTTP Long Polling
 * Для платформ без поддержки WebSocket
 */
class NetworkHTTP {
  constructor() {
    this.playerId = null;
    this.playerName = null;
    this.serverUrl = null;
    this.connected = false;
    this.pollingInterval = null;
    this.messageQueue = [];
    this.eventHandlers = new Map();
    this.lastMessageId = 0;
  }

  async connect(url, playerName) {
    this.serverUrl = url.replace('ws://', 'http://').replace('wss://', 'https://');
    this.playerName = playerName;

    try {
      // Регистрация
      const response = await fetch(`${this.serverUrl}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName })
      });

      const data = await response.json();
      this.playerId = data.playerId;
      this.connected = true;

      // Запуск long-polling
      this.startPolling();

      return data;
    } catch (error) {
      throw error;
    }
  }

  startPolling() {
    const poll = async () => {
      if (!this.connected) return;

      try {
        const response = await fetch(
          `${this.serverUrl}/api/poll?playerId=${this.playerId}&lastId=${this.lastMessageId}`,
          { method: 'GET' }
        );

        const messages = await response.json();

        for (const msg of messages) {
          this.lastMessageId = msg.id;
          this.handleMessage(msg);
        }
      } catch (error) {
        console.error('[NetworkHTTP] Poll error:', error);
      }

      // Следующий запрос через 100ms
      this.pollingInterval = setTimeout(poll, 100);
    };

    poll();
  }

  async send(type, data = {}) {
    const message = { type, ...data };

    try {
      await fetch(`${this.serverUrl}/api/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: this.playerId,
          ...message
        })
      });
    } catch (error) {
      this.messageQueue.push(message);
    }
  }

  sendInput(input, sequence) {
    this.send('input', { input, sequence });
  }

  handleMessage(data) {
    this.triggerEvent(data.type, data);

    if (data.type === 'registered') {
      this.playerId = data.playerId;
    }
  }

  on(eventType, handler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType).push(handler);
  }

  triggerEvent(eventType, data) {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          console.error('[NetworkHTTP] Event handler error:', error);
        }
      }
    }
  }

  disconnect() {
    this.connected = false;
    if (this.pollingInterval) {
      clearTimeout(this.pollingInterval);
    }
  }
}

window.NetworkHTTP = NetworkHTTP;
