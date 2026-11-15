// Story transitions: a heading and a few short pages of text, shown between levels.
//
// Usage (after kaplay() has run):
//   addStoryScene();                       once: registers the "story" scene
//   showStory(story, () => go("battle"));  show a story, then run the callback after its last page
//
// A story is { title, pages }. Each page types itself out; a click or SPACE finishes the page,
// and another moves to the next one. Don't use square brackets in pages: KAPLAY reads them as style tags.

import { addGameBorder } from "./border.js";
import { GAME_FONT, addTitle } from "./font.js";

/** @typedef {{ title: string, pages: string[] }} Story */

// ---- Settings ----
const TITLE_SIZE = 72;
const TITLE_Y = 150;
const TEXT_SIZE = 34;
const TEXT_WIDTH = 920;      // pages wrap at this width
const TEXT_Y = 390;          // centre of the page text
const ROLL_INTERVAL = 0.025; // seconds per letter
const INPUT_DELAY = 0.3;     // ignore input briefly, so the click that opened the story doesn't skip a page
const HINT = "click or press space";
const HINT_SIZE = 22;

/** Registers the "story" scene. */
export function addStoryScene() {
    scene("story", (/** @type {Story} */ story, /** @type {() => void} */ onDone) => {
        add([rect(width(), height()), color(0, 0, 0)]);
        addGameBorder();
        addTitle(story.title, TITLE_SIZE, vec2(width() / 2, TITLE_Y));

        let pageIndex = 0;
        let lettersShown = 0;
        let rolling = false;

        const page = add([
            text("", {
                font: GAME_FONT,
                size: TEXT_SIZE,
                width: TEXT_WIDTH,
                align: "center",
                lineSpacing: 10,
                // letters past lettersShown are invisible, which gives the typewriter effect
                transform: (idx) => ({ opacity: idx < lettersShown ? 1 : 0 }),
            }),
            pos(width() / 2, TEXT_Y),
            anchor("center"),
            color(255, 255, 255),
        ]);

        // "page 2 / 3" style progress plus the hint, bottom centre
        const hint = add([
            text("", { font: GAME_FONT, size: HINT_SIZE }),
            pos(width() / 2, height() - 60),
            anchor("center"),
            color(255, 255, 255),
            opacity(0.6),
        ]);

        function showPage() {
            page.text = story.pages[pageIndex];
            hint.text = `${pageIndex + 1} / ${story.pages.length}   ${HINT}`;
            lettersShown = 0;
            rolling = true;
        }

        // Type the current page out
        loop(ROLL_INTERVAL, () => {
            if (!rolling) return;
            lettersShown++;
            if (lettersShown >= page.text.length) rolling = false;
        });

        function advance() {
            if (time() - startedAt < INPUT_DELAY) return;
            if (rolling) {
                // first press: show the whole page at once
                rolling = false;
                lettersShown = page.text.length;
            } else if (pageIndex < story.pages.length - 1) {
                pageIndex++;
                showPage();
            } else {
                onDone();
            }
        }

        const startedAt = time();
        onKeyPress("space", advance);
        onClick(advance);
        showPage();
    });
}

/**
 * Shows a story, then calls onDone after the last page.
 * @param {Story} story
 * @param {() => void} onDone
 */
export function showStory(story, onDone) {
    go("story", story, onDone);
}
