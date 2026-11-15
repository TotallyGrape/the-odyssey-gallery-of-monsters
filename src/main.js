import kaplay from "kaplay";
import "kaplay/global"; // types for the prefix-free functions (add, pos, vec2, setCursor, ...) in every file
import { addButton } from "./button.js";
import {
    newBattleState, resolveMove, checkOptions, fallbackOptions, matchSpeech, isAvailable, getMove,
    TIERS, QUALITIES, NO_MOVE,
} from "./encounter.js";
import { requestTurn, requestSpeech } from "./ai.js";
import { prepareNarration, whenNarrationDone } from "./narration.js";
import { openSpeakInput } from "./speakInput.js";
import { CYCLOPS } from "./bosses/cyclops.js";
import { SCYLLA } from "./bosses/scylla.js";
import { GIANTS } from "./bosses/giants.js";
import { popDamage } from "./textParticles.js";
import { playerHitEffect } from "./hitEffects.js";
import { loadMonotone, setMonotone } from "./monotone.js";
import { GAME_FONT, loadGameFont } from "./font.js";
import { BORDER_WIDTH, addGameBorder } from "./border.js";
import { addEndScreens, fadeToEndScreen } from "./endScreens.js";
import { loadMainMenu, addMainMenu } from "./mainMenu.js";
import { addStoryScene, showStory } from "./transition.js";
import { loadMusicTracks, playSceneMusic } from "./music.js";
import { addSettingsButton, settingsBlocksInput } from "./settings.js";
import { playSfx } from "./sfx.js";


// The levels, in the order they are played. Reorder, add or remove bosses here.
const LEVELS = [CYCLOPS, SCYLLA, GIANTS];

// Shown after the last level is won, before returning to the main menu.
/** @type {import("./transition.js").Story} */
const ENDING = {
    title: "ITHACA",
    pages: [
        "The harbour falls behind. For the first time since Troy, nothing is chasing you.",
        "The sea still takes its time. Years pass, and friends are lost. But the wind, at last, blows toward Ithaca.",
        "Odysseus steps onto his own shore dressed as a beggar, strings his own bow, and takes back his own hall. Penelope tests him once, to be sure. He passes.",
        "Twenty years, a cyclops, a monster and a harbour of giants. He is home.",
        "THE END",
    ],
};

export const k = kaplay({
    background: [0, 0, 0],
    // Fixed 16:9 game area, scaled to fit any window with black bars around it
    width: 1280,
    height: 720,
    letterbox: true,
    // Smooth the final image when the fixed game area scales to the window.
    texFilter: "linear",
});
onUpdate(() => setCursor("default"));
k.loadRoot("./"); // A good idea for Itch.io publishing later

// Asset loading must come after kaplay() - the load functions don't exist before it
loadGameFont(); // the font is chosen in src/font.js
loadMusicTracks();
k.loadBean(); // built-in "bean" sprite; put your own art in public/sprites and use k.loadSprite()
k.setGravity(1600);


const SPEED = 320;

// Paths are relative to the public/ folder, so "public/" is not part of the path
loadSprite("tung", "examples/sprites/tung.png");
// Boss pictures. Each boss file names the one it uses in its `sprite` field.
loadSprite("cyclops", "assets/Cyclops.png");
loadSprite("scylla", "assets/Scylla.png");
loadSprite("giants", "assets/Giants.png");

loadSprite("frame", "assets/picture-frame-427233_1280.jpg");

const BOSS_PIC_HEIGHT = 520; // on-screen height of the boss picture; the width follows the image's shape

// The part of the frame image the boss picture covers, as fractions of the frame image
// (0 = left/top edge, 1 = right/bottom edge). The frame is sized so this area matches the boss picture.
const FRAME_OPENING = { left: 0.139, top: 0.129, right: 0.861, bottom: 0.871 };

// Whole-screen colour: everything is drawn in shades of this one colour.
const MONOTONE_COLOR = [55, 120, 255]; // red, green, blue (0-255). Blue to start.
const MONOTONE_AMOUNT = 1;             // 0 = normal colours, 1 = fully monotone
loadMonotone();
setMonotone(rgb(MONOTONE_COLOR[0], MONOTONE_COLOR[1], MONOTONE_COLOR[2]), MONOTONE_AMOUNT);

