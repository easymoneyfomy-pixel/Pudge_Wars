# 🚀 Koyeb - Бесплатно, без карты, WebSocket работает!

## ✅ Почему Koyeb

| Параметр | Koyeb | Render Free |
|----------|-------|-------------|
| WebSocket | ✅ Работает | ❌ Блокируется |
| Карта | ❌ Не нужна | ❌ Нужна |
| RAM | 512 MB | 512 MB |
| CPU | 0.1 | 0.1 |
| Хранение | 2 GB | - |

---

## 🚀 Развёртывание за 5 минут

### Шаг 1: Sign Up

Перейдите на https://app.koyeb.com/auth/signup

**Sign up через GitHub** (быстрее всего)

### Шаг 2: Create App

1. **New App** → **Deploy from GitHub**
2. **Выберите репозиторий** `Pudge_Wars`
3. **Branch**: `main`

### Шаг 3: Настройте

```
Service name: pudge-wars
Branch: main
Build command: npm install
Start command: npm start
Port: 3000
Instance type: Free (Nano)
```

### Шаг 4: Environment Variables

```
NODE_VERSION=22.22.0
PORT=3000
HOST=0.0.0.0
```

### Шаг 5: Deploy

Нажмите **Deploy**

Через 2-3 минуты получите URL:
```
https://pudge-wars-<random>.koyeb.app
```

---

## 📁 koyeb.yaml (авто-конфигурация)

```yaml
name: pudge-wars
type: web
regions:
  - oregon
ports:
  - port: 3000
    protocol: http
routes:
  - path: /*
build:
  commands:
    - npm install
start: npm start
env:
  - key: NODE_VERSION
    value: 22.22.0
  - key: PORT
    value: 3000
```

---

## 🎮 Открыть игру

```
https://pudge-wars-<random>.koyeb.app/client/
```

---

## 💡 Преимущества Koyeb

- ✅ **WebSocket работает бесплатно**
- ✅ **Карта не требуется**
- ✅ **Нет cold start**
- ✅ **512 MB RAM**
- ✅ **2 GB storage**

---

## 🔧 Troubleshooting

### Build failed

Проверьте логи в Koyeb dashboard:
```
Deployments → View logs
```

### App не запускается

Убедитесь, что Start Command: `npm start`

### WebSocket не подключается

Проверьте, что используется `ws://` или `wss://`:
- В клиенте оставьте `Network.js` (не `NetworkHTTP.js`)

---

## 📊 Лимиты Free тарифа

- 1 сервис бесплатно
- 512 MB RAM
- 0.1 CPU
- 2 GB storage
- 100 GB bandwidth/мес

---

## 📞 Ссылки

- **Koyeb Dashboard**: https://app.koyeb.com
- **Документация**: https://docs.koyeb.com
- **Статус**: https://status.koyeb.com
