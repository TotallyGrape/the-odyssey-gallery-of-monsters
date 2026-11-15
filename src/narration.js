// The narrator's voice. Text is sent to the dev server, which has ElevenLabs speak it (server/ai.js).
//
// Usage:
//   narrate("The cave is sealed.");          speak a line now, replacing whatever was being said
//   narrate(line, { afterCurrent: true });   speak it once the current line has finished
//   const voice = await prepareNarration(line);   load a line first, to start it in step with its text:
//   voice?.play();                                voice.duration is its length in seconds
//   preloadNarration(line);                  fetch a line early so it starts without a pause later
//   stopNarration();
//   whenNarrationDone().then(...)            runs once the narrator has stopped speaking (at once, if silent)
//   setNarrationVolume(0.8);                 0 (silent) to 1 (full); the settings overlay's VOICE slider calls this
//
// Everything here fails quietly: if a line can't be spoken, the game simply carries on in silence.

import { cleanText } from "./encounter.js";
import { setMusicDuck } from "./music.js";

const TEXT_MAX = 700;        // longest line sent for speech (the server's limit)
const FETCH_TIMEOUT = 25000; // milliseconds
const MUSIC_WHILE_SPEAKING = 0.4; // the music drops to this fraction of its volume under the voice

let volume = 0.9;
let missing = false; // true once the speech endpoint turns out not to exist at all

/** @type {Map<string, Promise<string | null>>} line -> address of its audio (or null if it couldn't be fetched) */
const lines = new Map();

/** @type {HTMLAudioElement | null} */
let current = null;
let request = 0; // goes up with every narrate/stop, so an older line that loads late knows not to play
/** @type {(() => void)[]} */
let waiting = []; // callers of whenNarrationDone(), told when the current line ends or is stopped

/** The current line is over (it ended, or was cut off): bring the music back and tell anyone waiting. */
function release() {
    current = null;
    setMusicDuck(1);
    const told = waiting;
    waiting = [];
    for (const tell of told) tell();
}

/**
 * Resolves when the narrator is no longer speaking: straight away if silent, otherwise when the
 * current line finishes or is stopped.
 * @returns {Promise<void>}
 */
export function whenNarrationDone() {
    if (!current || current.ended) return Promise.resolve();
    return new Promise((resolve) => waiting.push(resolve));
}

/**
 * Sets the narrator's volume.
 * @param {number} v 0 (silent) to 1 (full)
 */
export function setNarrationVolume(v) {
    volume = Math.min(1, Math.max(0, v));
    if (current) current.volume = volume;
}

/**
 * Fetches a line's audio (once; later calls reuse it).
 * @param {string} line
 * @returns {Promise<string | null>} an address an <audio> element can play
 */
export function preloadNarration(line) {
    const text = cleanText(line, TEXT_MAX);
    if (!text || missing) return Promise.resolve(null);
    const known = lines.get(text);
    if (known) return known;

    const loading = (async () => {
        try {
            const response = await fetch("api/narrate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text }),
                signal: AbortSignal.timeout(FETCH_TIMEOUT),
            });
            const type = response.headers.get("Content-Type") ?? "";
            if (!response.ok || !type.startsWith("audio/")) {
                if (response.status === 404 || response.status === 405 || response.ok) missing = true;
                return null;
            }
            return URL.createObjectURL(await response.blob());
        } catch {
            return null;
        }
    })();
    lines.set(text, loading);
    // A line that failed for a passing reason may be tried again later
    loading.then((address) => {
        if (address === null && lines.get(text) === loading) lines.delete(text);
    });
    return loading;
}

/** Stops the line being spoken, if any. */
export function stopNarration() {
    request++;
    silence();
}

function silence() {
    if (!current) return;
    current.pause();
    current.onended = null;
    release();
}

/**
 * Starts an audio element as the current line.
 * @param {HTMLAudioElement} audio
 */
function start(audio) {
    silence();
    current = audio;
    audio.volume = volume;
    audio.onended = () => {
        if (current === audio) release();
    };
    setMusicDuck(MUSIC_WHILE_SPEAKING);
    audio.play().catch(() => {
        // the browser refused (no click yet, or the tab is hidden): stay silent
        if (current === audio) silence();
    });
}

/**
 * Loads a line fully, so it can be started at a chosen moment and its length is known.
 * Does not interrupt the line being spoken; that happens when play() is called.
 * @param {string} line
 * @param {number} [patience] milliseconds to wait before giving up on the voice for this line
 * @returns {Promise<{ duration: number, play: () => void } | null>} null if the line can't be spoken
 */
export async function prepareNarration(line, patience = 8000) {
    const mine = ++request;
    const address = await Promise.race([
        preloadNarration(line),
        new Promise((resolve) => setTimeout(() => resolve(null), patience)),
    ]);
    if (typeof address !== "string") return null;

    const audio = new Audio(address);
    audio.preload = "auto";
    const ready = await new Promise((resolve) => {
        audio.onloadedmetadata = () => resolve(true);
        audio.onerror = () => resolve(false);
        setTimeout(() => resolve(false), 4000);
    });
    audio.onloadedmetadata = null;
    audio.onerror = null;
    if (!ready) return null;

    return {
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
        play: () => {
            if (mine === request) start(audio); // unless something newer was asked for meanwhile
        },
    };
}

/**
 * Speaks a line as soon as it is loaded.
 * @param {string} line
 * @param {{ afterCurrent?: boolean }} [options] afterCurrent: let the line being spoken finish first
 */
export function narrate(line, options = {}) {
    const mine = ++request;
    const before = options.afterCurrent ? whenNarrationDone() : Promise.resolve();
    if (!options.afterCurrent) silence();

    preloadNarration(line).then((address) => {
        if (address === null || mine !== request) return;
        const audio = new Audio(address);
        before.then(() => {
            if (mine === request) start(audio);
        });
    });
}
