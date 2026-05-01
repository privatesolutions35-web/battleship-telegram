# 🚀 Как запустить бесплатно

## Вариант 1: Railway (рекомендуется)

### Шаг 1: Подготовка

1. Зарегистрируйся на https://railway.app
2. Нажми "New Project" → "Empty Project"

### Шаг 2: Деплой

```bash
# Установи Railway CLI
npm install -g railway

# Или используй GitHub интеграцию:
# 1. Загрузи папку server на GitHub
# 2. На Railway: New → Github → выбери репозиторий
# 3. Настрой:
#    - Root directory: server
#    - Build command: (пусто)
#    - Start command: node server.js
```

### Шаг 3: Запуск

1. После деплоя получи URL типа: `https://battleship-username.railway.app`
2. Скопируй его в `bot.py` как `SERVER_URL`

---

## Вариант 2: Render (бесплатно)

### Шаг 1: Регистрация

1. https://render.com → "New Web Service"
2. Подключи GitHub репозиторий

### Шаг 2: Настройки

```
Name: battleship
Branch: main
Root: server
Build Command: npm install
Start Command: node server.js
```

### Шаг 3: Переменные

```
SERVER_URL = https://your-app.onrender.com
```

---

## Вариант 3: Fly.io

```bash
# Установи flyctl
winget install flyctl

# Деплой
cd server
fly launch
fly deploy
```

---

## Вариант 4: Локально (для тестов)

### Требования
- Node.js 18+
- Python 3.9+ (для бота)

### Запуск сервера

```bash
cd server
npm install
node server.js
# Сервер запустится на localhost:3000
```

### Запуск бота

```bash
# Получи токен от @BotFather
# Вставь в bot.py: BOT_TOKEN = 'твой_токен'

python bot.py
```

---

## Полная инструкция по запуску

### Шаг 1: Создай бота

1. Открой @BotFather в Telegram
2. `/newbot`
3. Имя: "Морской Бой"
4. Username: `BattleshipGameBot`
5. **Скопируй токен!**

### Шаг 2: Запусти сервер

```bash
# Вариант: Railway
# 1. Создай аккаунт Railway
# 2. New → Empty Project  
# 3. Создай Web Service
# 4. Подключи этот репозиторий
# 5. Root directory: server
# 6. Start command: node server.js
```

### Шаг 3: Настрой бота

```python
# В bot.py измени:
SERVER_URL = 'https://твой-проект.railway.app'
BOT_TOKEN = 'твой_токен_от_BotFather'
```

### Шаг 4: Запусти бота

```bash
# Локально
pip install telebot
python bot.py

# Или на PythonAnywhere (бесплатно):
# 1. Регистрируйся на pythonanywhere.com
# 2. Files → Upload bot.py
# 3. Запустить в консоли: python bot.py
```

### Шаг 5: Настрой вебхук (опционально)

Для прода:

```python
# В bot.py добавь:
bot.remove_webhook()
bot.set_webhook(url=f"{SERVER_URL}/webhook/{BOT_TOKEN}")
```

---

## Структура файлов

```
battleship/
├── index.html          # Клиент (одиночная игра)
├── server/
│   ├── package.json  # Зависимости
│   ├── server.js     # API сервер
│   └── bot.py        # Telegram бот
├── MULTIPLAYER.md    # Описание
└── DEPLOY.md        # Этот файл
```

---

## Проблемы и решения

| Проблема | Решение |
|----------|---------|
| Бот не отвечает | Проверь токен и URL сервера |
| Ошибка 500 на сервере | `railway logs` для просмотра логов |
| Бот не видит игрока | Проверь `playerId` в запросах |
| Игра не начинается | Оба игрока должны нажать /play |

---

## Как играть

1. Запусти бота @YourBot
2. Нажми /start
3. Нажми "Играть"
4. Друг тоже должен нажать /start → "Играть"
5. Когда найден противник - игра начинается!

---

## Быстрые ссылки

- Railway: https://railway.app
- Render: https://render.com
- PythonAnywhere: https://pythonanywhere.com
- @BotFather: https://t.me/BotFather
- telebot docs: https://telebot.readthedocs.io