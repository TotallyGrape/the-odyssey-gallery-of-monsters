// Settings: a SETTINGS button for every scene, and the overlay it opens (music, SFX and narrator volume).
//
// Usage (after kaplay() has run):
//   addSettingsButton();    in each scene
//   getSfxVolume()          the SFX slider's value (sounds from src/sfx.js already follow it)
//
// While the overlay is open, normal game input is locked (see src/inputLock.js).
// The volumes are remembered between visits in the browser's storage.

import { addButton } from "./button.js";
import { GAME_FONT } from "./font.js";
import { lockInput, unlockInput, isInputLocked } from "./inputLock.js";
import { setMusicVolume } from "./music.js";
import { setNarrationVolume } from "./narration.js";
import { playSfx, setSfxVolume } from "./sfx.js";

// ---- Settings ----
const DEFAULTS = { music: 0.5, sfx: 0.5, voice: 0.9 }; // volumes from 0 (silent) to 1 (full)
const STORAGE_KEY = "odyssey-settings";

const BUTTON_LABEL = "SETTINGS";
const BUTTON_MARGIN = { x: 140, y: 56 }; // settings button centre, measured from the top-right corner

const DIM = 0.75;                        // how dark the game goes behind the panel (0-1)
const PANEL_SIZE = { x: 640, y: 500 };
const SLIDER_WIDTH = 300;
const SLIDER_HEIGHT = 10;
const KNOB_SIZE = { x: 22, y: 40 };
const SLIDER_GRAB_HEIGHT = 56;           // how tall the area that responds to the mouse is
const ROW_Y = [-100, -20, 60];               // each slider row, measured from the panel's centre
const UI_Z = 4000;                       // above everything, including the game border
const TAG = "settings_ui";

/** @typedef {"music" | "sfx" | "voice"} VolumeKey */
/** The sliders, top to bottom. `apply` runs whenever the value changes. */
const SLIDERS = /** @type {{ key: VolumeKey, label: string, apply: (v: number) => void }[]} */ ([
    { key: "music", label: "MUSIC", apply: setMusicVolume },
    { key: "sfx", label: "SFX", apply: setSfxVolume },
    { key: "voice", label: "VOICE", apply: setNarrationVolume },
]);

// ---- Stored values ----
const values = { ...DEFAULTS };
try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    for (const key of /** @type {VolumeKey[]} */ (["music", "sfx", "voice"])) {
        if (typeof saved[key] === "number") values[key] = Math.min(1, Math.max(0, saved[key]));
    }
} catch {
    // storage unavailable or unreadable: keep the defaults
}
setMusicVolume(values.music);
setSfxVolume(values.sfx);
setNarrationVolume(values.voice);

function save() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    } catch {
        // storage unavailable: the values still apply until the page is closed
    }
}

/** Volume for sound effects, 0 to 1. */
export function getSfxVolume() {
    return values.sfx;
}

// ---- The button ----
/** @type {import("kaplay").GameObj | null} */
let settingsButton = null;

/** Adds the SETTINGS button to the current scene (top right). */
export function addSettingsButton() {
    settingsButton = addButton(
        BUTTON_LABEL,
        vec2(width() - BUTTON_MARGIN.x, BUTTON_MARGIN.y),
        null,
        openSettings,
        { z: UI_Z - 100, sound: "open" },
    );
    return settingsButton;
}

/**
 * True when a click should not reach the game: the overlay is open, or the mouse is on the
 * SETTINGS button. Scenes with "click anywhere" handlers check this first.
 */
export function settingsBlocksInput() {
    return isInputLocked() || (settingsButton?.exists() && settingsButton.isHovering()) === true;
}

