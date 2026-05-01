const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));

// Хранилище игр
const games = new Map();
// Очереди ожидающих игроков
let waitingPlayer = null;

// ========== ИГРОВАЯ ЛОГИКА ==========

const BOARD_SIZE = 10;
const SHIPS = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];

function createEmptyBoard() {
    return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
}

function canPlaceShip(board, x, y, size, direction) {
    if (direction === 'horizontal') {
        if (x + size > BOARD_SIZE) return false;
        for (let i = 0; i < size; i++) {
            if (board[y][x + i] !== 0) return false;
        }
        // Проверка соседей
        for (let i = -1; i <= size; i++) {
            for (let j = -1; j <= 1; j++) {
                const nx = x + i, ny = y + j;
                if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
                    if (board[ny][nx] === 1) return false;
                }
            }
        }
    } else {
        if (y + size > BOARD_SIZE) return false;
        for (let i = 0; i < size; i++) {
            if (board[y + i][x] !== 0) return false;
        }
        for (let i = -1; i <= size; i++) {
            for (let j = -1; j <= 1; j++) {
                const nx = x + j, ny = y + i;
                if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
                    if (board[ny][nx] === 1) return false;
                }
            }
        }
    }
    return true;
}

function placeShip(board, x, y, size, direction) {
    for (let i = 0; i < size; i++) {
        if (direction === 'horizontal') {
            board[y][x + i] = 1;
        } else {
            board[y + i][x] = 1;
        }
    }
}

function randomPlaceShips() {
    let board = createEmptyBoard();
    let placed = 0;
    let attempts = 0;
    
    while (placed < SHIPS.length && attempts < 1000) {
        attempts++;
        const x = Math.floor(Math.random() * BOARD_SIZE);
        const y = Math.floor(Math.random() * BOARD_SIZE);
        const direction = Math.random() > 0.5 ? 'horizontal' : 'vertical';
        const size = SHIPS[placed];
        
        if (canPlaceShip(board, x, y, size, direction)) {
            placeShip(board, x, y, size, direction);
            placed++;
        }
    }
    
    return board;
}

function checkSunk(board, x, y) {
    const stack = [[x, y]];
    const visited = new Set();
    let size = 0;
    
    while (stack.length > 0) {
        const [cx, cy] = stack.pop();
        const key = `${cx},${cy}`;
        
        if (visited.has(key)) continue;
        visited.add(key);
        
        if (board[cy] && board[cy][cx] === 3) {
            size++;
            const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
            for (const [dx, dy] of directions) {
                const nx = cx + dx, ny = cy + dy;
                if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
                    if (board[ny][nx] === 3) {
                        stack.push([nx, ny]);
                    }
                }
            }
        }
    }
    
    return SHIPS.includes(size);
}

// ========== API ЭНДПОИНТЫ ==========

// Создать новую игру
app.post('/api/game/create', (req, res) => {
    const { playerId, playerName } = req.body;
    
    if (!playerId) {
        return res.status(400).json({ error: 'playerId required' });
    }
    
    const gameId = uuidv4().substring(0, 8);
    
    // Удаляем старые игры (старше 30 минут)
    cleanupGames();
    
    // Если есть ожидающий игрок - создаем игру
    if (waitingPlayer && waitingPlayer.id !== playerId) {
        const game = {
            id: gameId,
            players: [
                { id: waitingPlayer.id, name: waitingPlayer.name, board: waitingPlayer.board, shipsLeft: 20 },
                { id: playerId, name: playerName || 'Player', board: createEmptyBoard(), shipsLeft: 20 }
            ],
            turn: 0, // index игрока, чей ход
            phase: 'placement', // placement, battle, end
            winner: null,
            createdAt: Date.now()
        };
        
        games.set(gameId, game);
        waitingPlayer = null;
        
        res.json({ 
            gameId, 
            status: 'started',
            opponent: game.players[0],
            youAre: 1
        });
    } else {
        // Добавляем в очередь
        waitingPlayer = {
            id: playerId,
            name: playerName || 'Player',
            board: randomPlaceShips()
        };
        
        res.json({ 
            gameId: null, 
            status: 'waiting',
            message: 'Ожидаю противника...'
        });
    }
});

