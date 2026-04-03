/* =========================================================
   NeuroPlay Arcade - Pop It
   Correct one-row misère version with AI

   Purpose:
   - Implements the full Pop It game logic
   - Enforces one-row-per-turn misère rules
   - Supports PvP and AI modes with difficulty-based move selection
   - Manages rendering, scoring, analysis, history, and modal feedback
   ========================================================= */

(() => {
    "use strict";

    /* =========================
       DOM REFERENCES
       ========================= */

    /* Main board and core control buttons */
    const boardElement = document.getElementById("popitBoard");
    const startBtn = document.getElementById("startPopitBtn");
    const resetBtn = document.getElementById("resetPopitBtn");
    const endTurnBtn = document.getElementById("endTurnBtn");

    /* Game settings controls */
    const modeSelect = document.getElementById("popitModeSelect");
    const rowCountSelect = document.getElementById("rowCountSelect");
    const aiLevelSelect = document.getElementById("aiLevelSelect");

    /* Status and metadata labels */
    const popitModeLabel = document.getElementById("popitModeLabel");
    const popitBoardLabel = document.getElementById("popitBoardLabel");
    const turnLabel = document.getElementById("turnLabel");
    const popitStatusLabel = document.getElementById("popitStatusLabel");

    /* Turn-specific info panel */
    const selectedRowLabel = document.getElementById("selectedRowLabel");
    const turnPopCount = document.getElementById("turnPopCount");
    const remainingBubbleCount = document.getElementById("remainingBubbleCount");
    const aiThinkingLabel = document.getElementById("aiThinkingLabel");

    /* Scoreboard */
    const playerScore = document.getElementById("playerScore");
    const opponentScore = document.getElementById("opponentScore");
    const roundCount = document.getElementById("roundCount");
    const playerTwoName = document.getElementById("playerTwoName");

    /* Strategy / analysis panel */
    const recommendedMove = document.getElementById("recommendedMove");
    const positionState = document.getElementById("positionState");
    const popitMessage = document.getElementById("popitMessage");

    /* Move history panel */
    const historyList = document.getElementById("popitHistory");

    /* End-of-round modal */
    const modal = document.getElementById("popitModal");
    const modalTitle = document.getElementById("popitModalTitle");
    const modalText = document.getElementById("popitModalText");
    const playAgainBtn = document.getElementById("playPopitAgainBtn");
    const closeModalBtn = document.getElementById("closePopitModalBtn");

    /* =========================
       GAME STATE
       ========================= */

    /* rows:
       Each row is an array of booleans
       true  = bubble still available
       false = bubble already popped */
    let rows = [];

    /* Number of rows currently selected in the configuration */
    let rowCount = 5;

    /* Current active player: 1 = Player, 2 = Opponent/AI */
    let currentPlayer = 1;

    /* Indicates whether a round is currently active */
    let gameActive = false;

    /* Prevents user input while AI is calculating a move */
    let aiThinking = false;

    /* Row selected for the current turn (-1 means none selected yet) */
    let selectedRow = -1;

    /* Number of bubbles popped in the current turn */
    let poppedThisTurn = 0;

    /* Bubble indexes popped during the current turn
       Used to enforce contiguous popping within one row */
    let turnPoppedIndexes = [];

    /* Persistent scoreboard across rounds */
    let scores = {
        player: 0,
        opponent: 0,
        rounds: 0
    };

    /* =========================
       INITIALIZATION
       ========================= */

    /* Bootstraps the game on page load */
    function init() {
        attachEvents();
        buildInitialBoard();
        updateAllUI();
        renderBoard();
        showMessage("Press Start to begin. Choose one row and pop bubbles from that row only.");
    }

    /* =========================
       EVENT BINDING
       ========================= */

    /* Connects UI controls to game actions */
    function attachEvents() {
        startBtn.addEventListener("click", startGame);
        resetBtn.addEventListener("click", resetBoard);
        endTurnBtn.addEventListener("click", endTurn);

        playAgainBtn.addEventListener("click", () => {
            hideModal();
            startGame();
        });

        closeModalBtn.addEventListener("click", hideModal);

        modeSelect.addEventListener("change", () => {
            syncLabels();
            resetBoard();
        });

        rowCountSelect.addEventListener("change", () => {
            buildInitialBoard();
            resetTurnState();
            renderBoard();
            updateAllUI();
            showMessage("Board size changed. Press Start to play.");
        });

        aiLevelSelect.addEventListener("change", updateAnalysisPanel);
    }

    /* =========================
       BOARD SETUP
       ========================= */

    /* Creates the initial board structure.
       Each row starts with increasing length:
       Row 1 = 3 bubbles, Row 2 = 4 bubbles, etc. */
    function buildInitialBoard() {
        rowCount = Number(rowCountSelect.value);
        rows = [];

        for (let i = 0; i < rowCount; i += 1) {
            rows.push(Array(i + 3).fill(true));
        }

        currentPlayer = 1;
        gameActive = false;
        aiThinking = false;
        resetTurnState();
        clearHistory();
    }

    /* Starts a fresh playable round */
    function startGame() {
        buildInitialBoard();
        gameActive = true;
        syncLabels();
        renderBoard();
        updateAllUI();
        updateAnalysisPanel();
        showMessage(`${getPlayerName(currentPlayer)} starts. Select one row and pop bubbles.`);
    }

    /* Resets the board without changing score totals */
    function resetBoard() {
        buildInitialBoard();
        renderBoard();
        updateAllUI();
        updateAnalysisPanel();
        showMessage("Board reset. Press Start to play.");
    }

    /* Clears all turn-specific state values */
    function resetTurnState() {
        selectedRow = -1;
        poppedThisTurn = 0;
        turnPoppedIndexes = [];
    }

    /* =========================
       BOARD RENDERING
       ========================= */

    /* Rebuilds the entire visible board based on current state */
    function renderBoard() {
        boardElement.innerHTML = "";

        rows.forEach((row, rowIndex) => {
            const rowElement = document.createElement("div");
            rowElement.className = "popit-row";

            const label = document.createElement("div");
            label.className = "row-label";
            label.textContent = `Row ${rowIndex + 1}`;

            const bubblesWrap = document.createElement("div");
            bubblesWrap.className = "row-bubbles";

            row.forEach((isAlive, bubbleIndex) => {
                const bubble = document.createElement("button");
                bubble.className = `pop-bubble color-${(rowIndex % 6) + 1}`;
                bubble.dataset.row = String(rowIndex);
                bubble.dataset.index = String(bubbleIndex);
                bubble.type = "button";

                /* Already-popped bubbles are visually disabled */
                if (!isAlive) {
                    bubble.classList.add("popped");
                    bubble.disabled = true;
                } else {
                    const valid = isBubbleSelectable(rowIndex, bubbleIndex);

                    /* Highlight bubbles in the currently selected row */
                    if (selectedRow === rowIndex) {
                        bubble.classList.add("selected-row");
                    }

                    /* Mark valid options for the current turn */
                    if (valid) {
                        bubble.classList.add("valid-turn");
                    } else if (gameActive) {
                        bubble.classList.add("blocked");
                    }

                    bubble.disabled = !gameActive || aiThinking || !valid;
                    bubble.addEventListener("click", () => popBubble(rowIndex, bubbleIndex));
                }

                bubblesWrap.appendChild(bubble);
            });

            rowElement.appendChild(label);
            rowElement.appendChild(bubblesWrap);
            boardElement.appendChild(rowElement);
        });
    }

    /* =========================
       MOVE VALIDATION
       ========================= */

    /* Determines whether a bubble can legally be popped this turn */
    function isBubbleSelectable(rowIndex, bubbleIndex) {
        if (!gameActive || aiThinking) return false;
        if (!rows[rowIndex][bubbleIndex]) return false;

        /* Only one row may be used per turn */
        if (selectedRow !== -1 && selectedRow !== rowIndex) {
            return false;
        }

        const aliveIndexes = getAliveIndexes(rowIndex);
        if (aliveIndexes.length === 0) return false;

        /* If no row is selected yet, any alive bubble can begin the turn */
        if (selectedRow === -1) {
            return true;
        }

        /* Ensure all popped bubbles this turn remain contiguous */
        const newChosen = [...turnPoppedIndexes, bubbleIndex].sort((a, b) => a - b);

        for (let i = 1; i < newChosen.length; i += 1) {
            if (newChosen[i] !== newChosen[i - 1] + 1) {
                return false;
            }
        }

        /* Prevent gaps caused by already-popped bubbles inside the chosen segment */
        for (let i = newChosen[0]; i <= newChosen[newChosen.length - 1]; i += 1) {
            if (!rows[rowIndex][i] && !turnPoppedIndexes.includes(i)) {
                return false;
            }
        }

        return true;
    }

    /* Returns the indexes of all currently alive bubbles in a row */
    function getAliveIndexes(rowIndex) {
        const result = [];
        rows[rowIndex].forEach((alive, index) => {
            if (alive) result.push(index);
        });
        return result;
    }

    /* =========================
       PLAYER TURN LOGIC
       ========================= */

    /* Pops a single bubble selected by the current player */
    function popBubble(rowIndex, bubbleIndex) {
        if (!isBubbleSelectable(rowIndex, bubbleIndex)) return;

        /* Lock the turn to the first selected row */
        if (selectedRow === -1) {
            selectedRow = rowIndex;
        }

        rows[rowIndex][bubbleIndex] = false;
        turnPoppedIndexes.push(bubbleIndex);
        turnPoppedIndexes.sort((a, b) => a - b);
        poppedThisTurn += 1;

        if (window.playSound) window.playSound("pop");

        renderBoard();
        updateAllUI();
        updateAnalysisPanel();
        showMessage(`${getPlayerName(currentPlayer)} popped bubble ${bubbleIndex + 1} from row ${rowIndex + 1}.`);

        /* Misère rule: the player who pops the last bubble loses */
        if (countRemainingBubbles() === 0) {
            handleLossByLastPop(currentPlayer);
        }
    }

    /* Ends the current turn and passes control to the other player */
    function endTurn() {
        if (!gameActive || aiThinking) return;

        if (poppedThisTurn === 0) {
            showMessage("You must pop at least one bubble before ending your turn.");
            return;
        }

        appendHistory(`${getPlayerName(currentPlayer)} popped ${poppedThisTurn} bubble${poppedThisTurn > 1 ? "s" : ""} from row ${selectedRow + 1}.`);

        currentPlayer = currentPlayer === 1 ? 2 : 1;
        resetTurnState();
        renderBoard();
        updateAllUI();
        updateAnalysisPanel();

        if (!gameActive) return;

        if (modeSelect.value === "ai" && currentPlayer === 2) {
            runAITurn();
        } else {
            showMessage(`${getPlayerName(currentPlayer)} turn.`);
        }
    }

    /* =========================
       AI TURN LOGIC
       ========================= */

    /* Runs the AI turn after a short delay */
    function runAITurn() {
        aiThinking = true;
        updateAllUI();
        showMessage("AI is thinking...");

        setTimeout(() => {
            const move = chooseAIMove(rows, aiLevelSelect.value);
            aiThinking = false;

            if (!move || !gameActive) {
                updateAllUI();
                return;
            }

            selectedRow = move.row;
            poppedThisTurn = 0;
            turnPoppedIndexes = [];

            /* Apply the AI-selected contiguous move */
            move.indexes.forEach(index => {
                rows[move.row][index] = false;
                turnPoppedIndexes.push(index);
                poppedThisTurn += 1;
            });

            if (window.playSound) window.playSound("pop");

            renderBoard();
            updateAllUI();
            showMessage(`AI popped ${move.indexes.length} bubble${move.indexes.length > 1 ? "s" : ""} from row ${move.row + 1}.`);

            if (countRemainingBubbles() === 0) {
                handleLossByLastPop(2);
                return;
            }

            appendHistory(`AI popped ${move.indexes.length} bubble${move.indexes.length > 1 ? "s" : ""} from row ${move.row + 1}.`);

            currentPlayer = 1;
            resetTurnState();
            renderBoard();
            updateAllUI();
            updateAnalysisPanel();
            showMessage("Player turn.");
        }, 500);
    }

    /* Selects the AI move based on difficulty and board evaluation */
    function chooseAIMove(stateRows, level) {
        const moves = getAllValidTurnMoves(stateRows);
        if (moves.length === 0) return null;

        const evaluated = moves.map(move => {
            const next = cloneRows(stateRows);

            move.indexes.forEach(i => {
                next[move.row][i] = false;
            });

            const remaining = countRemaining(next);

            return {
                ...move,
                remaining,
                losesImmediately: remaining === 0,
                givesOpponentWin: remaining === 1,
                nim: computeNimValue(next)
            };
        });

        const safeMoves = evaluated.filter(move => !move.losesImmediately);
        const winningMoves = safeMoves.filter(move => move.givesOpponentWin);
        const strategicMoves = safeMoves.filter(move => move.nim === 0);

        /* Easy AI:
           mostly safe, but intentionally less optimal */
        if (level === "easy") {
            const easyPool = safeMoves.length > 0 ? safeMoves : evaluated;
            return easyPool[Math.floor(Math.random() * easyPool.length)];
        }

        /* Medium AI:
           sometimes prioritizes winning or strong strategic positions */
        if (level === "medium") {
            if (winningMoves.length > 0 && Math.random() < 0.75) {
                return winningMoves[Math.floor(Math.random() * winningMoves.length)];
            }

            if (strategicMoves.length > 0 && Math.random() < 0.75) {
                strategicMoves.sort((a, b) => {
                    if (a.remaining !== b.remaining) return a.remaining - b.remaining;
                    return a.indexes.length - b.indexes.length;
                });
                return strategicMoves[0];
            }

            const mediumPool = safeMoves.length > 0 ? safeMoves : evaluated;
            mediumPool.sort((a, b) => {
                if (a.remaining !== b.remaining) return a.remaining - b.remaining;
                return a.indexes.length - b.indexes.length;
            });
            return mediumPool[0];
        }

        /* Hard/Expert behavior:
           prioritize immediate winning setups, then strategic nim positions,
           then safest remaining move */
        if (winningMoves.length > 0) {
            winningMoves.sort((a, b) => {
                if (a.remaining !== b.remaining) return a.remaining - b.remaining;
                return a.indexes.length - b.indexes.length;
            });
            return winningMoves[0];
        }

        if (strategicMoves.length > 0) {
            strategicMoves.sort((a, b) => {
                if (a.remaining !== b.remaining) return a.remaining - b.remaining;
                return a.indexes.length - b.indexes.length;
            });
            return strategicMoves[0];
        }

        if (safeMoves.length > 0) {
            safeMoves.sort((a, b) => {
                if (a.remaining !== b.remaining) return a.remaining - b.remaining;
                return a.indexes.length - b.indexes.length;
            });
            return safeMoves[0];
        }

        return evaluated[0];
    }

    /* =========================
       MOVE GENERATION
       ========================= */

    /* Generates every valid contiguous move from every alive segment */
    function getAllValidTurnMoves(stateRows) {
        const moves = [];

        stateRows.forEach((row, rowIndex) => {
            const segments = getAliveSegments(row);

            segments.forEach(segment => {
                for (let start = segment.start; start <= segment.end; start += 1) {
                    for (let end = start; end <= segment.end; end += 1) {
                        const indexes = [];
                        for (let i = start; i <= end; i += 1) {
                            indexes.push(i);
                        }
                        moves.push({ row: rowIndex, indexes });
                    }
                }
            });
        });

        return moves;
    }

    /* Returns contiguous alive segments for a given row */
    function getAliveSegments(row) {
        const segments = [];
        let start = -1;

        for (let i = 0; i < row.length; i += 1) {
            if (row[i] && start === -1) {
                start = i;
            }

            const endsSegment = start !== -1 && (!row[i] || i === row.length - 1);
            if (endsSegment) {
                const end = row[i] ? i : i - 1;
                segments.push({ start, end });
                start = -1;
            }
        }

        return segments;
    }

    /* Computes the nim-sum of all alive segments
       Used to evaluate winning/losing positions */
    function computeNimValue(stateRows) {
        let value = 0;
        stateRows.forEach(row => {
            getAliveSegments(row).forEach(segment => {
                const length = segment.end - segment.start + 1;
                value ^= length;
            });
        });
        return value;
    }

    /* Deep-clones the board rows */
    function cloneRows(stateRows) {
        return stateRows.map(row => [...row]);
    }

    /* Counts how many bubbles remain alive in any given board state */
    function countRemaining(stateRows) {
        let total = 0;
        stateRows.forEach(row => {
            row.forEach(cell => {
                if (cell) total += 1;
            });
        });
        return total;
    }

    /* Convenience wrapper for the live board */
    function countRemainingBubbles() {
        return countRemaining(rows);
    }

    /* =========================
       END-OF-ROUND HANDLING
       ========================= */

    /* Resolves the round when a player pops the final bubble and loses */
    function handleLossByLastPop(loser) {
        gameActive = false;
        scores.rounds += 1;

        if (loser === 1) {
            scores.opponent += 1;
            if (window.playSound) window.playSound("lose");
            showModal(
                `${getOpponentName()} Wins`,
                `Player popped the final bubble and loses the round.`
            );
            showMessage("Player popped the final bubble and loses.");
        } else {
            scores.player += 1;
            if (window.playSound) window.playSound("win");
            showModal(
                "Player Wins",
                `${getOpponentName()} popped the final bubble and loses the round.`
            );
            showMessage(`${getOpponentName()} popped the final bubble and loses.`);
        }

        appendHistory(`${getPlayerName(loser)} popped the final bubble and lost the round.`);
        resetTurnState();
        renderBoard();
        updateAllUI();
        updateAnalysisPanel();
    }

    /* =========================
       UI UPDATES
       ========================= */

    /* Refreshes all dynamic UI panels */
    function updateAllUI() {
        syncLabels();

        turnLabel.textContent = getPlayerName(currentPlayer);
        popitStatusLabel.textContent = gameActive ? (aiThinking ? "AI thinking" : "In progress") : "Ready";
        selectedRowLabel.textContent = selectedRow === -1 ? "None" : `Row ${selectedRow + 1}`;
        turnPopCount.textContent = String(poppedThisTurn);
        remainingBubbleCount.textContent = String(countRemainingBubbles());
        aiThinkingLabel.textContent = aiThinking ? "Yes" : "No";

        playerScore.textContent = String(scores.player);
        opponentScore.textContent = String(scores.opponent);
        roundCount.textContent = String(scores.rounds);

        endTurnBtn.disabled = !gameActive || aiThinking || poppedThisTurn === 0;
        endTurnBtn.style.opacity = endTurnBtn.disabled ? "0.55" : "1";
    }

    /* Syncs mode / board labels with current settings */
    function syncLabels() {
        const modeText = modeSelect.value === "ai" ? "Player vs AI" : "Player vs Player";
        popitModeLabel.textContent = modeText;
        popitBoardLabel.textContent = `${rowCountSelect.value} Rows`;
        playerTwoName.textContent = modeSelect.value === "ai" ? "AI" : "Player 2";
    }

    /* Updates the strategy helper panel */
    function updateAnalysisPanel() {
        if (!gameActive) {
            recommendedMove.textContent = "Start a game";
            positionState.textContent = "Waiting";
            return;
        }

        const value = computeNimValue(rows);
        positionState.textContent = value === 0 ? "Losing position" : "Winning position";

        const move = chooseAIMove(rows, "hard");
        if (!move) {
            recommendedMove.textContent = "No move";
        } else {
            recommendedMove.textContent = `Row ${move.row + 1}, pop ${move.indexes.length}`;
        }
    }

    /* =========================
       HISTORY / FEEDBACK
       ========================= */

    /* Adds a new entry to the move history panel */
    function appendHistory(text) {
        if (!historyList) return;

        if (historyList.querySelector(".history-empty")) {
            historyList.innerHTML = "";
        }

        const item = document.createElement("div");
        item.className = "history-item";
        item.textContent = text;
        historyList.prepend(item);
    }

    /* Resets the history panel to its default empty state */
    function clearHistory() {
        historyList.innerHTML = `<div class="history-empty">No moves yet.</div>`;
    }

    /* Displays a live message below or beside the board */
    function showMessage(text) {
        popitMessage.textContent = text;
    }

    /* Opens the end-of-round modal */
    function showModal(title, text) {
        modalTitle.textContent = title;
        modalText.textContent = text;
        modal.classList.remove("hidden");
    }

    /* Hides the modal */
    function hideModal() {
        modal.classList.add("hidden");
    }

    /* =========================
       NAME HELPERS
       ========================= */

    /* Returns the display name for the given player */
    function getPlayerName(player = currentPlayer) {
        if (player === 1) return "Player";
        return modeSelect.value === "ai" ? "AI" : "Player 2";
    }

    /* Returns the display name of the opponent */
    function getOpponentName() {
        return modeSelect.value === "ai" ? "AI" : "Player 2";
    }

    /* =========================
       START
       ========================= */

    init();
})();