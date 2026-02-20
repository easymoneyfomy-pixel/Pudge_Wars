# 🚀 Northflank - Бесплатно, 2 сервиса, WebSocket работает

## ✅ Почему Northflank

| Параметр | Northflank | Render Free |
|----------|------------|-------------|
| WebSocket | ✅ Работает | ❌ Блокируется |
| Сервисов | 2 бесплатно | 1 |
| Карта | ❌ Не нужна | ❌ Нужна |
| RAM | 512 MB | 512 MB |

---

## 🚀 Развёртывание

### 1. Sign Up

https://northflank.com → Sign up через GitHub

### 2. Create Project

**New Project** → Name: `pudge-wars`

### 3. Create Service

**New Service** → **Import from Git**

```
Repository: <your-github>/Pudge_Wars
Branch: main
Runtime: Node.js
Port: 3000
```

### 4. Build Settings

```
Build command: npm install
Start command: npm start
```

### 5. Environment Variables

```
NODE_VERSION=22.22.0
PORT=3000
```

### 6. Deploy

**Deploy** → Ждите 2-3 минуты

URL вида:
```
https://pudge-wars-<id>.northflank.app
```

---

## 🎮 Открыть игру

```
https://pudge-wars-<id>.northflank.app/client/
```

---

## 💡 Преимущества

- ✅ **2 сервиса бесплатно**
- ✅ **WebSocket работает**
- ✅ **Карта не нужна**
- ✅ **Нет cold start**

---

## 📊 Лимиты

- 2 сервиса (M1 plan)
- 512 MB RAM каждый
- 1 GB storage
- 100 GB bandwidth/мес
