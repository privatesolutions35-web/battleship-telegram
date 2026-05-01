# Морской Бой - Telegram Multiplayer

## Как работает мультиплеер

Для игры вдвоем в Telegram нужно:

### Вариант 1: Через Telegram Bot (простой)

1. Создать бота через @BotFather
2. Хранилище данных (Redis/PostgreSQL)
3. Сервер на Node.js/Python

### Вариант 2: Telegram Game Platform (рекомендуемый)

1. Создать игру через @BotFather -> Game
2. Использовать Telegram Game API
3. Игроки автоматически приглашаются

## Архитектура

```
Telegram User A → Bot → Game Server → Telegram User B
                    ↓
              [game_state]
{
  "game_id": "123",
  "players": ["user1", "user2"],
  "turn": "user1",
  "boards": {...}
}
```

## Что нужно для запуска

### 1. Хостинг (сервер)

```javascript
// server.js - Node.js
const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);

const games = new Map();

app.post('/api/create', (req, res) => {
  const gameId = Date.now().toString();
  games.set(gameId, {
    id: gameId,
    players: [],
    turn: 0,
    playerBoard: createEmptyBoard(),
    enemyBoard: createEmptyBoard(),
    shipsLeft: [20, 20]
  });
  res.json({ gameId });
});

app.post('/api/join/:gameId', (req, res) => {
  // Присоединить игрока
});

app.post('/api/attack/:gameId', (req, res) => {
  // Обработать атаку
});

app.listen(3000);
```

### 2. Telegram Bot

```python
# bot.py - Python
import telebot
import requests

TOKEN = 'YOUR_BOT_TOKEN'
bot = telebot.TeleBot(TOKEN)

@bot.message_handler(commands=['start'])
def start_game(message):
    # Создать игру или показать список
    pass

@bot.callback_query_handler(func=lambda call: True)
def game_callback(call):
    # Обработать ход
    pass

bot.polling()
```

## Быстрый старт

### Через Heroku/Render/ Railway:

1. Загрузить `server.js`
2. Настроить `package.json`
3. Указать вебхук в Telegram

### Через Cloudflare Workers:

1. Написать workers обработчик
2. Привязать домен

## Текущий статус

Single-player версия готова. Для мультиплеера нужен сервер.

Хотите, чтобы я:
1. Создал серверную часть + бота?
2. Показал пример запуска на бесплатном хостинге?
3. Добавить режим "играть с другом" в текущий код?