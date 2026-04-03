/* =========================================================
   NeuroPlay Arcade - Connect 4
   Full Game Logic + AI

   Purpose:
   - Implements the complete Connect 4 game flow
   - Handles player input, board rendering, scoring, and history
   - Includes AI behavior with difficulty scaling and board analysis
   ========================================================= */

(() => {
    "use strict";

    /* =========================
       CONFIG
       ========================= */

    /* Standard Connect 4 board dimensions */
    const ROWS = 6;
    const COLS = 7;

    /* Internal cell state values */
    const EMPTY = 0;
    const PLAYER_ONE = 1;
    const PLAYER_TWO = 2;

    /* Maps player IDs to their visual color class names */
    const COLORS = {
        [PLAYER_ONE]: "red",
        [PLAYER_TWO]: "yellow"
    };

    /* Number of connected pieces required to win */
    const WINNING_LENGTH = 4;

    /* AI search depth by difficulty level */
    const AI_DEPTH_MAP = {
        easy: 2,
        medium: 4,
        hard: 5,
        expert: 6
    };

    /* AI randomness by difficulty:
       lower randomness = stronger / more consistent play */
    const AI_RANDOMNESS = {
        easy: 0.45,
        medium: 0.18,
        hard: 0.08,
        expert: 0.02
    };

    /* =========================
       DOM
       ========================= */

    /* Main board and column controls */
    const boardElement = document.getElementById("connect4Board");
    const columnButtonsContainer = document.getElementById("columnButtons");
    const boardMessage = document.getElementById("boardMessage");

    /* Game mode and difficulty selectors */
    const modeSelect = document.getElementById("modeSelect");
    const difficultySelect = document.getElementById("difficultySelect");

    /* Primary action buttons */
    const newGameBtn = document.getElementById("newGameBtn");
    const resetScoreBtn = document.getElementById("resetScoreBtn");
    const undoBtn = document.getElementById("undoBtn");

    /* Status and metadata labels */
    const gameModeLabel = document.getElementById("gameModeLabel");
    const difficultyLabel = document.getElementById("difficultyLabel");
    const turnLabel = document.getElementById("turnLabel");
    const statusLabel = document.getElementById("statusLabel");

    /* Current state indicators */
    const currentPlayerText = document.getElementById("currentPlayerText");
    const moveCounter = document.getElementById("moveCounter");
    const aiThinkingLabel = document.getElementById("aiThinkingLabel");

    /* Scoreboard elements */
    const player1ScoreElement = document.getElementById("player1Score");
    const player2ScoreElement = document.getElementById("player2Score");
    const drawScoreElement = document.getElementById("drawScore");
    const player2Title = document.getElementById("player2Title");

    /* AI analysis panel */
    const bestMovePrediction = document.getElementById("bestMovePrediction");
    const boardEvaluation = document.getElementById("boardEvaluation");
    const threatLevel = document.getElementById("threatLevel");

    /* Move history list */
    const historyList = document.getElementById("historyList");

    /* Winner modal elements */
    const winnerModal = document.getElementById("winnerModal");
    const winnerTitle = document.getElementById("winnerTitle");
    const winnerText = document.getElementById("winnerText");
    const playAgainBtn = document.getElementById("playAgainBtn");
    const closeWinnerBtn = document.getElementById("closeWinnerBtn");

    /* =========================
       AUDIO
       ========================= */

    /* Local game sound effects */
    const sounds = {
        click: createAudio("assets/sounds/click.wav"),
        drop: createAudio("assets/sounds/drop.wav"),
        win: createAudio("assets/sounds/win.wav"),
        lose: createAudio("assets/sounds/lose.wav")
    };

    /* Safely create an audio object */
    function createAudio(src) {
        try {
            return new Audio(src);
        } catch (error) {
            return null;
        }
    }

    /* Play a named sound effect if available */
    function playSound(name) {
        const sound = sounds[name];
        if (!sound) return;
        try {
            sound.currentTime = 0;
            sound.play().catch(() => {});
        } catch (error) {
            /* silent */
        }
    }

    /* =========================
       GAME STATE
       ========================= */

    /* Current board matrix */
    let board = [];

    /* Tracks whose turn it is */
    let currentPlayer = PLAYER_ONE;

    /* Indicates whether the game has ended */
    let gameOver = false;

    /* Stores move history for undo and history panel */
    let moveHistory = [];

    /* Prevents input while AI is calculating */
    let isAIThinking = false;

    /* Score totals across rounds */
    let scores = {
        player1: 0,
        player2: 0,
        draws: 0
    };

    /* Cached board cell DOM references */
    let cells = [];

    /* =========================
       INIT
       ========================= */

    /* Initializes the game UI and state on page load */
    function init() {
        createEmptyBoard();
        renderBoardSkeleton();
        attachEvents();
        syncLabels();
        updateAllUI();
        renderBoard();
        showMessage("Welcome to 4 in a Row. Start the game by dropping a piece.");
        updateAIHints();
    }

    /* Resets the internal board and round-specific state */
    function createEmptyBoard() {
        board = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
        currentPlayer = PLAYER_ONE;
        gameOver = false;
        moveHistory = [];
        isAIThinking = false;
    }

    /* Builds the static board cell structure once */
    function renderBoardSkeleton() {
        boardElement.innerHTML = "";
        cells = [];

        for (let row = 0; row < ROWS; row += 1) {
            for (let col = 0; col < COLS; col += 1) {
                const cell = document.createElement("div");
                cell.className = "cell";
                cell.dataset.row = String(row);
                cell.dataset.col = String(col);
                boardElement.appendChild(cell);
                cells.push(cell);
            }
        }
    }

    /* =========================
       EVENTS
       ========================= */

    /* Wires UI events to game actions */
    function attachEvents() {
        if (columnButtonsContainer) {
            columnButtonsContainer.addEventListener("click", handleColumnButtonClick);
        }

        if (newGameBtn) {
            newGameBtn.addEventListener("click", () => {
                playSound("click");
                startNewGame();
            });
        }

        if (resetScoreBtn) {
            resetScoreBtn.addEventListener("click", () => {
                playSound("click");
                resetScores();
            });
        }

        if (undoBtn) {
            undoBtn.addEventListener("click", () => {
                playSound("click");
                undoMove();
            });
        }

        if (modeSelect) {
            modeSelect.addEventListener("change", () => {
                playSound("click");
                syncLabels();
                startNewGame();
            });
        }

        if (difficultySelect) {
            difficultySelect.addEventListener("change", () => {
                playSound("click");
                syncLabels();
                updateAIHints();
            });
        }

        if (playAgainBtn) {
            playAgainBtn.addEventListener("click", () => {
                hideWinnerModal();
                startNewGame();
            });
        }

        if (closeWinnerBtn) {
            closeWinnerBtn.addEventListener("click", () => {
                hideWinnerModal();
            });
        }
    }

    /* Handles clicks on the column selection buttons */
    function handleColumnButtonClick(event) {
        const button = event.target.closest(".column-btn");
        if (!button) return;

        const column = Number(button.dataset.col);
        if (Number.isNaN(column)) return;

        attemptMove(column);
    }

    /* =========================
       CORE GAME FLOW
       ========================= */

    /* Validates and processes a move attempt */
    function attemptMove(column) {
        if (gameOver || isAIThinking) return;
        if (!isValidMove(board, column)) return;

        const isHumanTurn =
            currentPlayer === PLAYER_ONE ||
            (currentPlayer === PLAYER_TWO && modeSelect.value === "pvp");

        if (!isHumanTurn) return;

        makeMove(column, currentPlayer, true);

        /* If AI mode is enabled and it is now AI's turn, schedule the AI move */
        if (!gameOver && modeSelect.value === "ai" && currentPlayer === PLAYER_TWO) {
            scheduleAIMove();
        }
    }

    /* Executes a move on the board and updates all dependent state */
    function makeMove(column, player, recordHistory = true) {
        const row = getNextOpenRow(board, column);
        if (row === -1) return false;

        board[row][column] = player;

        /* Save move snapshot for undo/history support */
        if (recordHistory) {
            moveHistory.push({
                row,
                column,
                player,
                boardSnapshot: cloneBoard(board)
            });
        }

        playSound("drop");
        renderBoard();
        appendMoveToHistory(player, row, column);
        updateMoveCounter();

        const winnerInfo = getWinner(board);

        /* End round if a winning line is found */
        if (winnerInfo.hasWinner) {
            gameOver = true;
            highlightWinningCells(winnerInfo.cells);
            handleWin(player);
            return true;
        }

        /* End round if the board is full with no winner */
        if (isBoardFull(board)) {
            gameOver = true;
            handleDraw();
            return true;
        }

        /* Switch active player and refresh the UI */
        currentPlayer = player === PLAYER_ONE ? PLAYER_TWO : PLAYER_ONE;
        updateAllUI();
        updateAIHints();
        return true;
    }

    /* Queues the AI move after a small delay for better UX */
    function scheduleAIMove() {
        isAIThinking = true;
        updateAllUI();
        showMessage("AI is thinking about the best move...");

        const delay = getAIDelay();

        window.setTimeout(() => {
            const aiColumn = chooseAIMove(board, difficultySelect.value);

            isAIThinking = false;

            if (!gameOver && currentPlayer === PLAYER_TWO && aiColumn !== -1) {
                makeMove(aiColumn, PLAYER_TWO, true);
            }

            updateAllUI();
        }, delay);
    }

    /* Returns the AI delay based on selected difficulty */
    function getAIDelay() {
        const difficulty = difficultySelect.value;
        switch (difficulty) {
            case "easy":
                return 450;
            case "medium":
                return 650;
            case "hard":
                return 850;
            case "expert":
                return 950;
            default:
                return 650;
        }
    }

    /* Starts a fresh round while preserving total scores */
    function startNewGame() {
        createEmptyBoard();
        clearBoardHighlights();
        clearHistoryList();
        hideWinnerModal();
        updateAllUI();
        renderBoard();
        showMessage("New game started. Player 1 begins.");
        updateAIHints();
    }

    /* Resets the scoreboard totals */
    function resetScores() {
        scores.player1 = 0;
        scores.player2 = 0;
        scores.draws = 0;
        updateScoreUI();
        showMessage("Scores have been reset.");
    }

    /* Undoes the previous move(s):
       - PvP: undo one move
       - AI mode: undo player + AI move together when possible */
    function undoMove() {
        if (moveHistory.length === 0) {
            showMessage("No moves to undo.");
            return;
        }

        if (modeSelect.value === "ai") {
            if (moveHistory.length >= 2) {
                moveHistory.pop();
                moveHistory.pop();
            } else {
                moveHistory.pop();
            }
        } else {
            moveHistory.pop();
        }

        recreateBoardFromHistory();
        gameOver = false;
        isAIThinking = false;
        hideWinnerModal();
        clearBoardHighlights();
        rebuildHistoryPanel();
        updateAllUI();
        renderBoard();
        showMessage("Move undone.");
        updateAIHints();
    }

    /* Rebuilds the board state from move history after an undo */
    function recreateBoardFromHistory() {
        board = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));

        for (const move of moveHistory) {
            board[move.row][move.column] = move.player;
        }

        if (moveHistory.length === 0) {
            currentPlayer = PLAYER_ONE;
        } else {
            const lastPlayer = moveHistory[moveHistory.length - 1].player;
            currentPlayer = lastPlayer === PLAYER_ONE ? PLAYER_TWO : PLAYER_ONE;
        }
    }

    /* =========================
       RENDERING
       ========================= */

    /* Paints the current board state into the DOM */
    function renderBoard() {
        clearBoardHighlights();

        for (let row = 0; row < ROWS; row += 1) {
            for (let col = 0; col < COLS; col += 1) {
                const cellIndex = row * COLS + col;
                const cell = cells[cellIndex];
                if (!cell) continue;

                cell.className = "cell";

                const value = board[row][col];
                if (value === PLAYER_ONE) {
                    cell.classList.add("red");
                } else if (value === PLAYER_TWO) {
                    cell.classList.add("yellow");
                }
            }
        }
    }

    /* Refreshes all major UI areas after state changes */
    function updateAllUI() {
        syncLabels();
        updateTurnUI();
        updateScoreUI();
        updateMoveCounter();
        updateButtonState();
    }

    /* Syncs labels that depend on mode and difficulty */
    function syncLabels() {
        const modeText = modeSelect.value === "ai" ? "Player vs AI" : "Player vs Player";
        const difficultyText = capitalize(difficultySelect.value);

        if (gameModeLabel) gameModeLabel.textContent = modeText;
        if (difficultyLabel) difficultyLabel.textContent = difficultyText;
        if (player2Title) player2Title.textContent = modeSelect.value === "ai" ? "AI" : "Player 2";
    }

    /* Updates turn, status, and AI-thinking indicators */
    function updateTurnUI() {
        const playerName = getCurrentPlayerName();
        const statusText = gameOver
            ? "Game finished"
            : isAIThinking
                ? "AI calculating move"
                : "In progress";

        if (turnLabel) turnLabel.textContent = playerName;
        if (statusLabel) statusLabel.textContent = statusText;
        if (currentPlayerText) currentPlayerText.textContent = `${playerName} Turn`;
        if (aiThinkingLabel) aiThinkingLabel.textContent = isAIThinking ? "Yes" : "No";
    }

    /* Updates the score panel */
    function updateScoreUI() {
        if (player1ScoreElement) player1ScoreElement.textContent = String(scores.player1);
        if (player2ScoreElement) player2ScoreElement.textContent = String(scores.player2);
        if (drawScoreElement) drawScoreElement.textContent = String(scores.draws);
    }

    /* Updates the visible move counter */
    function updateMoveCounter() {
        if (moveCounter) {
            moveCounter.textContent = String(moveHistory.length);
        }
    }

    /* Enables or disables controls based on current state */
    function updateButtonState() {
        const columnButtons = document.querySelectorAll(".column-btn");
        columnButtons.forEach((button, col) => {
            button.disabled = gameOver || isAIThinking || !isValidMove(board, col);
            button.style.opacity = button.disabled ? "0.4" : "1";
            button.style.cursor = button.disabled ? "not-allowed" : "pointer";
        });

        if (undoBtn) {
            undoBtn.disabled = moveHistory.length === 0 || isAIThinking;
            undoBtn.style.opacity = undoBtn.disabled ? "0.5" : "1";
        }
    }

    /* Displays a status message under the board */
    function showMessage(message) {
        if (boardMessage) {
            boardMessage.textContent = message;
        }
    }

    /* Adds the latest move to the history panel */
    function appendMoveToHistory(player, row, col) {
        if (!historyList) return;

        const moveNumber = moveHistory.length;
        if (moveNumber === 1) {
            historyList.innerHTML = "";
        }

        const item = document.createElement("div");
        item.className = "history-item";
        item.style.padding = "0.45rem 0.2rem";
        item.style.borderBottom = "1px solid rgba(255,255,255,0.06)";
        item.textContent = `#${moveNumber} - ${getPlayerName(player)} dropped in column ${col + 1}, row ${ROWS - row}`;

        historyList.prepend(item);
    }

    /* Resets the history panel to its empty state */
    function clearHistoryList() {
        if (!historyList) return;
        historyList.innerHTML = `<div class="history-empty">No moves yet.</div>`;
    }

    /* Reconstructs the history panel from stored move history */
    function rebuildHistoryPanel() {
        if (!historyList) return;

        if (moveHistory.length === 0) {
            clearHistoryList();
            return;
        }

        historyList.innerHTML = "";

        for (let i = moveHistory.length - 1; i >= 0; i -= 1) {
            const move = moveHistory[i];
            const item = document.createElement("div");
            item.className = "history-item";
            item.style.padding = "0.45rem 0.2rem";
            item.style.borderBottom = "1px solid rgba(255,255,255,0.06)";
            item.textContent = `#${i + 1} - ${getPlayerName(move.player)} dropped in column ${move.column + 1}, row ${ROWS - move.row}`;
            historyList.appendChild(item);
        }
    }

    /* Opens the winner / result modal */
    function showWinnerModal(title, text) {
        if (!winnerModal) return;
        winnerTitle.textContent = title;
        winnerText.textContent = text;
        winnerModal.classList.remove("hidden");
    }

    /* Hides the winner / result modal */
    function hideWinnerModal() {
        if (!winnerModal) return;
        winnerModal.classList.add("hidden");
    }

    /* =========================
       WIN / DRAW
       ========================= */

    /* Handles win state, score updates, sound, and messaging */
    function handleWin(player) {
        const winnerName = getPlayerName(player);

        if (player === PLAYER_ONE) {
            scores.player1 += 1;
            playSound("win");
        } else {
            scores.player2 += 1;
            if (modeSelect.value === "ai") {
                playSound("lose");
            } else {
                playSound("win");
            }
        }

        updateScoreUI();
        updateAllUI();

        showMessage(`${winnerName} wins the game!`);
        showWinnerModal("Victory!", `${winnerName} connected 4 and won the match.`);
    }

    /* Handles draw state and result feedback */
    function handleDraw() {
        scores.draws += 1;
        updateScoreUI();
        updateAllUI();
        playSound("click");
        showMessage("The board is full. It's a draw.");
        showWinnerModal("Draw", "No more moves left. The match ends in a draw.");
    }

    /* Highlights the winning 4-cell line on the board */
    function highlightWinningCells(cellsToHighlight) {
        if (!cellsToHighlight || cellsToHighlight.length === 0) return;

        for (const { row, col } of cellsToHighlight) {
            const index = row * COLS + col;
            const cell = cells[index];
            if (!cell) continue;

            cell.style.boxShadow = "0 0 22px rgba(255,255,255,0.75), inset 0 0 0 4px rgba(255,255,255,0.35)";
            cell.style.transform = "scale(1.05)";
        }
    }

    /* Clears any previous highlight styles from the board */
    function clearBoardHighlights() {
        for (const cell of cells) {
            cell.style.boxShadow = "";
            cell.style.transform = "";
        }
    }

    /* =========================
       AI ANALYSIS PANEL
       ========================= */

    /* Updates the AI analysis side panel */
    function updateAIHints() {
        if (modeSelect.value !== "ai") {
            if (bestMovePrediction) bestMovePrediction.textContent = "Disabled in PvP";
            if (boardEvaluation) boardEvaluation.textContent = "0";
            if (threatLevel) threatLevel.textContent = "Normal";
            return;
        }

        const prediction = findBestMoveForDisplay(board, difficultySelect.value);
        const score = evaluatePosition(board, PLAYER_TWO);
        const threat = computeThreatLevel(board);

        if (bestMovePrediction) {
            bestMovePrediction.textContent =
                prediction === -1 ? "No move" : `Column ${prediction + 1}`;
        }

        if (boardEvaluation) {
            boardEvaluation.textContent = String(score);
        }

        if (threatLevel) {
            threatLevel.textContent = threat;
        }
    }

    /* Finds the best move for display purposes without playing it */
    function findBestMoveForDisplay(currentBoard, difficulty) {
        if (isBoardFull(currentBoard) || getWinner(currentBoard).hasWinner) {
            return -1;
        }

        const validMoves = getValidMoves(currentBoard);
        if (validMoves.length === 0) {
            return -1;
        }

        const depth = AI_DEPTH_MAP[difficulty] || 4;
        const result = minimax(currentBoard, depth, -Infinity, Infinity, true);

        return typeof result.column === "number" ? result.column : validMoves[0];
    }

    /* Computes a simplified threat summary for the current board */
    function computeThreatLevel(currentBoard) {
        const playerWinningMoves = countImmediateWinningMoves(currentBoard, PLAYER_ONE);
        const aiWinningMoves = countImmediateWinningMoves(currentBoard, PLAYER_TWO);

        if (playerWinningMoves >= 2) return "Critical";
        if (playerWinningMoves === 1) return "High";
        if (aiWinningMoves >= 1) return "Aggressive";
        return "Low";
    }

    /* =========================
       AI MOVE SELECTION
       ========================= */

    /* Selects the AI move based on randomness, tactics, and minimax */
    function chooseAIMove(currentBoard, difficulty) {
        const validMoves = getValidMoves(currentBoard);
        if (validMoves.length === 0) return -1;

        const randomness = AI_RANDOMNESS[difficulty] ?? 0.1;

        /* Easier difficulties occasionally choose random valid moves */
        if (Math.random() < randomness) {
            return validMoves[Math.floor(Math.random() * validMoves.length)];
        }

        /* Take immediate win if available */
        const immediateWin = findImmediateWinningMove(currentBoard, PLAYER_TWO);
        if (immediateWin !== -1) return immediateWin;

        /* Otherwise block opponent's immediate win */
        const immediateBlock = findImmediateWinningMove(currentBoard, PLAYER_ONE);
        if (immediateBlock !== -1) return immediateBlock;

        /* Fall back to minimax search */
        const depth = AI_DEPTH_MAP[difficulty] || 4;
        const result = minimax(currentBoard, depth, -Infinity, Infinity, true);

        return typeof result.column === "number" ? result.column : validMoves[0];
    }

    /* Minimax with alpha-beta pruning */
    function minimax(state, depth, alpha, beta, maximizingPlayer) {
        const validMoves = getValidMoves(state);
        const terminal = isTerminalNode(state);

        /* Base case: depth limit or terminal state */
        if (depth === 0 || terminal) {
            if (terminal) {
                if (winningMove(state, PLAYER_TWO)) {
                    return { column: null, score: 100000000 };
                }
                if (winningMove(state, PLAYER_ONE)) {
                    return { column: null, score: -100000000 };
                }
                return { column: null, score: 0 };
            }

            return { column: null, score: evaluatePosition(state, PLAYER_TWO) };
        }

        const orderedMoves = orderMovesByPreference(validMoves);

        /* Maximizing branch: AI */
        if (maximizingPlayer) {
            let value = -Infinity;
            let bestColumn = orderedMoves[0];

            for (const col of orderedMoves) {
                const row = getNextOpenRow(state, col);
                const newBoard = cloneBoard(state);
                newBoard[row][col] = PLAYER_TWO;

                const newScore = minimax(newBoard, depth - 1, alpha, beta, false).score;

                if (newScore > value) {
                    value = newScore;
                    bestColumn = col;
                }

                alpha = Math.max(alpha, value);
                if (alpha >= beta) break;
            }

            return { column: bestColumn, score: value };
        }

        /* Minimizing branch: human opponent */
        let value = Infinity;
        let bestColumn = orderedMoves[0];

        for (const col of orderedMoves) {
            const row = getNextOpenRow(state, col);
            const newBoard = cloneBoard(state);
            newBoard[row][col] = PLAYER_ONE;

            const newScore = minimax(newBoard, depth - 1, alpha, beta, true).score;

            if (newScore < value) {
                value = newScore;
                bestColumn = col;
            }

            beta = Math.min(beta, value);
            if (alpha >= beta) break;
        }

        return { column: bestColumn, score: value };
    }

    /* Prioritizes center columns, which are generally stronger in Connect 4 */
    function orderMovesByPreference(moves) {
        const center = Math.floor(COLS / 2);
        return [...moves].sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
    }

    /* =========================
       BOARD EVALUATION
       ========================= */

    /* Heuristic evaluation of the current board position */
    function evaluatePosition(state, player) {
        let score = 0;
        const opponent = player === PLAYER_ONE ? PLAYER_TWO : PLAYER_ONE;

        /* Favor center-column control */
        const centerColumn = Math.floor(COLS / 2);
        let centerCount = 0;
        for (let row = 0; row < ROWS; row += 1) {
            if (state[row][centerColumn] === player) centerCount += 1;
        }
        score += centerCount * 6;

        /* Evaluate horizontal windows */
        for (let row = 0; row < ROWS; row += 1) {
            for (let col = 0; col < COLS - 3; col += 1) {
                const window = [
                    state[row][col],
                    state[row][col + 1],
                    state[row][col + 2],
                    state[row][col + 3]
                ];
                score += evaluateWindow(window, player, opponent);
            }
        }

        /* Evaluate vertical windows */
        for (let col = 0; col < COLS; col += 1) {
            for (let row = 0; row < ROWS - 3; row += 1) {
                const window = [
                    state[row][col],
                    state[row + 1][col],
                    state[row + 2][col],
                    state[row + 3][col]
                ];
                score += evaluateWindow(window, player, opponent);
            }
        }

        /* Evaluate downward-right diagonals */
        for (let row = 0; row < ROWS - 3; row += 1) {
            for (let col = 0; col < COLS - 3; col += 1) {
                const window = [
                    state[row][col],
                    state[row + 1][col + 1],
                    state[row + 2][col + 2],
                    state[row + 3][col + 3]
                ];
                score += evaluateWindow(window, player, opponent);
            }
        }

        /* Evaluate upward-right diagonals */
        for (let row = 3; row < ROWS; row += 1) {
            for (let col = 0; col < COLS - 3; col += 1) {
                const window = [
                    state[row][col],
                    state[row - 1][col + 1],
                    state[row - 2][col + 2],
                    state[row - 3][col + 3]
                ];
                score += evaluateWindow(window, player, opponent);
            }
        }

        return score;
    }

    /* Scores a 4-cell window for heuristic evaluation */
    function evaluateWindow(window, player, opponent) {
        let score = 0;

        const playerCount = countOccurrences(window, player);
        const opponentCount = countOccurrences(window, opponent);
        const emptyCount = countOccurrences(window, EMPTY);

        if (playerCount === 4) score += 10000;
        else if (playerCount === 3 && emptyCount === 1) score += 120;
        else if (playerCount === 2 && emptyCount === 2) score += 18;
        else if (playerCount === 1 && emptyCount === 3) score += 3;

        if (opponentCount === 3 && emptyCount === 1) score -= 110;
        if (opponentCount === 2 && emptyCount === 2) score -= 14;
        if (opponentCount === 4) score -= 10000;

        return score;
    }

    /* Counts the number of times a value appears in an array */
    function countOccurrences(array, value) {
        let count = 0;
        for (const item of array) {
            if (item === value) count += 1;
        }
        return count;
    }

    /* =========================
       WINNING / VALIDITY
       ========================= */

    /* Scans the board for a winning sequence and returns its details */
    function getWinner(state) {
        /* Horizontal */
        for (let row = 0; row < ROWS; row += 1) {
            for (let col = 0; col < COLS - 3; col += 1) {
                const player = state[row][col];
                if (
                    player !== EMPTY &&
                    player === state[row][col + 1] &&
                    player === state[row][col + 2] &&
                    player === state[row][col + 3]
                ) {
                    return {
                        hasWinner: true,
                        player,
                        cells: [
                            { row, col },
                            { row, col: col + 1 },
                            { row, col: col + 2 },
                            { row, col: col + 3 }
                        ]
                    };
                }
            }
        }

        /* Vertical */
        for (let row = 0; row < ROWS - 3; row += 1) {
            for (let col = 0; col < COLS; col += 1) {
                const player = state[row][col];
                if (
                    player !== EMPTY &&
                    player === state[row + 1][col] &&
                    player === state[row + 2][col] &&
                    player === state[row + 3][col]
                ) {
                    return {
                        hasWinner: true,
                        player,
                        cells: [
                            { row, col },
                            { row: row + 1, col },
                            { row: row + 2, col },
                            { row: row + 3, col }
                        ]
                    };
                }
            }
        }

        /* Diagonal down-right */
        for (let row = 0; row < ROWS - 3; row += 1) {
            for (let col = 0; col < COLS - 3; col += 1) {
                const player = state[row][col];
                if (
                    player !== EMPTY &&
                    player === state[row + 1][col + 1] &&
                    player === state[row + 2][col + 2] &&
                    player === state[row + 3][col + 3]
                ) {
                    return {
                        hasWinner: true,
                        player,
                        cells: [
                            { row, col },
                            { row: row + 1, col: col + 1 },
                            { row: row + 2, col: col + 2 },
                            { row: row + 3, col: col + 3 }
                        ]
                    };
                }
            }
        }

        /* Diagonal up-right */
        for (let row = 3; row < ROWS; row += 1) {
            for (let col = 0; col < COLS - 3; col += 1) {
                const player = state[row][col];
                if (
                    player !== EMPTY &&
                    player === state[row - 1][col + 1] &&
                    player === state[row - 2][col + 2] &&
                    player === state[row - 3][col + 3]
                ) {
                    return {
                        hasWinner: true,
                        player,
                        cells: [
                            { row, col },
                            { row: row - 1, col: col + 1 },
                            { row: row - 2, col: col + 2 },
                            { row: row - 3, col: col + 3 }
                        ]
                    };
                }
            }
        }

        return {
            hasWinner: false,
            player: EMPTY,
            cells: []
        };
    }

    /* Returns true if the specified player has a winning board */
    function winningMove(state, player) {
        return getWinner(state).hasWinner && getWinner(state).player === player;
    }

    /* Returns true if the game is over due to win or full board */
    function isTerminalNode(state) {
        return winningMove(state, PLAYER_ONE) || winningMove(state, PLAYER_TWO) || isBoardFull(state);
    }

    /* Returns true if there are no valid moves left */
    function isBoardFull(state) {
        return getValidMoves(state).length === 0;
    }

    /* Checks whether a column is playable */
    function isValidMove(state, column) {
        return column >= 0 && column < COLS && state[0][column] === EMPTY;
    }

    /* Returns all currently valid columns */
    function getValidMoves(state) {
        const moves = [];
        for (let col = 0; col < COLS; col += 1) {
            if (isValidMove(state, col)) {
                moves.push(col);
            }
        }
        return moves;
    }

    /* Finds the lowest empty row in a column */
    function getNextOpenRow(state, column) {
        for (let row = ROWS - 1; row >= 0; row -= 1) {
            if (state[row][column] === EMPTY) {
                return row;
            }
        }
        return -1;
    }

    /* Finds a one-move winning column for the specified player */
    function findImmediateWinningMove(state, player) {
        const validMoves = getValidMoves(state);

        for (const col of validMoves) {
            const row = getNextOpenRow(state, col);
            const tempBoard = cloneBoard(state);
            tempBoard[row][col] = player;

            if (winningMove(tempBoard, player)) {
                return col;
            }
        }

        return -1;
    }

    /* Counts how many immediate winning moves a player currently has */
    function countImmediateWinningMoves(state, player) {
        let count = 0;
        const validMoves = getValidMoves(state);

        for (const col of validMoves) {
            const row = getNextOpenRow(state, col);
            const tempBoard = cloneBoard(state);
            tempBoard[row][col] = player;
            if (winningMove(tempBoard, player)) {
                count += 1;
            }
        }

        return count;
    }

    /* =========================
       HELPERS
       ========================= */

    /* Deep-clones the board matrix */
    function cloneBoard(state) {
        return state.map(row => [...row]);
    }

    /* Returns the display name of the current player */
    function getCurrentPlayerName() {
        if (currentPlayer === PLAYER_ONE) return "Player 1";
        return modeSelect.value === "ai" ? "AI" : "Player 2";
    }

    /* Returns the display name for a specific player ID */
    function getPlayerName(player) {
        if (player === PLAYER_ONE) return "Player 1";
        return modeSelect.value === "ai" ? "AI" : "Player 2";
    }

    /* Capitalizes the first letter of a string value */
    function capitalize(value) {
        return value.charAt(0).toUpperCase() + value.slice(1);
    }

    /* =========================
       START
       ========================= */

    /* Bootstraps the game */
    init();
})();