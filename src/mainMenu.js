// The main menu: a looping video behind the game's title and a PLAY button.
//
// Usage (after kaplay() has run):
//   loadMainMenu();           once, with the other load functions
//   addMainMenu(onPlay);      once: registers the "menu" scene
//   go("menu");
//
// The video is drawn inside the game (each new video frame is copied onto a full-screen sprite),
// so it scales with the game at any window size and the monotone shader tints it like everything else.

import { addButton } from "./button.js";
import { addGameBorder } from "./border.js";
import { addTitle } from "./font.js";
import { playSceneMusic } from "./music.js";
import { addSettingsButton } from "./settings.js";

// ---- Settings ----
const VIDEO_FILE = "assets/menu.mp4"; // 1280x720, 30 fps, no sound (a light copy of the original)
const VIDEO_SIZE = { x: 1280, y: 720 };
const VIDEO_DARKEN = 0.45;            // 0 = video at full brightness, 1 = black. Keeps the text readable.

const TITLE = "THE ODYSSEY";
const SUBTITLE = "GALLERY OF MONSTERS";
const TITLE_SIZE = 110;
const SUBTITLE_SIZE = 44;
const TITLE_POS = { x: 800, y: 330 };    // centre of the title
const SUBTITLE_POS = { x: 800, y: 430 }; // centre of the subtitle
const PLAY_LABEL = "PLAY";
const PLAY_POS = { x: 240, y: 380 };     // centre of the PLAY button

const VIDEO_SPRITE = "menu_video";
/** @type {HTMLVideoElement} */
let video;

/** Starts loading the video and makes the sprite its frames are copied onto. */
export function loadMainMenu() {
    video = document.createElement("video");
    video.src = VIDEO_FILE;
    video.muted = true;       // browsers only let silent videos start on their own
    video.loop = true;
    video.playsInline = true; // stops phones from opening it full screen
    video.preload = "auto";

    // A blank picture the same size as the video; the video is drawn over it every frame
    const blank = document.createElement("canvas");
    blank.width = VIDEO_SIZE.x;
    blank.height = VIDEO_SIZE.y;
    // Frame uploads must not share a texture with static artwork.
    loadSprite(VIDEO_SPRITE, blank, { singular: true });
}

/**
 * Registers the "menu" scene.
 * @param {() => void} onPlay called when PLAY is clicked
 */
export function addMainMenu(onPlay) {
    scene("menu", () => {
        playSceneMusic("menu");
        // ---- Video background ----
        add([sprite(VIDEO_SPRITE), pos(0, 0)]);
        add([rect(width(), height()), color(0, 0, 0), opacity(VIDEO_DARKEN)]);

        const data = getSprite(VIDEO_SPRITE)?.data;
        video.currentTime = 0;
        video.play().catch(() => {}); // if the browser refuses, the menu simply has a dark background

        let lastTime = -1;
        onUpdate(() => {
            // Copy a frame only when the video has moved on to a new one
            if (!data || video.readyState < 2 || video.currentTime === lastTime) return;
            lastTime = video.currentTime;
            // The sprite lives somewhere inside a larger shared texture: frames[0] says where
            const where = data.frames[0];
            data.tex.update(video, Math.round(where.x * data.tex.width), Math.round(where.y * data.tex.height));
        });
        onSceneLeave(() => video.pause());

        // ---- Title and button ----
        addTitle(TITLE, TITLE_SIZE, vec2(TITLE_POS.x, TITLE_POS.y));
        addTitle(SUBTITLE, SUBTITLE_SIZE, vec2(SUBTITLE_POS.x, SUBTITLE_POS.y));
        addButton(PLAY_LABEL, vec2(PLAY_POS.x, PLAY_POS.y), null, onPlay);

        addSettingsButton();
        addGameBorder();
    });
}
