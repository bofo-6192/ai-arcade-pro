/* =========================================================
   NeuroPlay Arcade - Dots & Boxes (with AI)

   Purpose:
   - Implements full game logic for Dots & Boxes
   - Handles board rendering, user interaction, scoring, and turns
   - Includes simple AI opponent (greedy + random fallback)

   Architecture:
   - Grid-based representation using horizontal/vertical edges + boxes
   - DOM-driven rendering (rebuilds board on each update)
   ========================================================= */

(() => {

    /* =========================
       DOM REFERENCES
       ========================= */

    const board = document.getElementById("dotsBoard");
    const startBtn = document.getElementById("startDots");
    const resetBtn = document.getElementById("resetDots");
    const sizeSelect = document.getElementById("gridSize");
    const modeSelect = document.getElementById("modeDots");

    const p1ScoreEl = document.getElementById("p1Score");
    const p2ScoreEl = document.getElementById("p2Score");
    const turnLabel = document.getElementById("turnLabelDots");
    const msg = document.getElementById("dotsMessage");

    /* =========================
       GAME STATE
       ========================= */

    let size = 5;                 // Grid size (NxN dots)
    let current = 1;              // Current player (1 = Player, 2 = AI)
    let scores = {1:0, 2:0};     // Score tracking
    let gameActive = false;       // Game state flag

    /* Edge and box data structures:
       h = horizontal edges
       v = vertical edges
       boxes = completed boxes ownership */
    let h = [], v = [], boxes = [];

    /* =========================
       INITIALIZATION
       ========================= */

    function init(){
        create();
        startBtn.onclick = start;
        resetBtn.onclick = create;
    }

    /* =========================
       GAME SETUP
       ========================= */

    /* Creates a new game board and resets state */
    function create(){
        size = parseInt(sizeSelect.value);
        current = 1;
        scores = {1:0,2:0};
        gameActive = false;

        /* Initialize grid structures */
        h = Array.from({length:size},()=>Array(size-1).fill(0));
        v = Array.from({length:size-1},()=>Array(size).fill(0));
        boxes = Array.from({length:size-1},()=>Array(size-1).fill(0));

        draw();
        update();
    }

    /* Starts the game */
    function start(){
        gameActive = true;
        msg.textContent = "Game started";
    }

    /* =========================
       BOARD RENDERING
       ========================= */

    /* Dynamically builds the board grid in the DOM */
    function draw(){
        board.innerHTML="";
        const n=size*2-1;

        /* Set grid columns based on board size */
        board.style.gridTemplateColumns=`repeat(${n},auto)`;

        for(let r=0;r<n;r++){
            for(let c=0;c<n;c++){

                /* Dot (intersection point) */
                if(r%2===0 && c%2===0){
                    const d=document.createElement("div");
                    d.className="dot";
                    board.appendChild(d);
                }

                /* Horizontal line */
                else if(r%2===0){
                    const line=document.createElement("div");
                    line.className="line horizontal";
                    const rr=r/2, cc=Math.floor(c/2);

                    if(h[rr][cc]) line.classList.add("active");

                    line.onclick=()=>clickLine("h",rr,cc);
                    board.appendChild(line);
                }

                /* Vertical line */
                else if(c%2===0){
                    const line=document.createElement("div");
                    line.className="line vertical";
                    const rr=Math.floor(r/2), cc=c/2;

                    if(v[rr][cc]) line.classList.add("active");

                    line.onclick=()=>clickLine("v",rr,cc);
                    board.appendChild(line);
                }

                /* Box cell */
                else{
                    const box=document.createElement("div");
                    box.className="box";
                    const rr=Math.floor(r/2), cc=Math.floor(c/2);

                    if(boxes[rr][cc]){
                        box.classList.add(
                            boxes[rr][cc]===1 ? "player1" : "player2"
                        );
                    }

                    board.appendChild(box);
                }
            }
        }
    }

    /* =========================
       GAMEPLAY LOGIC
       ========================= */

    /* Handles line click events */
    function clickLine(type,r,c){
        if(!gameActive) return;

        /* Prevent selecting already-used lines */
        if(type==="h" && h[r][c]) return;
        if(type==="v" && v[r][c]) return;

        /* Mark the selected line */
        if(type==="h") h[r][c]=1;
        else v[r][c]=1;

        /* Check if any boxes were completed */
        let gained = checkBoxes();

        /* Switch turn if no box was gained */
        if(gained===0){
            current = current===1?2:1;
        }

        draw();
        update();

        /* Trigger AI move if enabled */
        if(modeSelect.value==="ai" && current===2){
            setTimeout(aiMove,300);
        }
    }

    /* Checks for completed boxes and updates scores */
    function checkBoxes(){
        let gained=0;

        for(let r=0;r<size-1;r++){
            for(let c=0;c<size-1;c++){

                if(boxes[r][c]) continue;

                /* A box is complete if all 4 edges exist */
                if(h[r][c] && h[r+1][c] && v[r][c] && v[r][c+1]){
                    boxes[r][c]=current;
                    scores[current]++;
                    gained++;
                }
            }
        }

        return gained;
    }

    /* =========================
       AI LOGIC
       ========================= */

    /* Simple AI:
       1. Try to complete a box if possible
       2. Otherwise pick a random valid move */
    function aiMove(){
        let best=null;

        /* Step 1: Find winning move (horizontal) */
        for(let r=0;r<size;r++){
            for(let c=0;c<size-1;c++){
                if(!h[r][c]){
                    h[r][c]=1;
                    if(checkBoxes()>0){ best={t:"h",r,c}; }
                    h[r][c]=0;
                }
            }
        }

        /* Step 1: Find winning move (vertical) */
        for(let r=0;r<size-1;r++){
            for(let c=0;c<size;c++){
                if(!v[r][c]){
                    v[r][c]=1;
                    if(checkBoxes()>0){ best={t:"v",r,c}; }
                    v[r][c]=0;
                }
            }
        }

        /* Step 2: Fallback to random move */
        if(!best){
            let moves=[];

            for(let r=0;r<size;r++){
                for(let c=0;c<size-1;c++){
                    if(!h[r][c]) moves.push({t:"h",r,c});
                }
            }

            for(let r=0;r<size-1;r++){
                for(let c=0;c<size;c++){
                    if(!v[r][c]) moves.push({t:"v",r,c});
                }
            }

            best = moves[Math.floor(Math.random()*moves.length)];
        }

        clickLine(best.t,best.r,best.c);
    }

    /* =========================
       UI UPDATE
       ========================= */

    /* Updates scores and turn indicator */
    function update(){
        p1ScoreEl.textContent=scores[1];
        p2ScoreEl.textContent=scores[2];
        turnLabel.textContent = current===1 ? "Player" : "AI";
    }

    /* =========================
       BOOTSTRAP
       ========================= */

    init();

})();