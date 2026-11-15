// The SPEAK panel: a box where the player types what Odysseus says, does or prepares.
//
// Usage (inside a scene):
//   const panel = openSpeakInput({ onSubmit: (words) => ..., onBack: () => ... });
//   panel.close();   // remove it without calling either callback
//
// It is drawn inside the game like everything else, so it scales with the window and takes the
// game's colour. ENTER or the SPEAK button sends the words; ESC or BACK cancels.
// While the settings overlay is open (src/inputLock.js) it ignores the keyboard.

import { addButton } from "./button.js";
import { cleanText } from "./encounter.js";
import { GAME_FONT } from "./font.js";
import { isInputLocked } from "./inputLock.js";
import { playSfx } from "./sfx.js";

// ---- Settings ----
export const SPEECH_MAX = 140;                 // most characters that can be typed
const PANEL_SIZE = { x: 1000, y: 200 };
const PANEL_CENTER = { x: 640, y: 400 };
const PADDING = 30;                            // from the panel's edge to its contents
const HEADING = "WHAT DO YOU SAY OR DO?";
const HEADING_SIZE = 26;
const PLACEHOLDER = "Speak, give an order, or prepare something...";
const HINT = "ENTER to speak    ESC to go back";
const SMALL_SIZE = 20;
const FIELD_HEIGHT = 56;
const FIELD_Y = 84;                            // field centre, measured from the panel's top
const FIELD_PADDING = 16;                      // from the field's edge to the typed text
const TEXT_SIZE = 28;
const BUTTON_Y = 154;                          // button centres, measured from the panel's top
const CARET_SIZE = { x: 3, y: 34 };
const CARET_BLINK = 0.5;                       // seconds on, then the same off
const FORBIDDEN = "[]\\";                      // KAPLAY reads these as style tags
const TAG = "speak_input";

/**
 * Opens the panel.
 * @param {{ onSubmit: (words: string) => void, onBack: () => void }} handlers
 * @returns {{ close: () => void }}
 */
