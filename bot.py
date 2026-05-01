#!/usr/bin/env python3
"""
Telegram бот для игры Морской Бой (мультиплеер)
Требует: python-telegram-bot (telebot)
Установка: pip install telebot
Запуск: python bot.py
"""

import telebot
import requests
import json
import os
import time

# ========== КОНФИГУРАЦИЯ ==========

# Токен бота от @BotFather
BOT_TOKEN = 'YOUR_BOT_TOKEN_HERE'

# URL вашего сервера (Railway, Render, Heroku)
SERVER_URL = 'https://your-app-name.railway.app'

# Для локальной разработки:
# SERVER_URL = 'http://localhost:3000'

bot = telebot.TeleBot(BOT_TOKEN)

# Хранилище состояний пользователей
user_states = {}
user_games = {}

# ========== КЛАВИАТУРЫ ==========

def get_main_menu():
    return telebot.types.InlineKeyboardMarkup(row_width=2).add(
        telebot.types.InlineKeyboardButton("🎮 Играть", callback_data="play"),
        telebot.types.InlineKeyboardButton("❓ Помощь", callback_data="help")
    )

def get_cancel_menu():
    return telebot.types.InlineKeyboardMarkup().add(
        telebot.types.InlineKeyboardButton("❌ Отмена", callback_data="cancel")
    )

# ========== HTTP ЗАПРОСЫ ==========

def api_create_game(player_id, player_name):
    """Создать игру"""
    try:
        r = requests.post(
            f'{SERVER_URL}/api/game/create',
            json={'playerId': str(player_id), 'playerName': player_name},
            timeout=10
        )
        return r.json()
    except Exception as e:
        print(f"Error: {e}")
        return None

def api_get_game(game_id, player_id):
    """Получить состояние игры"""
    try:
        r = requests.get(
            f'{SERVER_URL}/api/game/{game_id}',
            params={'playerId': str(player_id)},
            timeout=10
        )
        return r.json()
    except:
        return None

def api_attack(game_id, player_id, x, y):
    """Атаковать"""
    try:
        r = requests.post(
            f'{SERVER_URL}/api/game/{game_id}/attack',
            json={'playerId': str(player_id), 'x': x, 'y': y},
            timeout=10
        )
        return r.json()
    except:
        return None

# ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

def render_board(board, show_ships=True, hit_board=None):
    """Рисовать поле"""
    if board is None:
        return "⏳ Ожидание поля..."
    
    symbols = {0: '⬜', 1: '🟦' if show_ships else '⬜', 2: '💧', 3: '💥'}
    
    result = "📊 Поле противника:\n"
    result += "   " + " ".join(str(i) for i in range(10)) + "\n"
    
    for y in range(10):
        result += f"{y} "
        for x in range(10):
            val = board[y][x]
            if hit_board and hit_board[y][x] > 1:
                result += " " + symbols.get(val if hit_board[y][x] == 1 else hit_board[y][x], '⬜')
            else:
                result += " " + symbols.get(val, '⬜')
        result += "\n"
    
    return result

def get_cell_keyboard(game_id, board):
    """Клавиатура с клетками"""
    keyboard = telebot.types.InlineKeyboardMarkup(row_width=10)
    
    for y in range(10):
        row = []
        for x in range(10):
            # Скрываем неизвестые клетки
            if board is None or (board[y][x] == 0):
                callback = f"atk|{game_id}|{x}|{y}"
                row.append(telebot.types.InlineKeyboardButton("⬜", callback_data=callback))
            elif board[y][x] == 1:
                # Неизвестный корабль
                callback = f"atk|{game_id}|{x}|{y}"
                row.append(telebot.types.InlineKeyboardButton("❔", callback_data=callback))
            elif board[y][x] == 2:
                row.append(telebot.types.InlineKeyboardButton("💧", callback_data="none"))
            elif board[y][x] == 3:
                row.append(telebot.types.InlineKeyboardButton("💥", callback_data="none"))
        keyboard.row(*row)
    
    return keyboard

# ========== ОБРАБОТЧИКИ КОМАНД ==========

@bot.message_handler(commands=['start'])
def cmd_start(message):
    """Приветствие"""
    name = message.from_user.first_name
    welcome = f"Привет, {name}! 🚢\n\n"
    welcome += "Морской Бой - Multiplayer\n"
    welcome += "Играй с другими игроками Telegram!\n\n"
    welcome += "Выбери действие:"
    
    bot.send_message(
        message.chat.id,
        welcome,
        reply_markup=get_main_menu()
    )

