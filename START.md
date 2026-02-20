# 🚀 Render.com - Мгновенный старт

## ⚡ Решение "Upgrade Required"

**Проблема:** Render Free блокирует WebSocket

**Решение:** Использовать HTTP Long Polling версию

---

## 📋 3 шага до работы

### 1️⃣ Запушьте изменения в GitHub

```bash
git add .
git commit -m "Add HTTP mode for Render Free"
git push origin main
```

### 2️⃣ Создайте Web Service на Render

1. Перейдите на https://dashboard.render.com
2. **New +** → **Web Service**
3. Выберите ваш репозиторий

### 3️⃣ Настройте

```
Name: pudge-wars
Build Command: npm install
Start Command: node server/http-server.js
Plan: Free
```

**Environment Variables:**
```
NODE_VERSION=22.22.0
PORT=3000
```

**Create Web Service** ✅

---

## 🎮 Открыть игру

После деплоя (2-3 минуты):

```
https://pudge-wars-<random>.onrender.com/
```

---

## 🔍 Что изменилось

| Файл | Изменения |
|------|-----------|
| `server/http-server.js` | ✅ Создан - HTTP сервер |
| `client/index-http.html` | ✅ Создан - HTTP клиент |
| `client/js/NetworkHTTP.js` | ✅ Создан - HTTP polling |
| `render.yaml` | ✅ Обновлён - HTTP старт |
| `package.json` | ✅ Добавлен скрипт `render` |

---

## 🆘 Если не работает

### "Upgrade Required"

Проверьте Start Command:
```
✅ node server/http-server.js
❌ npm start
```

### 404 ошибка

Подождите окончания деплоя в dashboard Render.

### Таймаут

Сервер "засыпает" через 15 мин. Откройте заново.

---

## 📊 Сравнение режимов

| Режим | Цена | Протокол | Start Command |
|-------|------|----------|---------------|
| **Free** | $0 | HTTP | `node server/http-server.js` |
| **Starter** | $7/мес | WebSocket | `npm start` |

---

## ✅ Чеклист

- [ ] Запушили в GitHub
- [ ] Создали Web Service
- [ ] Start Command: `node server/http-server.js`
- [ ] PORT=3000
- [ ] Деплой успешен
- [ ] Открыли URL

---

**Готово!** 🎉