export function openSpeakInput(handlers) {
    const left = PANEL_CENTER.x - PANEL_SIZE.x / 2;
    const top = PANEL_CENTER.y - PANEL_SIZE.y / 2;
    const fieldWidth = PANEL_SIZE.x - PADDING * 2;
    const fieldY = top + FIELD_Y;
    const textX = left + PADDING + FIELD_PADDING;
    const textRoom = fieldWidth - FIELD_PADDING * 2 - CARET_SIZE.x - 4;

    let typed = "";
    let closed = false;
    let lastKeyAt = time(); // the caret stays solid for a moment after each key

    // ---- The panel ----
    add([
        rect(PANEL_SIZE.x, PANEL_SIZE.y, { radius: 8 }),
        pos(PANEL_CENTER.x, PANEL_CENTER.y),
        anchor("center"),
        color(255, 255, 255),
        outline(4),
        TAG,
    ]);
    add([
        text(HEADING, { font: GAME_FONT, size: HEADING_SIZE }),
        pos(left + PADDING, top + 32),
        anchor("left"),
        color(0, 0, 0),
        TAG,
    ]);
    const counter = add([
        text("", { font: GAME_FONT, size: SMALL_SIZE }),
        pos(left + PANEL_SIZE.x - PADDING, top + 32),
        anchor("right"),
        color(0, 0, 0),
        opacity(0.55),
        TAG,
    ]);

    // ---- The field ----
    const field = add([
        rect(fieldWidth, FIELD_HEIGHT, { radius: 6 }),
        pos(PANEL_CENTER.x, fieldY),
        anchor("center"),
        color(232, 232, 232),
        outline(3),
        TAG,
    ]);
    const placeholder = add([
        text(PLACEHOLDER, { font: GAME_FONT, size: TEXT_SIZE }),
        pos(textX, fieldY),
        anchor("left"),
        color(0, 0, 0),
        opacity(0.4),
        TAG,
    ]);
    const shown = add([
        text("", { font: GAME_FONT, size: TEXT_SIZE }),
        pos(textX, fieldY),
        anchor("left"),
        color(0, 0, 0),
        TAG,
    ]);
    const caret = add([
        rect(CARET_SIZE.x, CARET_SIZE.y),
        pos(textX, fieldY),
        anchor("left"),
        color(0, 0, 0),
        opacity(1),
        TAG,
    ]);
    caret.onUpdate(() => {
        const sinceKey = time() - lastKeyAt;
        caret.opacity = sinceKey < CARET_BLINK || Math.floor(sinceKey / CARET_BLINK) % 2 === 0 ? 1 : 0;
    });

    add([
        text(HINT, { font: GAME_FONT, size: SMALL_SIZE }),
        pos(PANEL_CENTER.x, top + BUTTON_Y),
        anchor("center"),
        color(0, 0, 0),
        opacity(0.55),
        TAG,
    ]);

    // ---- Buttons ----
    const backButton = addButton("BACK", vec2(0, top + BUTTON_Y), null, back, { sound: "back" });
    backButton.pos.x = left + PADDING + backButton.width / 2;
    backButton.use(TAG);
    const speakButton = addButton("SPEAK", vec2(0, top + BUTTON_Y), null, submit, { fill: [0, 0, 0], text: [255, 255, 255] });
    speakButton.pos.x = left + PANEL_SIZE.x - PADDING - speakButton.width / 2;
    speakButton.use(TAG);

    /** Width of a piece of typed text, including any spaces at its end. */
    const measure = (/** @type {string} */ piece) => {
        const options = { font: GAME_FONT, size: TEXT_SIZE };
        return formatText({ ...options, text: `${piece}|` }).width - formatText({ ...options, text: "|" }).width;
    };

    function refresh() {
        // If the words are wider than the field, show the end of them
        let visible = typed;
        while (visible.length > 0 && measure(visible) > textRoom) visible = visible.slice(1);
        shown.text = visible;
        caret.pos.x = textX + (visible ? measure(visible) + 2 : 0);
        placeholder.hidden = typed.length > 0;
        counter.text = `${typed.length} / ${SPEECH_MAX}`;
        lastKeyAt = time();
    }
    refresh();

    // ---- Keyboard ----
    const listeners = [
        onCharInput((ch) => {
            if (closed || isInputLocked()) return;
            if (ch.length !== 1 || ch < " " || ch > "~" || FORBIDDEN.includes(ch)) return;
            if (typed.length >= SPEECH_MAX) return;
            if (ch === " " && typed.length === 0) return; // no leading spaces
            typed += ch;
            playSfx("type");
            refresh();
        }),
        onKeyPressRepeat("backspace", () => {
            if (closed || isInputLocked() || typed.length === 0) return;
            typed = typed.slice(0, -1);
            playSfx("type");
            refresh();
        }),
        onKeyPress("enter", () => {
            if (closed || isInputLocked()) return;
            playSfx("click");
            submit();
        }),
        onKeyPress("escape", () => {
            if (closed || isInputLocked()) return;
            playSfx("back");
            back();
        }),
    ];

    function close() {
        if (closed) return;
        closed = true;
        for (const listener of listeners) listener.cancel();
        destroyAll(TAG);
    }

    function submit() {
        if (closed) return;
        const words = cleanText(typed, SPEECH_MAX);
        if (!words) {
            // Nothing typed: nudge the field instead of sending an empty turn
            const home = PANEL_CENTER.x;
            tween(0, 1, 0.3, (t) => (field.pos.x = home + Math.sin(t * Math.PI * 4) * 8 * (1 - t))).onEnd(() => {
                if (field.exists()) field.pos.x = home;
            });
            return;
        }
        close();
        handlers.onSubmit(words);
    }

    function back() {
        if (closed) return;
        close();
        handlers.onBack();
    }

    return { close };
}