@bot.message_handler(commands=['play', 'играть'])
def cmd_play(message):
    """Начать игру"""
    user_id = message.from_user.id
    name = message.from_user.first_name or "Player"
    
    bot.send_message(
        message.chat.id,
        "🔍 Ищу противника...",
        reply_markup=get_cancel_menu()
    )
    
    result = api_create_game(user_id, name)
    
    if result is None:
        bot.edit_message_text(
            "❌ Ошибка сервера. Попробуй позже.",
            message.chat.id,
            message.message_id
        )
        return
    
    if result.get('status') == 'waiting':
        msg = f"⏳ {result.get('message')}\n\n"
        msg += "Поделись этим ботом с другом,\n"
        msg += "чтобы пригласить его!"
        
        keyboard = telebot.types.InlineKeyboardMarkup().add(
            telebot.types.InlineKeyboardButton("❌ Отмена", callback_data="cancel_wait")
        )
        
        bot.edit_message_text(msg, message.chat.id, message.message_id, reply_markup=keyboard)
        user_states[user_id] = {'state': 'waiting', 'message_id': message.message_id}
        
    elif result.get('status') == 'started':
        game_id = result.get('gameId')
        user_games[user_id] = game_id
        
        msg = "🎉 Игра началась!\n\n"
        msg += f"Вы играете против: {result.get('opponent', {}).get('name', 'Player')}\n\n"
        msg += "Размещайте корабли и делайте ходы!"
        
        bot.edit_message_text(msg, message.chat.id, message.message_id)

@bot.message_handler(commands=['help', 'помощь'])
def cmd_help(message):
    """Помощь"""
    help_text = "🎮 Морской Бой - Инструкция\n\n"
    help_text += "1. Нажми 'Играть' для поиска игры\n"
    help_text += "2. Дождись противника\n"
    help_text += "3. Размести корабли\n"
    help_text += "4. Бей по полю противника\n"
    help_text += "5. Победи, уничтожив все корабли!\n\n"
    help_text += "📊 Количество кораблей:\n"
    help_text += "• 1 × 4 клетки\n"
    help_text += "• 2 × 3 клетки\n"
    help_text += "• 3 × 2 клетки\n"
    help_text += "• 4 × 1 клетка"
    
    bot.send_message(message.chat.id, help_text)

@bot.message_handler(commands=['cancel'])
def cmd_cancel(message):
    """Отмена"""
    user_id = message.from_user.id
    
    if user_id in user_states:
        del user_states[user_id]
    
    bot.send_message(
        message.chat.id,
        "❌ Отменено",
        reply_markup=get_main_menu()
    )

# ========== CALLBACK QUERY ==========

@bot.callback_query_handler(func=lambda call: True)
def callback_handler(call):
    """Обработка callback"""
    user_id = call.from_user.id
    chat_id = call.message.chat.id
    message_id = call.message.message_id
    
    data = call.data
    
    if data == "play":
        cmd_play(call.message)
        
    elif data == "help":
        cmd_help(call.message)
        bot.answer_callback_query(call.id)
        
    elif data == "cancel" or data == "cancel_wait":
        cmd_cancel(call.message)
        
    elif data.startswith("atk|"):
        # Атаковать клетку
        parts = data.split("|")
        game_id = parts[1]
        x = int(parts[2])
        y = int(parts[3])
        
        result = api_attack(game_id, user_id, x, y)
        
        if result is None:
            bot.answer_callback_query(call.id, "❌ Ошибка сервера", show_alert=True)
            return
        
        if result.get('result') == 'hit':
            bot.answer_callback_query(call.id, "💥 ПОПАДАНИЕ!", show_alert=False)
        elif result.get('result') == 'miss':
            bot.answer_callback_query(call.id, "💧 Промах", show_alert=False)
        elif result.get('result') == 'win':
            bot.answer_callback_query(call.id, "🎉 ПОБЕДА!", show_alert=True)
            bot.edit_message_text(
                "🎉 ПОБЕДА!\n\nТы уничтожил весь флот противника!",
                chat_id, message_id
            )
        else:
            bot.answer_callback_query(call.id, str(result.get('error', 'OK'))
        
        # Обновляем поле
        game = api_get_game(game_id, user_id)
        if game and game.get('players'):
            enemy_idx = 1 if game.get('turn') == 0 else 0
            enemy_board = game['players'][enemy_idx].get('board')
            
            if enemy_board and enemy_idx != game.get('turn'):
                keyboard = get_cell_keyboard(game_id, enemy_board)
                bot.edit_message_text(
                    "🎯 Твой ход! Выбери клетку:",
                    chat_id, message_id, reply_markup=keyboard
                )
    
    bot.answer_callback_query(call.id)

# ========== ЗАПУСК ==========

print("🚀 Запуск бота...")
print(f"Сервер: {SERVER_URL}")

# Удаляем вебхук перед polling
try:
    bot.remove_webhook()
except:
    pass

print("✅ Бот готов! Нажми Ctrl+C для остановки")

while True:
    try:
        bot.infinity_polling(timeout=60, long_polling_timeout=60)
    except Exception as e:
        print(f"Error: {e}")
        time.sleep(5)