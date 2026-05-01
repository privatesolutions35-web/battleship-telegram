#!/usr/bin/env python3
"""Telegram бот для игры Морской Бой (мультиплеер)"""
import telebot
import requests
import time

BOT_TOKEN = '8726025881:AAHxwBxAuvsOvH_RHbwe-At8wekLkBRIXjI'
SERVER_URL = 'https://battleship-telegram.onrender.com'

bot = telebot.TeleBot(BOT_TOKEN)
user_games = {}

def api_create_game(player_id, player_name):
    try:
        r = requests.post(f'{SERVER_URL}/api/game/create', json={'playerId': str(player_id), 'playerName': player_name}, timeout=10)
        return r.json()
    except Exception as e:
        print(f"Error: {e}")
        return None

def api_attack(game_id, player_id, x, y):
    try:
        r = requests.post(f'{SERVER_URL}/api/game/{game_id}/attack', json={'playerId': str(player_id), 'x': x, 'y': y}, timeout=10)
        return r.json()
    except:
        return None

def api_get_game(game_id, player_id):
    try:
        r = requests.get(f'{SERVER_URL}/api/game/{game_id}', params={'playerId': str(player_id)}, timeout=10)
        return r.json()
    except:
        return None

def get_cell_keyboard(game_id, board):
    keyboard = telebot.types.InlineKeyboardMarkup(row_width=10)
    for y in range(10):
        row = []
        for x in range(10):
            if board is None or board[y][x] < 2:
                callback = f"atk|{game_id}|{x}|{y}"
                if board and board[y][x] == 1:
                    row.append(telebot.types.InlineKeyboardButton("?", callback_data=callback))
                else:
                    row.append(telebot.types.InlineKeyboardButton("0", callback_data=callback))
            elif board[y][x] == 2:
                row.append(telebot.types.InlineKeyboardButton("~", callback_data="none"))
            elif board[y][x] == 3:
                row.append(telebot.types.InlineKeyboardButton("X", callback_data="none"))
        keyboard.row(*row)
    return keyboard

def get_main_menu():
    return telebot.types.InlineKeyboardMarkup().add(
        telebot.types.InlineKeyboardButton("Play", callback_data="play"),
        telebot.types.InlineKeyboardButton("Help", callback_data="help")
    )

@bot.message_handler(commands=['start'])
def cmd_start(message):
    name = message.from_user.first_name or "Player"
    bot.send_message(message.chat.id, f"Hi {name}!\n\nBattleship Multiplayer\nPlay with friends!", reply_markup=get_main_menu())

@bot.message_handler(commands=['play', 'game'])
def cmd_play(message):
    user_id = message.from_user.id
    name = message.from_user.first_name or "Player"
    
    result = api_create_game(user_id, name)
    
    if result is None:
        bot.send_message(message.chat.id, "Server error. Try later.")
        return
    
    if result.get('status') == 'waiting':
        msg = f"Waiting for opponent...\n\nInvite friend to /play"
        keyboard = telebot.types.InlineKeyboardMarkup().add(
            telebot.types.InlineKeyboardButton("Cancel", callback_data="cancel")
        )
        bot.send_message(message.chat.id, msg, reply_markup=keyboard)
    elif result.get('status') == 'started':
        game_id = result.get('gameId')
        user_games[user_id] = game_id
        opponent = result.get('opponent', {}).get('name', 'Opponent')
        keyboard = get_cell_keyboard(game_id, [[0]*10 for _ in range(10)])
        bot.send_message(message.chat.id, f"Game started!\nOpponent: {opponent}\n\nYour turn!", reply_markup=keyboard)

@bot.message_handler(commands=['help'])
def cmd_help(message):
    bot.send_message(message.chat.id, "Commands:\n/start - Start\n/play - Find game\n/help - Help")

@bot.callback_query_handler(func=lambda call: True)
def callback_handler(call):
    user_id = call.from_user.id
    chat_id = call.message.chat.id
    message_id = call.message.message_id
    data = call.data
    
    if data == "play":
        cmd_play(call.message)
    elif data == "help":
        cmd_help(call.message)
    elif data == "cancel":
        bot.answer_callback_query(call.id, "Cancelled")
        bot.edit_message_text("Cancelled", chat_id, message_id, reply_markup=get_main_menu())
    elif data.startswith("atk|"):
        parts = data.split("|")
        game_id = parts[1]
        x = int(parts[2])
        y = int(parts[3])
        
        if user_id not in user_games or user_games[user_id] != game_id:
            bot.answer_callback_query(call.id, "Start game with /play", show_alert=True)
            return
        
        result = api_attack(game_id, user_id, x, y)
        
        if result is None:
            bot.answer_callback_query(call.id, "Server error", show_alert=True)
            return
        
        if result.get('result') == 'hit':
            bot.answer_callback_query(call.id, "HIT!")
        elif result.get('result') == 'miss':
            bot.answer_callback_query(call.id, "Miss")
        elif result.get('result') == 'win':
            bot.answer_callback_query(call.id, "YOU WIN!", show_alert=True)
            bot.edit_message_text("VICTORY!\n\nYou sunk all enemy ships!", chat_id, message_id, reply_markup=get_main_menu())
            user_games.pop(user_id, None)
            return
        
        game = api_get_game(game_id, user_id)
        if game and game.get('players'):
            enemy_idx = 1 if game.get('turn') == 0 else 0
            enemy_board = game['players'][enemy_idx].get('board')
            keyboard = get_cell_keyboard(game_id, enemy_board or [[0]*10 for _ in range(10)])
            bot.edit_message_reply_markup(chat_id, message_id, reply_markup=keyboard)
    
    bot.answer_callback_query(call.id)

print("Bot starting...")
try:
    bot.remove_webhook()
except:
    pass
while True:
    try:
        bot.infinity_polling(timeout=60, long_polling_timeout=60)
    except Exception as e:
        print(f"Error: {e}")
        time.sleep(5)