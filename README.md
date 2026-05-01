# Battleship - Telegram Multiplayer Game

## Quick Start

### Single Player (vs AI)
1. Open `index.html` in browser
2. No server needed!

### Multiplayer (vs Friend)
1. Deploy server on Render/Railway
2. Run Telegram bot
3. Two players press /play

## Deploy Server

### Render.com (free)
1. https://render.com → New → Web Service
2. Connect GitHub repo
3. Settings:
   - **Build**: `npm install`
   - **Start**: `node server.js`
4. Deploy!

### Railway (alternative)
1. https://railway.app → New Project
2. Connect GitHub repo
3. Start command: `node server.js`

## Run Telegram Bot

### Local
```bash
pip install telebot
python bot.py
```

### PythonAnywhere (free hosting)
1. Upload `bot.py`
2. Run in console

## Files
```
battleship/
├── index.html      # Game client
├── server.js      # Node.js API server
├── package.json  # Dependencies
├── bot.py        # Telegram bot
└── README.md     # This file
```

## Telegram Bot Setup
1. Get token from @BotFather
2. Edit `BOT_TOKEN` in `bot.py`
3. Edit `SERVER_URL` in `bot.py` (your deployed server URL)