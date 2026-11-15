// The death and victory screens.
//
// Usage (after kaplay() has run):
//   addEndScreens(onContinue);          once: registers the "death" and "victory" scenes
//   fadeToEndScreen("death");           from a battle: fade the screen out, then show the screen
//
// Colours here are plain black and white; the monotone shader turns white into the game's colour.

import { addButton } from "./button.js";
import { addGameBorder } from "./border.js";
import { addTitle } from "./font.js";

/** @typedef {"death" | "victory"} EndKind */

// ---- Settings ----
const FADE_OUT_TIME = 1.2;  // seconds for the battle to fade to black / white
const HOLD_TIME = 0.4;      // seconds the screen stays blank before the title starts to appear
const TITLE_FADE_TIME = 2;  // seconds for the title to go from invisible to fully visible
const TITLE_SIZE = 120;
const BUTTON_LABEL = "CONTINUE";
const BUTTON_MARGIN = { x: 150, y: 80 }; // button centre, measured from the bottom-right corner

const BLACK = [0, 0, 0];
const WHITE = [255, 255, 255];

/** How each screen looks. The button is the opposite of the background so it stands out. */
const SCREENS = {
    death: { title: "YOU DIED", background: BLACK, text: WHITE, button: { fill: WHITE, text: BLACK } },
    victory: { title: "VICTORY", background: WHITE, text: BLACK, button: { fill: BLACK, text: WHITE } },
};

/**
 * Registers the "death" and "victory" scenes.
 * @param {(kind: EndKind) => void} onContinue called when the CONTINUE button is clicked
 */
export function addEndScreens(onContinue) {
    for (const kind of /** @type {EndKind[]} */ (["death", "victory"])) {
        const look = SCREENS[kind];
        scene(kind, () => {
            add([rect(width(), height()), color(look.background[0], look.background[1], look.background[2])]);
            addGameBorder();

            const title = addTitle(look.title, TITLE_SIZE, center(), look.text);
            title.opacity = 0;

            // Blank screen for a moment, then the title fades in, then the button appears
            wait(HOLD_TIME, () => {
                tween(0, 1, TITLE_FADE_TIME, (v) => (title.opacity = v)).onEnd(() => {
                    addButton(
                        BUTTON_LABEL,
                        vec2(width() - BUTTON_MARGIN.x, height() - BUTTON_MARGIN.y),
                        null,
                        () => onContinue(kind),
                        look.button,
                    );
                });
            });
        });
    }
}

/**
 * Fades the current scene to the end screen's background colour, then switches to that screen.
 * @param {EndKind} kind
 */
export function fadeToEndScreen(kind) {
    const bg = SCREENS[kind].background;
    const cover = add([
        rect(width(), height()),
        color(bg[0], bg[1], bg[2]),
        opacity(0),
        fixed(),
        z(2500), // above the battle, below the border
    ]);
    tween(0, 1, FADE_OUT_TIME, (v) => (cover.opacity = v)).onEnd(() => go(kind));
}
