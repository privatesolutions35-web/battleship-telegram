const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const path = require('path');
const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

const games = new Map();
let waitingPlayer = null;
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
    let placed = 0, attempts = 0;
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
            const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
            for (const [dx, dy] of dirs) {
                const nx = cx + dx, ny = cy + dy;
                if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
                    if (board[ny][nx] === 3) stack.push([nx, ny]);
                }
            }
        }
    }
    return SHIPS.includes(size);
}

app.post('/api/game/create', (req, res) => {
    const { playerId, playerName } = req.body;
    if (!playerId) return res.status(400).json({ error: 'playerId required' });
    
    // Cleanup old games
    for (const [id, game] of games) {
        if (Date.now() - game.createdAt > 30 * 60 * 1000) games.delete(id);
    }
    
    if (waitingPlayer && waitingPlayer.id !== playerId) {
        const gameId = uuidv4().substring(0, 8);
        const game = {
            id: gameId,
            players: [
                { id: waitingPlayer.id, name: waitingPlayer.name, board: waitingPlayer.board, shipsLeft: 20 },
                { id: playerId, name: playerName || 'Player', board: createEmptyBoard(), shipsLeft: 20 }
            ],
            turn: 0,
            phase: 'placement',
            winner: null,
            createdAt: Date.now()
        };
        games.set(gameId, game);
        waitingPlayer = null;
        return res.json({ gameId, status: 'started', opponent: game.players[0], youAre: 1 });
    } else {
        waitingPlayer = { id: playerId, name: playerName || 'Player', board: randomPlaceShips() };
        return res.json({ gameId: null, status: 'waiting', message: 'Waiting for opponent...' });
    }
});

app.post('/api/game/join', (req, res) => {
    const { playerId, playerName, gameId } = req.body;
    if (!playerId || !gameId) return res.status(400).json({ error: 'playerId и gameId required' });
    const game = games.get(gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (game.players.length >= 2) return res.status(400).json({ error: 'Game already started' });
    game.players.push({ id: playerId, name: playerName || 'Player', board: createEmptyBoard(), shipsLeft: 20 });
    return res.json({ gameId, status: 'started', youAre: 1 });
});

app.get('/api/game/:gameId', (req, res) => {
    const game = games.get(req.params.gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    const playerIndex = game.players.findIndex(p => p.id === req.query.playerId);
    const safePlayers = game.players.map((p, i) => ({
        id: p.id, name: p.name, shipsLeft: p.shipsLeft,
        board: i === playerIndex ? p.board : (game.phase === 'placement' ? null : p.board)
    }));
    return res.json({ gameId: game.id, players: safePlayers, turn: game.turn, phase: game.phase, winner: game.winner });
});

app.post('/api/game/:gameId/attack', (req, res) => {
    const game = games.get(req.params.gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (game.phase !== 'battle') return res.status(400).json({ error: 'Game not started' });
    const playerIndex = game.players.findIndex(p => p.id === req.body.playerId);
    if (playerIndex !== game.turn) return res.status(400).json({ error: 'Not your turn' });
    const { x, y } = req.body;
    const enemyIndex = (playerIndex + 1) % 2;
    const enemy = game.players[enemyIndex];
    if (enemy.board[y][x] > 1) return res.status(400).json({ error: 'Already shot here' });
    let result;
    if (enemy.board[y][x] === 1) {
        enemy.board[y][x] = 3;
        result = 'hit';
        if (checkSunk(enemy.board, x, y)) {
            enemy.shipsLeft--;
            if (enemy.shipsLeft <= 0) {
                game.phase = 'end';
                game.winner = playerIndex;
                return res.json({ result: 'win', winner: playerIndex });
            }
        }
    } else {
        enemy.board[y][x] = 2;
        result = 'miss';
        game.turn = enemyIndex;
    }
    return res.json({ result, nextTurn: game.turn });
});

app.post('/api/game/cancel', (req, res) => {
    if (waitingPlayer && waitingPlayer.id === req.body.playerId) waitingPlayer = null;
    return res.json({ success: true });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Battleship server on ${PORT}`));