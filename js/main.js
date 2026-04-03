/* =========================================================
   NeuroPlay Arcade - Main JS (Core Runtime)

   Purpose:
   - Handles global audio system (SFX + background music)
   - Manages navigation highlighting
   - Provides UI enhancements (button effects, page transitions)
   - Implements localStorage wrapper for persistence
   - Initializes shared behavior across all pages

   Architecture Notes:
   - Wrapped in an IIFE to avoid global scope pollution
   - Exposes minimal public API via window (playSound, arcadeMusic, storage)
   ========================================================= */

(() => {
    "use strict";

    /* =========================
       AUDIO SYSTEM SETUP
       ========================= */

    /* Base path for all sound assets */
    const SOUND_PATH = "assets/sounds/";

    /* Preloaded sound effects used across the app */
    const sounds = {
        click: createAudio("click.wav", 0.75),
        pop: createAudio("pop.wav", 0.85),
        drop: createAudio("drop.wav", 0.85),
        line: createAudio("line.wav", 0.8),
        win: createAudio("win.wav", 0.85),
        lose: createAudio("lose.wav", 0.85)
    };

    /* Background music (looped, lower volume) */
    const bgMusic = createAudio("bg_music.wav", 0.22, true);

    /* Factory function to safely create audio elements */
    function createAudio(file, volume = 1, loop = false) {
        try {
            const audio = new Audio(SOUND_PATH + file);
            audio.volume = volume;
            audio.loop = loop;
            audio.preload = "auto";
            return audio;
        } catch (error) {
            return null;
        }
    }

    /* =========================
       SOUND EFFECTS
       ========================= */

    /* Plays a named sound effect (if available) */
    function playSound(name) {
        const audio = sounds[name];
        if (!audio) return;

        try {
            audio.currentTime = 0; // restart sound
            audio.play().catch(() => {}); // prevent autoplay errors
        } catch (error) {
            /* silent fail */
        }
    }

    /* =========================
       BACKGROUND MUSIC CONTROL
       ========================= */

    /* Starts background music if enabled in storage */
    function startMusic() {
        if (!bgMusic) return;
        if (!storage.load("musicEnabled", true)) return;

        bgMusic.play().catch(() => {});
    }

    /* Stops and resets background music */
    function stopMusic() {
        if (!bgMusic) return;
        try {
            bgMusic.pause();
            bgMusic.currentTime = 0;
        } catch (error) {
            /* silent */
        }
    }

    /* Toggles music state (or forces a specific value) */
    function toggleMusic(forceValue) {
        const current = storage.load("musicEnabled", true);
        const next = typeof forceValue === "boolean" ? forceValue : !current;

        storage.save("musicEnabled", next);

        if (next) {
            startMusic();
        } else {
            stopMusic();
        }

        updateMusicButtons();
    }

    /* Updates all UI buttons that control music state */
    function updateMusicButtons() {
        const buttons = document.querySelectorAll("[data-music-toggle]");
        const enabled = storage.load("musicEnabled", true);

        buttons.forEach(button => {
            button.textContent = enabled ? "Music: On" : "Music: Off";
            button.classList.toggle("music-off", !enabled);
        });
    }

    /* Ensures music starts only after first user interaction
       (required for browser autoplay policies) */
    function enableMusicOnFirstInteraction() {
        const startOnce = () => {
            startMusic();
            window.removeEventListener("click", startOnce);
            window.removeEventListener("keydown", startOnce);
            window.removeEventListener("touchstart", startOnce);
        };

        window.addEventListener("click", startOnce, { once: true });
        window.addEventListener("keydown", startOnce, { once: true });
        window.addEventListener("touchstart", startOnce, { once: true });
    }

    /* =========================
       NAVIGATION SYSTEM
       ========================= */

    /* Highlights active page link in navbar */
    function setActiveNav() {
        const currentPage = window.location.pathname.split("/").pop() || "index.html";
        const links = document.querySelectorAll(".nav-links a");

        links.forEach(link => {
            const href = link.getAttribute("href");
            if (href === currentPage) {
                link.classList.add("active");
            } else {
                link.classList.remove("active");
            }
        });
    }

    /* =========================
       UI ENHANCEMENTS
       ========================= */

    /* Adds click sound + press animation to buttons */
    function enhanceButtons() {
        const buttons = document.querySelectorAll("button, .btn");

        buttons.forEach(button => {
            button.addEventListener("click", () => {
                if (!button.hasAttribute("data-no-click-sound")) {
                    playSound("click");
                }

                button.classList.add("pressing");
                setTimeout(() => button.classList.remove("pressing"), 120);
            });
        });
    }

    /* Connects music toggle buttons to logic */
    function wireMusicButtons() {
        const buttons = document.querySelectorAll("[data-music-toggle]");
        buttons.forEach(button => {
            button.addEventListener("click", () => toggleMusic());
        });
        updateMusicButtons();
    }

    /* Adds fade-in effect once page is initialized */
    function pageFadeIn() {
        document.body.classList.add("page-ready");
    }

    /* =========================
       STORAGE (LOCALSTORAGE WRAPPER)
       ========================= */

    /* Safe wrapper for localStorage with JSON handling */
    const storage = {
        /* Save value under key */
        save(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (error) {
                /* silent */
            }
        },

        /* Load value or return fallback if missing/error */
        load(key, fallback) {
            try {
                const raw = localStorage.getItem(key);
                return raw ? JSON.parse(raw) : fallback;
            } catch (error) {
                return fallback;
            }
        }
    };

    /* =========================
       PUBLIC API (GLOBAL EXPOSURE)
       ========================= */

    /* Expose utilities globally for game scripts */
    window.playSound = playSound;

    window.arcadeMusic = {
        start: startMusic,
        stop: stopMusic,
        toggle: toggleMusic
    };

    window.storage = storage;

    /* =========================
       INITIALIZATION
       ========================= */

    /* Bootstraps all shared functionality */
    function init() {
        setActiveNav();
        enhanceButtons();
        wireMusicButtons();
        enableMusicOnFirstInteraction();
        pageFadeIn();
    }

    /* Execute immediately */
    init();

})();