// ---- Level flow ----
// menu -> story -> fight -> victory -> next story -> ... -> ending story -> menu
let level = 0; // index into LEVELS of the level being played

/** Shows a level's story, then starts its fight. */
function startLevel() {
    const boss = LEVELS[level];
    showStory(boss.story, () => go("battle", boss));
}

/**
 * Called when CONTINUE is clicked on the death or victory screen.
 * @param {"death" | "victory"} kind which screen the button was on
 */
function onContinue(kind) {
    if (kind === "death") {
        go("battle", LEVELS[level]); // try the same fight again, without repeating the story
        return;
    }
    level++;
    if (level < LEVELS.length) startLevel();
    else showStory(ENDING, () => go("menu")); // the last level is won: tell the ending, then back to the menu
}
addEndScreens(onContinue);
addStoryScene();

// Main menu (src/mainMenu.js): PLAY starts from the first level
loadMainMenu();
addMainMenu(() => {
    level = 0;
    startLevel();
});

scene("battle", (/** @type {import("./encounter.js").Boss} */ boss) => {
    playSceneMusic(boss === CYCLOPS ? "cyclops" : "giantsScylla");
    // Painting frame, added first so the boss picture is drawn on top of its blank centre
    const frame = add([
        sprite("frame"),
        pos(k.width() / 2, BORDER_WIDTH),
        anchor("top"),
        scale(1),
    ]);

    // Boss picture: scaled down to BOSS_PIC_HEIGHT whatever the image's real size
    const pic = add([
        sprite(boss.sprite),
        pos(0, 0),
        anchor("top"),
        scale(1),
    ]);
    pic.scaleTo(BOSS_PIC_HEIGHT / pic.height);
    const picWidth = pic.width * pic.scale.x;

    // Size the frame so its opening is exactly the boss picture, then hang the picture in it
    const frameScale = vec2(
        picWidth / ((FRAME_OPENING.right - FRAME_OPENING.left) * frame.width),
        BOSS_PIC_HEIGHT / ((FRAME_OPENING.bottom - FRAME_OPENING.top) * frame.height),
    );
    frame.scaleTo(frameScale);
    const frameCenterX = (FRAME_OPENING.left + FRAME_OPENING.right) / 2 - 0.5; // opening's offset from the frame's middle
    pic.pos = vec2(
        frame.pos.x + frameCenterX * frame.width * frameScale.x,
        frame.pos.y + FRAME_OPENING.top * frame.height * frameScale.y,
    );
    const picCenter = pic.pos.add(0, BOSS_PIC_HEIGHT / 2);

    addGameBorder(); // white frame around the game area (src/border.js)
    addSettingsButton(); // top right; opens the volume overlay (src/settings.js)

    // ---- Fight state ----
    let state = newBattleState(boss);
    let alive = true; // false once this scene has been left; late AI answers are then ignored
    onSceneLeave(() => (alive = false));

    /** What has been said and done so far, so the narrator can keep the story continuous. */
    /** @type {import("./ai.js").HistoryTurn[]} */
    const history = [];
    /** The FIGHT and FLEE options for the coming turn (from the AI, checked against the rules). */
    let options = {
        fight: fallbackOptions(boss, state, "fight"),
        flee: fallbackOptions(boss, state, "flee"),
    };

    // ---- Status line (top left) ----
    const status = add([
        text("", { font: GAME_FONT, size: 24, width: 300 }), // wraps so it stays clear of the painting frame
        pos(24, 24),
        color(255, 255, 255),
    ]);
    function updateStatus() {
        status.text = boss.status(state); // each boss describes its own numbers
    }

    // ---- Text box with rolling text (bottom) ----
    const TEXTBOX_SIZE = vec2(1000, 150);
    const TEXTBOX_POS = vec2(k.width() / 2, k.height() - 110);
    const TEXT_WIDTH = TEXTBOX_SIZE.x - 60;
    const TEXT_SIZES = [28, 26, 24, 22, 20]; // a message uses the largest of these that fits the box
    const TEXT_MAX_HEIGHT = TEXTBOX_SIZE.y - 24;
    const ROLL_INTERVAL = 0.02;     // seconds per letter when there is no voice to keep pace with
    const ROLL_INTERVAL_MAX = 0.06; // slowest the letters go when keeping pace with the narrator

    add([
        rect(TEXTBOX_SIZE.x, TEXTBOX_SIZE.y, { radius: 8 }),
        pos(TEXTBOX_POS),
        anchor("center"),
        color(255, 255, 255),
        outline(4),
    ]);

    let lettersShown = 0;         // how many letters of the current message are visible
    let rolling = false;          // true while a message is still being typed out
    let finishRoll = () => {};    // completes the current message immediately

    const rollText = add([
        text("", {
            font: GAME_FONT,
            size: TEXT_SIZES[0],
            width: TEXT_WIDTH,
            align: "center",
            // letters past lettersShown are invisible, which gives the typewriter effect
            transform: (idx) => ({ opacity: idx < lettersShown ? 1 : 0 }),
        }),
        pos(TEXTBOX_POS),
        anchor("center"),
        color(0, 0, 0),
    ]);

    /** Puts a message in the text box at the largest size that fits. */
    function setBoxText(/** @type {string} */ message) {
        const size = TEXT_SIZES.find((s) =>
            formatText({ text: message, font: GAME_FONT, size: s, width: TEXT_WIDTH, align: "center" }).height <= TEXT_MAX_HEIGHT)
            ?? TEXT_SIZES[TEXT_SIZES.length - 1];
        rollText.textSize = size;
        rollText.text = message;
    }

    /**
     * Types a message into the text box one letter at a time.
     * Don't use square brackets in messages: KAPLAY reads them as style tags.
     * @param {string} message
     * @param {() => void} [onDone] called once the whole message is showing
     * @param {number} [interval] seconds per letter
     */
    function text_roll(message, onDone, interval = ROLL_INTERVAL) {
        finishRoll(); // if something is still rolling, complete it first
        stopThinking();
        setBoxText(message);
        lettersShown = 0;
        rolling = true;

        const TYPE_SOUND_EVERY = 3; // a tick every this many letters
        const writing = loop(interval, () => {
            lettersShown++;
            if (lettersShown % TYPE_SOUND_EVERY === 0) playSfx("type");
            if (lettersShown >= message.length) finishRoll();
        });
        finishRoll = () => {
            if (!rolling) return;
            rolling = false;
            lettersShown = message.length;
            writing.cancel();
            if (onDone) onDone();
        };
    }

    // SPACE or a click skips to the end of the message
    // (ignored while the settings overlay is open, or when the click is on the SETTINGS button)
    onKeyPress("space", () => { if (!settingsBlocksInput()) finishRoll(); });
    onClick(() => { if (!settingsBlocksInput()) finishRoll(); });

    // ---- "Thinking" line: shown in the text box while the AI is working ----
    const THINKING_SIZE = 22;
    const THINKING_DOTS = 3;
    const THINKING_DOT_TIME = 0.35; // seconds per dot
    let thinking = "";              // the line being shown, or "" when not waiting
    const thinkingText = add([
        text("", { font: GAME_FONT, size: THINKING_SIZE }),
        pos(TEXTBOX_POS.x, TEXTBOX_POS.y + 44),
        anchor("left"),
        color(0, 0, 0),
        opacity(0.6),
    ]);
    thinkingText.onUpdate(() => {
        if (!thinking) return;
        thinkingText.text = thinking + ".".repeat(1 + (Math.floor(time() / THINKING_DOT_TIME) % THINKING_DOTS));
    });

    /**
     * Shows what the player just chose, with a waiting line under it, until the next text_roll.
     * @param {string} headline what was chosen or said ("" for none)
     * @param {string} waiting  e.g. "The Muse weighs your words"
     */
    function showThinking(headline, waiting) {
        setBoxText(headline);
        lettersShown = headline.length;
        rollText.pos.y = TEXTBOX_POS.y - (headline ? 18 : 0);
        thinking = waiting;
        // Left-anchored and centred by its full width, so the growing dots don't make it jitter
        const full = formatText({ text: waiting + ".".repeat(THINKING_DOTS), font: GAME_FONT, size: THINKING_SIZE }).width;
        thinkingText.pos = vec2(TEXTBOX_POS.x - full / 2, TEXTBOX_POS.y + (headline ? 44 : 0));
        thinkingText.hidden = false;
    }
    function stopThinking() {
        thinking = "";
        thinkingText.hidden = true;
        thinkingText.text = "";
        rollText.pos.y = TEXTBOX_POS.y;
    }
    stopThinking();

    // ---- Menus ----
    const MENU_Y = k.height() / 2 + 30;     // centre of the first row of buttons (menus of three or more rows start higher)
    const MENU_GAP = 32;                    // space between buttons in a row
    const MENU_ROW_STEP = 84;               // distance from one row to the next
    const MENU_ROWS_BELOW = 2;              // rows that fit between MENU_Y and the text box
    const MENU_MAX_WIDTH = k.width() - 120; // a row wider than this wraps onto a new row
    const HIT_REFERENCE = 10;               // HP loss that counts as a "normal" hit for the hit effect
    const END_WAIT_MAX = 30;                // most seconds to wait for the narrator before the end screen
    /** @type {import("kaplay").GameObj[]} */
    let menuButtons = [];
    let menuVersion = 0; // lets a newer showMenu/hideMenu cancel an older pending one
    /** @type {{ close: () => void } | null} */
    let speakPanel = null;

    function hideMenu() {
        menuVersion++;
        for (const b of menuButtons) b.destroy();
        menuButtons = [];
        speakPanel?.close();
        speakPanel = null;
    }

    /**
     * Replaces the buttons on screen with centred rows, each button sized to fit its label.
     * Buttons that don't fit on a row wrap onto the next one.
     * @param {{ label: string, onPick: () => void }[]} choices
     */
    function showMenu(choices) {
        hideMenu();
        const version = menuVersion;
        // Build on the next frame, so the click that opened this menu can't also press a new button
        wait(0, () => {
            if (version !== menuVersion) return;
            menuButtons = choices.map((o) =>
                addButton(o.label, vec2(0, MENU_Y), null, o.onPick, { sound: o.label === "BACK" ? "back" : "click" }));

            // Split the buttons into rows that fit the screen
            /** @type {import("kaplay").GameObj[][]} */
            const rows = [[]];
            let rowWidth = 0;
            for (const b of menuButtons) {
                const row = rows[rows.length - 1];
                const widthWithButton = rowWidth + (row.length > 0 ? MENU_GAP : 0) + b.width;
                if (row.length > 0 && widthWithButton > MENU_MAX_WIDTH) {
                    rows.push([b]);
                    rowWidth = b.width;
                } else {
                    row.push(b);
                    rowWidth = widthWithButton;
                }
            }

            // Centre each row. Extra rows are added above, so the last one never covers the text box.
            const firstRowY = MENU_Y - Math.max(0, rows.length - MENU_ROWS_BELOW) * MENU_ROW_STEP;
            rows.forEach((row, i) => {
                const total = row.reduce((sum, b) => sum + b.width, 0) + MENU_GAP * (row.length - 1);
                let x = k.width() / 2 - total / 2;
                for (const b of row) {
                    b.pos = vec2(x + b.width / 2, firstRowY + i * MENU_ROW_STEP);
                    x += b.width + MENU_GAP;
                }
            });
        });
    }

    function showMainMenu() {
        showMenu([
            { label: "FIGHT", onPick: () => showOptions("fight") },
            { label: "SPEAK", onPick: showSpeakPanel },
            { label: "FLEE", onPick: () => showOptions("flee") },
        ]);
    }

    /**
     * FIGHT or FLEE was pressed: show this turn's options for it as buttons (plus BACK).
     * @param {"fight" | "flee"} action
     */
    function showOptions(action) {
        showMenu([
            ...options[action].map((option) => ({
                label: option.label,
                onPick: () => playTurn({ move: option.move, grade: TIERS[option.tier], tier: option.tier, label: option.label }),
            })),
            { label: "BACK", onPick: showMainMenu },
        ]);
    }

    /** SPEAK was pressed: open the box where the player types what they say or do (src/speakInput.js). */
    function showSpeakPanel() {
        hideMenu();
        const version = menuVersion;
        // Open on the next frame, so the click on SPEAK can't also press one of the panel's buttons
        wait(0, () => {
            if (version !== menuVersion) return;
            speakPanel = openSpeakInput({ onSubmit: speak, onBack: showMainMenu });
        });
    }

    // ---- Turns ----
    /**
     * Narrates a message: loads the narrator's voice for it, then types the text out in step with the voice.
     * @param {string} message
     * @param {() => void} onStart called at the moment the text and voice begin (apply the turn's effects here)
     * @param {() => void} onDone  called once the whole message is showing
     */
    async function tell(message, onStart, onDone) {
        const voice = await prepareNarration(message);
        if (!alive) return;
        onStart();
        let interval = ROLL_INTERVAL;
        if (voice && voice.duration > 0) {
            // Spread the letters over the length of the spoken line, within sensible limits
            interval = Math.min(ROLL_INTERVAL_MAX, Math.max(ROLL_INTERVAL, (voice.duration * 0.92) / message.length));
        }
        voice?.play();
        text_roll(message, onDone, interval);
    }

    /** Starts the fight: the AI sets the scene and offers the first options. */
    async function openFight() {
        showThinking("", "The Muse draws breath");
        const ai = await requestTurn({ boss: boss.id, state, history, last: null });
        if (!alive) return;
        const opening = ai?.narration || boss.intro;
        options = {
            fight: checkOptions(boss, state, "fight", ai?.fight),
            flee: checkOptions(boss, state, "flee", ai?.flee),
        };
        history.push({ did: "", told: opening });
        tell(opening, () => {}, showMainMenu);
    }

    /**
     * The player typed something under SPEAK: the AI reads it as one of the boss's moves, then the turn is played.
     * @param {string} said
     */
    async function speak(said) {
        hideMenu(); // no input while the result is being worked out
        showThinking(`"${said}"`, "The Muse weighs your words");
        const read = await requestSpeech({ boss: boss.id, state, history, text: said }) ?? matchSpeech(boss, state, said);
        if (!alive) return;
        const move = isAvailable(boss, state, read.move) ? read.move : NO_MOVE;
        const quality = Object.prototype.hasOwnProperty.call(QUALITIES, read.quality) ? read.quality : "solid";
        playTurn({ move, grade: QUALITIES[quality], quality, said });
    }

    /**
     * Plays one turn: the engine works out the numbers, the AI tells it and offers the next options.
     * @param {{ move: string, grade: import("./encounter.js").Grade, label?: string, tier?: string, said?: string, quality?: string }} pick
     */
    async function playTurn(pick) {
        hideMenu(); // no input while the result is being told
        if (!pick.said) showThinking(pick.label ?? "", "The Fates decide");

        const result = resolveMove(boss, state, pick.move, pick.grade);
        const action = getMove(boss, pick.move)?.action ?? "speak";
        const ai = await requestTurn({
            boss: boss.id,
            state: result.state,
            history,
            last: {
                action,
                move: pick.move,
                label: pick.label,
                tier: pick.tier,
                said: pick.said,
                quality: pick.quality,
                text: result.text,
                damageDealt: result.damageDealt,
                hpLost: result.hpLost,
                outcome: result.outcome,
            },
        });
        if (!alive) return;

        const narration = ai?.narration || result.text;
        if (result.outcome === "continue") {
            options = {
                fight: checkOptions(boss, result.state, "fight", ai?.fight),
                flee: checkOptions(boss, result.state, "flee", ai?.flee),
            };
        }
        history.push({ did: pick.said ? `"${pick.said}"` : pick.label ?? "", told: narration });

        tell(narration, () => {
            // The numbers change at the moment the result is told
            state = result.state;
            updateStatus();
            // Enemy took damage: numbers burst out of the enemy picture
            if (result.damageDealt > 0) popDamage(result.damageDealt, picCenter);
            // Player took damage: gentle shake and red flash, a bit stronger for bigger hits.
            // If the player also dealt damage, wait a beat so the two don't land at once.
            if (result.hpLost > 0) wait(result.damageDealt > 0 ? 0.6 : 0, () => playerHitEffect(result.hpLost / HIT_REFERENCE));
        }, () => {
            if (result.outcome !== "continue") {
                // The fight is over. Let the narrator finish the last line (even if the text was skipped),
                // then fade out to the death or victory screen (src/endScreens.js).
                const outcome = result.outcome;
                let faded = false;
                const fade = () => {
                    if (faded || !alive) return;
                    faded = true;
                    fadeToEndScreen(outcome);
                };
                whenNarrationDone().then(fade);
                wait(END_WAIT_MAX, fade); // never wait longer than this, whatever the audio does
                return;
            }
            showMainMenu();
        });
    }

    // ---- Start ----
    updateStatus();
    openFight();

    // Kept for later use: FIGHT no longer starts this minigame.
    // Centre of the spin minigame's moving arc, in game coordinates (updated while it runs).
    let spinArcPos = k.vec2(0, 0);
    /**
     * @param {(score: number, success: boolean) => void} scoreCallback called once when the minigame closes; score = number of successful hits
     * @param {number} n how many hits are needed to win
     */
    function startSpinGame(scoreCallback, n = 5) {
        // Only one minigame at a time (e.g. FIGHT clicked again while one is open)
        if (k.get("minigame_container").length > 0) return;

        // ---- Tunables ----
        const HITS_NEEDED = n;      // hits required to win
        const SPEED = 200;          // degrees per second the yellow arc travels (constant)
        const ARC_SIZE = 360 / 20;  // yellow arc is 1/10 of the circle (36 degrees)
        const ZONE_SIZE = 360 / 10; // size of the green target zone, in degrees
        const ZONE_START = -90;     // where the zone starts (-90 = top of the ring)
        const ZONE_JUMP_MIN = 90;   // after a hit the zone moves at least a quarter turn...
        const ZONE_JUMP_MAX = 270;  // ...and at most three quarters, in the arc's new direction
        const START_BUFFER = 180;   // degrees the arc must travel before it first touches the zone
        const RADIUS = 80;          // ring radius (to the middle of the band)
        const THICKNESS = 18;       // ring band thickness
        const BOX = k.vec2(360, 300);

        // ---- State ----
        let zoneAngle = ZONE_START;      // centre of the green zone; moves after every hit
        let direction = 1;               // 1 = clockwise, -1 = counter-clockwise
        let hits = 0;                    // successful presses; this is the score

        // Smallest distance between two angles, in degrees (0..180)
        const angleDist = (/** @type {number} */ a, /** @type {number} */ b) =>
            Math.abs(((((a - b + 180) % 360) + 360) % 360) - 180);

        // The arc and the zone overlap when their centres are closer than half their combined size
        const maxDist = (ARC_SIZE + ZONE_SIZE) / 2;
        const isOverlapping = () => angleDist(arcAngle, zoneAngle) < maxDist;

        // Centre of the yellow arc. Starts far enough behind the zone that it has to travel
        // START_BUFFER degrees (half a circle) before the two first touch.
        let arcAngle = zoneAngle - direction * (START_BUFFER + maxDist);

        // Centre of the ring in game coordinates, and a helper that keeps spinArcPos up to date
        const ringCentre = k.vec2(k.width() / 2, k.height() / 2 + 5);
        const updateArcPos = () => {
            spinArcPos = k.vec2(
                ringCentre.x + Math.cos(k.deg2rad(arcAngle)) * RADIUS,
                ringCentre.y + Math.sin(k.deg2rad(arcAngle)) * RADIUS,
            );
        };
        updateArcPos();

        // Draws a piece of the ring band centred on `centre` degrees, `size` degrees long.
        // Built from small four-corner slices so it works for any length, including the full ring.
        const drawBand = (/** @type {number} */ centre, /** @type {number} */ size, /** @type {import("kaplay").Color} */ col) => {
            const steps = Math.max(2, Math.ceil(size / 6));
            const inner = RADIUS - THICKNESS / 2;
            const outer = RADIUS + THICKNESS / 2;
            const point = (/** @type {number} */ deg, /** @type {number} */ r) =>
                k.vec2(Math.cos(k.deg2rad(deg)) * r, Math.sin(k.deg2rad(deg)) * r);
            for (let i = 0; i < steps; i++) {
                const a0 = centre - size / 2 + (size * i) / steps;
                const a1 = centre - size / 2 + (size * (i + 1)) / steps;
                k.drawPolygon({
                    pts: [point(a0, outer), point(a1, outer), point(a1, inner), point(a0, inner)],
                    color: col,
                });
            }
        };

        // Parent container with a high z so it renders on top; centred on screen
        const overlay = k.add([
            k.pos(k.width() / 2 - BOX.x / 2, k.height() / 2 - BOX.y / 2),
            k.z(1000),
            "minigame_container",
        ]);

        // Background box
        overlay.add([
            k.rect(BOX.x, BOX.y),
            k.color(15, 15, 15),
            k.outline(4, k.rgb(255, 255, 255)),
        ]);

        // Title
        overlay.add([
            k.text("PRESS SPACE ON THE GREEN", { size: 16 }),
            k.pos(BOX.x / 2, 22),
            k.anchor("center"),
            k.color(255, 255, 255),
        ]);

        // The ring itself: white ring, green zone, moving yellow arc on top
        overlay.add([
            k.pos(ringCentre.sub(overlay.pos)), // children are positioned relative to the box
            {
                id: "spinRing",
                draw() {
                    drawBand(0, 360, k.rgb(255, 255, 255));
                    drawBand(zoneAngle, ZONE_SIZE, k.rgb(60, 200, 110));
                    drawBand(arcAngle, ARC_SIZE, k.rgb(255, 220, 0));
                },
            },
        ]);

        // Progress readout
        const status = overlay.add([
            k.text("", { size: 16 }),
            k.pos(BOX.x / 2, BOX.y - 22),
            k.anchor("center"),
            k.color(255, 255, 255),
        ]);
        const refreshStatus = () => {
            status.text = `HITS ${hits}/${HITS_NEEDED}`;
        };
        refreshStatus();

        // Move the yellow arc at a constant pace
        const updateAction = k.onUpdate(() => {
            arcAngle = (arcAngle + direction * SPEED * k.dt()) % 360;
            updateArcPos();
        });

        // SPACE: a hit if the arc overlaps the zone, otherwise a miss that ends the minigame
        const spaceListener = k.onKeyPress("space", () => {
            if (!isOverlapping()) {
                closeMinigame(false);
                return;
            }
            hits++;
            direction *= -1; // reverse direction
            // Move the zone ahead of the arc: at least a quarter turn in the new direction
            zoneAngle = (zoneAngle + direction * k.rand(ZONE_JUMP_MIN, ZONE_JUMP_MAX)) % 360;
            refreshStatus();
            if (hits >= HITS_NEEDED) closeMinigame(true);
        });

        // Comprehensive cleanup and removal function
        function closeMinigame(success = true) {
            // 1. Cancel listeners so the minigame can only close (and report its score) once
            updateAction.cancel();
            spaceListener.cancel();
            exitListener.cancel();

            // 2. Destroy the container (wipes out the box, text, and ring)
            overlay.destroy();
            // 4. Fire callback with the score: how many hits were landed
            if (scoreCallback) {
                scoreCallback(hits, success);
            }
        }

        // Press 'X' to give up early
        const exitListener = k.onKeyPress("x", () => {
            closeMinigame(false);
        });
    }

});
k.onLoad(() => k.go("menu"));
