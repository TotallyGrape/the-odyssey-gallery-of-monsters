// Decode once so looping does not reload the music file.
const TRACKS = {
    menu: "assets/mysteriousadventure.wav",
    story: "assets/rising action.wav",
    giantsScylla: "assets/GiantsScy.wav",
    cyclops: "assets/cyclops.wav",
};

/** @type {import("kaplay").AudioPlay | undefined} */
let currentMusic;
let musicVolume = 0.5; // 0 to 1; set from the settings overlay
let duck = 1;          // 0 to 1; the narrator lowers this while speaking (src/narration.js)

/**
 * Sets the music volume, for the track playing now and every track after it.
 * @param {number} volume 0 (silent) to 1 (full)
 */
export function setMusicVolume(volume) {
    musicVolume = volume;
    if (currentMusic) currentMusic.volume = musicVolume * duck;
}

/**
 * Turns the music down (or back up) without changing the volume setting.
 * @param {number} factor 1 = the set volume, 0.4 = 40% of it
 */
export function setMusicDuck(factor) {
    duck = factor;
    if (currentMusic) currentMusic.volume = musicVolume * duck;
}

export function loadMusicTracks() {
    for (const [name, file] of Object.entries(TRACKS)) {
        loadSound(`music:${name}`, file);
    }
}

/** Play a looping track until this scene ends.
 * @param {keyof typeof TRACKS} name
 */
export function playSceneMusic(name) {
    currentMusic?.stop();
    const track = play(`music:${name}`, { loop: true, volume: musicVolume * duck });
    currentMusic = track;
    onSceneLeave(() => {
        track.stop();
        if (currentMusic === track) currentMusic = undefined;
    });
}
