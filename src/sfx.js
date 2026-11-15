// Sound effects, synthesised in the browser with the ZzFX library (no sound files needed).
//
// Usage:
//   playSfx("click");       play a sound by name
//   setSfxVolume(0.5);      0 (silent) to 1 (full); the settings overlay's SFX slider calls this
//
// To add a sound: add a line to SOUNDS below. To tune one: change its numbers.
// A sound designer for these numbers is at https://killedbyapixel.github.io/ZzFX/

// @ts-ignore - zzfx ships without type definitions
import { ZZFX } from "zzfx";

const MASTER_VOLUME = 0.35; // loudness of all effects when the SFX slider is at full
const MIN_GAP = 0.03;       // seconds: the same sound won't restart sooner than this (stops machine-gun stacking)

// Wave shapes
const SINE = 0, TRIANGLE = 1, SAW = 2, NOISE = 4;

/**
 * One synthesised tone. Only the listed fields matter; anything left out is 0.
 * @typedef {Object} Tone
 * @property {number} freq      pitch in Hz
 * @property {number} [volume]  0-1 (default 1)
 * @property {number} [attack]  seconds to fade in
 * @property {number} [sustain] seconds held
 * @property {number} [release] seconds to fade out
 * @property {number} [shape]   SINE, TRIANGLE, SAW or NOISE
 * @property {number} [slide]   pitch bend: positive rises, negative falls
 * @property {number} [jump]    Hz the pitch jumps by, part-way through
 * @property {number} [jumpAt]  seconds until that jump
 * @property {number} [noise]   0-1 roughness mixed in
 * @property {number} [random]  0-1 random pitch variation each time it plays
 * @property {number} [delay]   seconds to wait before this tone (for little melodies)
 */

/** Every sound in the game: a name and the tone (or tones, played together/in sequence) that make it. */
const SOUNDS = /** @type {Record<string, Tone[]>} */ ({
    // ---- Interface ----
    hover: [{ freq: 720, volume: 0.35, sustain: 0.01, release: 0.04, shape: SINE }],
    click: [{ freq: 440, volume: 0.7, sustain: 0.02, release: 0.08, shape: TRIANGLE, jump: 220, jumpAt: 0.03 }],
    back: [{ freq: 440, volume: 0.6, sustain: 0.02, release: 0.1, shape: TRIANGLE, jump: -150, jumpAt: 0.03 }],
    open: [{ freq: 330, volume: 0.6, sustain: 0.04, release: 0.12, shape: TRIANGLE, slide: 4 }],
    close: [{ freq: 520, volume: 0.6, sustain: 0.04, release: 0.12, shape: TRIANGLE, slide: -4 }],
    slider: [{ freq: 600, volume: 0.5, sustain: 0.02, release: 0.06, shape: SINE }],

    // ---- Text ----
    type: [{ freq: 900, volume: 0.18, sustain: 0.005, release: 0.015, shape: SINE, random: 0.08 }],
    page: [{ freq: 520, volume: 0.45, sustain: 0.02, release: 0.08, shape: SINE, jump: 130, jumpAt: 0.04 }],

    // ---- Fighting ----
    hit: [ // the enemy takes damage: a sharp crack
        { freq: 320, volume: 0.9, sustain: 0.02, release: 0.14, shape: SAW, slide: -10, noise: 0.6, random: 0.1 },
    ],
    hurt: [ // the player takes damage: a low thud
        { freq: 95, volume: 1, attack: 0.005, sustain: 0.06, release: 0.28, shape: NOISE, slide: -1.5, random: 0.1 },
        { freq: 70, volume: 0.8, sustain: 0.05, release: 0.25, shape: SINE, slide: -1 },
    ],

    // ---- Endings ----
    victory: [ // a rising four-note fanfare
        { freq: 523, volume: 0.7, sustain: 0.1, release: 0.15, shape: TRIANGLE },
        { freq: 659, volume: 0.7, sustain: 0.1, release: 0.15, shape: TRIANGLE, delay: 0.16 },
        { freq: 784, volume: 0.7, sustain: 0.1, release: 0.15, shape: TRIANGLE, delay: 0.32 },
        { freq: 1047, volume: 0.8, sustain: 0.25, release: 0.6, shape: TRIANGLE, delay: 0.48 },
    ],
    death: [ // a slow falling tone
        { freq: 196, volume: 0.9, attack: 0.02, sustain: 0.3, release: 1.1, shape: SAW, slide: -0.7 },
        { freq: 98, volume: 0.8, attack: 0.02, sustain: 0.4, release: 1.2, shape: SINE, slide: -0.3 },
    ],
});

/** @typedef {"hover" | "click" | "back" | "open" | "close" | "slider" | "type" | "page" | "hit" | "hurt" | "victory" | "death"} SfxName */

let sfxVolume = 0.5;
/** @type {Record<string, number>} when each sound last started, in seconds */
const lastPlayed = {};

// Browsers keep audio switched off until the player first clicks or presses a key
function wakeAudio() {
    if (ZZFX.audioContext.state === "suspended") ZZFX.audioContext.resume();
}
window.addEventListener("pointerdown", wakeAudio);
window.addEventListener("keydown", wakeAudio);

/**
 * Sets the volume of all sound effects.
 * @param {number} volume 0 (silent) to 1 (full)
 */
export function setSfxVolume(volume) {
    sfxVolume = volume;
}

/**
 * Plays a sound effect by name.
 * @param {SfxName} name
 */
export function playSfx(name) {
    if (sfxVolume <= 0 || ZZFX.audioContext.state !== "running") return;
    const now = ZZFX.audioContext.currentTime;
    if (now - (lastPlayed[name] ?? -1) < MIN_GAP) return;
    lastPlayed[name] = now;

    ZZFX.volume = MASTER_VOLUME * sfxVolume;
    for (const tone of SOUNDS[name]) {
        // ZzFX takes its settings as one long list, in this fixed order
        const play = () => ZZFX.play(
            tone.volume ?? 1, tone.random ?? 0, tone.freq,
            tone.attack ?? 0, tone.sustain ?? 0, tone.release ?? 0.1,
            tone.shape ?? SINE, 1, tone.slide ?? 0, 0,
            tone.jump ?? 0, tone.jumpAt ?? 0, 0, tone.noise ?? 0,
        );
        if (tone.delay) setTimeout(play, tone.delay * 1000);
        else play();
    }
}
