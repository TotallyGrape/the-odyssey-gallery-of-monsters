// The death and victory screens.
//
// Usage (after kaplay() has run):
//   addEndScreens(onContinue);          once: registers the "death" and "victory" scenes
//   fadeToEndScreen("death");           from a battle: fade the screen out, then show the screen
//
// Colours here are plain black and white; the monotone shader turns white into the game's colour.

import { addButton } from "./button.js";
import { addGameBorder } from "./border.js";
import { playSfx } from "./sfx.js";
import { GAME_FONT, addTitle } from "./font.js";
import { narrate } from "./narration.js";
import { addSettingsButton } from "./settings.js";

/** @typedef {"death" | "victory"} EndKind */

// ---- Settings ----
const FADE_OUT_TIME = 1.2;  // seconds for the battle to fade to black / white
const HOLD_TIME = 0.4;      // seconds the screen stays blank before the title starts to appear
const TITLE_FADE_TIME = 2;  // seconds for the title to go from invisible to fully visible
const TITLE_SIZE = 120;
const LINE_SIZE = 30;        // the narrator's line under the title
const LINE_OFFSET = 110;     // how far below the title's centre it sits
const BUTTON_LABEL = "CONTINUE";
const BUTTON_MARGIN = { x: 150, y: 80 }; // button centre, measured from the bottom-right corner

const BLACK = [0, 0, 0];
const WHITE = [255, 255, 255];

/** How each screen looks. The button is the opposite of the background so it stands out. `line` is read aloud by the narrator. */
const SCREENS = {
    death: { title: "YOU DIED", line: "Odysseus falls. The Muse begins the verse again.", background: BLACK, text: WHITE, button: { fill: WHITE, text: BLACK } },
    victory: { title: "VICTORY", line: "The monster is behind you. The sea road opens once more.", background: WHITE, text: BLACK, button: { fill: BLACK, text: WHITE } },
};

/**
 * Registers the "death" and "victory" scenes.
 * @param {(kind: EndKind) => void} onContinue called when the CONTINUE button is clicked
 */
export function addEndScreens(onContinue) {
    for (const kind of /** @type {EndKind[]} */ (["death", "victory"])) {
        const look = SCREENS[kind];
        scene(kind, () => {
            playSfx(kind); // the "death" and "victory" sounds share the screens' names
            add([rect(width(), height()), color(look.background[0], look.background[1], look.background[2])]);
            addGameBorder();
            addSettingsButton();

            const title = addTitle(look.title, TITLE_SIZE, center(), look.text);
            title.opacity = 0;
            const line = add([
                text(look.line, { font: GAME_FONT, size: LINE_SIZE }),
                pos(center().x, center().y + LINE_OFFSET),
                anchor("center"),
                color(look.text[0], look.text[1], look.text[2]),
                opacity(0),
            ]);

            // Blank screen for a moment, then the title fades in, then the button appears
            wait(HOLD_TIME, () => {
                narrate(look.line, { afterCurrent: true }); // lets the fight's last line finish first
                tween(0, 1, TITLE_FADE_TIME, (v) => {
                    title.opacity = v;
                    line.opacity = v * 0.8;
                }).onEnd(() => {
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