// ---- The overlay ----
function openSettings() {
    if (isInputLocked()) return;
    lockInput();

    const middle = center();
    /**
     * Adds one piece of the overlay.
     * @param {import("kaplay").Comp[]} comps
     * @returns {import("kaplay").GameObj<any>}
     */
    const ui = (comps) => add([...comps, fixed(), z(UI_Z), TAG]);

    // Dark sheet over the game, then the panel
    ui([rect(width(), height()), color(0, 0, 0), opacity(DIM)]);
    ui([
        rect(PANEL_SIZE.x, PANEL_SIZE.y, { radius: 12 }),
        pos(middle),
        anchor("center"),
        color(0, 0, 0),
        outline(6, rgb(255, 255, 255)),
    ]);
    ui([
        text("SETTINGS", { font: GAME_FONT, size: 48 }),
        pos(middle.x, middle.y - PANEL_SIZE.y / 2 + 60),
        anchor("center"),
        color(255, 255, 255),
    ]);

    // One row per slider: label, track, knob, percentage
    const left = middle.x - SLIDER_WIDTH / 2 + 30; // x of the track's left end
    const rows = SLIDERS.map((slider, i) => {
        const y = middle.y + ROW_Y[i];
        ui([text(slider.label, { font: GAME_FONT, size: 32 }), pos(left - 30, y), anchor("right"), color(255, 255, 255)]);
        ui([rect(SLIDER_WIDTH, SLIDER_HEIGHT, { radius: 5 }), pos(left, y), anchor("left"), color(255, 255, 255), opacity(0.35)]);
        const fill = ui([rect(1, SLIDER_HEIGHT, { radius: 5 }), pos(left, y), anchor("left"), color(255, 255, 255)]);
        const knob = ui([rect(KNOB_SIZE.x, KNOB_SIZE.y, { radius: 6 }), pos(left, y), anchor("center"), color(255, 255, 255)]);
        const percent = ui([text("", { font: GAME_FONT, size: 28 }), pos(left + SLIDER_WIDTH + 30, y), anchor("left"), color(255, 255, 255)]);

        function show() {
            const v = values[slider.key];
            fill.width = Math.max(1, SLIDER_WIDTH * v);
            knob.pos.x = left + SLIDER_WIDTH * v;
            percent.text = `${Math.round(v * 100)}`;
        }
        show();
        return { slider, y, show };
    });

    // Dragging: press on a row to grab it, then the knob follows the mouse until release
    /** @type {typeof rows[number] | null} */
    let dragging = null;
    const drag = onUpdate(() => {
        const mouse = mousePos();
        if (isMousePressed()) {
            dragging = rows.find((row) =>
                Math.abs(mouse.y - row.y) <= SLIDER_GRAB_HEIGHT / 2
                && mouse.x >= left - KNOB_SIZE.x && mouse.x <= left + SLIDER_WIDTH + KNOB_SIZE.x) ?? null;
        }
        if (dragging && isMouseDown()) {
            const v = Math.min(1, Math.max(0, (mouse.x - left) / SLIDER_WIDTH));
            values[dragging.slider.key] = v;
            dragging.slider.apply(v);
            dragging.show();
        } else if (dragging) {
            dragging = null;
            save();
            playSfx("slider"); // a sample at the new level (silent if SFX is at 0)
        }
    });

    const closeButton = addButton(
        "CLOSE",
        vec2(middle.x, middle.y + PANEL_SIZE.y / 2 - 70),
        null,
        close,
        { z: UI_Z, modal: true, sound: "close" },
    );
    closeButton.use(fixed());
    closeButton.use(TAG);

    const escape = onKeyPress("escape", () => {
        playSfx("close");
        close();
    });
    // If the scene changes underneath the overlay (e.g. a fade finishing), don't leave input locked
    const leave = onSceneLeave(() => finish());

    let closed = false;
    function finish() {
        if (closed) return;
        closed = true;
        drag.cancel();
        escape.cancel();
        leave.cancel();
        destroyAll(TAG);
        save();
        unlockInput();
    }
    function close() {
        // Unlock on the next frame, so the click on CLOSE can't also reach the game underneath
        get(TAG).forEach((obj) => (obj.hidden = true));
        wait(0, finish);
    }
}
