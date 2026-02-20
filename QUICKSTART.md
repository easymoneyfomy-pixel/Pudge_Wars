# ⚡ Render Free - Быстрый старт

## Проблема
❌ "Upgrade Required" - Render блокирует WebSocket на Free тарифе

## Решение
✅ Использовать **Pure HTTP** версию

---

## 🚀 1-2-3

### 1. Запушить
```bash
git add . && git commit -m "HTTP" && git push
```

### 2. Создать на Render
https://dashboard.render.com → New + → Web Service

### 3. Настроить
```
Start Command: node server/http-pure.js
PORT: 3000
```

---

## ✅ Готово!

Откройте: `https://<app>.onrender.com/`

---

## 📁 Файлы

- `server/http-pure.js` - Pure HTTP сервер (без WebSocket)
- `client/index-http.html` - HTTP клиент
- `render.yaml` - авто-конфигурация

---

## 🆚 Сравнение

| Режим | Start Command | Цена |
|-------|---------------|------|
| **Free** | `node server/http-pure.js` | $0 |
| Starter | `npm start` | $7/мес |