// Присоединиться к игре
app.post('/api/game/join', (req, res) => {
    const { playerId, playerName, gameId } = req.body;
    
    if (!playerId || !gameId) {
        return res.status(400).json({ error: 'playerId и gameId required' });
    }
    
    const game = games.get(gameId);
    
    if (!game) {
        return res.status(404).json({ error: 'Игра не найдена' });
    }
    
    if (game.players.length >= 2) {
        return res.status(400).json({ error: 'Игра уже началась' });
    }
    
    game.players.push({
        id: playerId,
        name: playerName || 'Player',
        board: createEmptyBoard(),
        shipsLeft: 20
    });
    
    res.json({ 
        gameId, 
        status: 'started',
        youAre: 1
    });
});

// Получить состояние игры
app.get('/api/game/:gameId', (req, res) => {
    const { gameId } = req.params;
    const { playerId } = req.query;
    
    const game = games.get(gameId);
    
    if (!game) {
        return res.status(404).json({ error: 'Игра не найдена' });
    }
    
    const playerIndex = game.players.findIndex(p => p.id === playerId);
    
    // Скрываем корабли противника
    const safePlayers = game.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        shipsLeft: p.shipsLeft,
        board: i === playerIndex ? p.board : (game.phase === 'placement' ? null : p.board)
    }));
    
    res.json({
        gameId: game.id,
        players: safePlayers,
        turn: game.turn,
        phase: game.phase,
        winner: game.winner
    });
});

// Разместить корабль (мультиплеер)
app.post('/api/game/:gameId/place', (req, res) => {
    const { gameId } = req.params;
    const { playerId, x, y, size, direction } = req.body;
    
    const game = games.get(gameId);
    
    if (!game) {
        return res.status(404).json({ error: 'Игра не найдена' });
    }
    
    const playerIndex = game.players.findIndex(p => p.id === playerId);
    
    if (playerIndex === -1) {
        return res.status(400).json({ error: 'Вы не в игре' });
    }
    
    const player = game.players[playerIndex];
    
    if (!canPlaceShip(player.board, x, y, size, direction)) {
        return res.status(400).json({ error: 'Нельзя разместить здесь' });
    }
    
    placeShip(player.board, x, y, size, direction);
    
    // Проверяем, готовы ли все
    const allReady = game.players.every(p => {
        let count = 0;
        for (let y = 0; y < BOARD_SIZE; y++) {
            for (let x = 0; x < BOARD_SIZE; x++) {
                if (p.board[y][x] === 1) count++;
            }
        }
        return count === 20;
    });
    
    if (allReady) {
        game.phase = 'battle';
        game.turn = 0;
    }
    
    res.json({ success: true, allReady });
});

// Атаковать (мультиплеер)
app.post('/api/game/:gameId/attack', (req, res) => {
    const { gameId } = req.params;
    const { playerId, x, y } = req.body;
    
    const game = games.get(gameId);
    
    if (!game) {
        return res.status(404).json({ error: 'Игра не найдена' });
    }
    
    if (game.phase !== 'battle') {
        return res.status(400).json({ error: 'Игра не началась' });
    }
    
    const playerIndex = game.players.findIndex(p => p.id === playerId);
    
    if (playerIndex !== game.turn) {
        return res.status(400).json({ error: 'Не ваш ход' });
    }
    
    const enemyIndex = (playerIndex + 1) % 2;
    const enemy = game.players[enemyIndex];
    const enemyBoard = enemy.board;
    
    // Проверяем, уже стреляли сюда
    if (enemyBoard[y][x] > 1) {
        return res.status(400).json({ error: 'Сюда уже стреляли' });
    }
    
    let result;
    if (enemyBoard[y][x] === 1) {
        enemyBoard[y][x] = 3;
        result = 'hit';
        
        if (checkSunk(enemyBoard, x, y)) {
            enemy.shipsLeft--;
            
            if (enemy.shipsLeft <= 0) {
                game.phase = 'end';
                game.winner = playerIndex;
                return res.json({ result: 'win', winner: playerIndex });
            }
        }
    } else {
        enemyBoard[y][x] = 2;
        result = 'miss';
        game.turn = enemyIndex;
    }
    
    res.json({ result, nextTurn: game.turn });
});

// Отменить ожидание
app.post('/api/game/cancel', (req, res) => {
    const { playerId } = req.body;
    
    if (waitingPlayer && waitingPlayer.id === playerId) {
        waitingPlayer = null;
    }
    
    res.json({ success: true });
});

// Удалить старые игры
function cleanupGames() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 минут
    
    for (const [id, game] of games) {
        if (now - game.createdAt > maxAge) {
            games.delete(id);
        }
    }
}

// Очистка каждый час
setInterval(cleanupGames, 60 * 60 * 1000);

// Статические файлы
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🎮 Battleship server running on port ${PORT}`);
});