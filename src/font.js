// The one place the game's font is chosen. Every piece of text uses GAME_FONT.
// To change the font: put the new file in public/fonts/ and change FONT_FILE below.

const FONT_FILE = "fonts/MountOlympus.otf"; // relative to the public/ folder
// Previous font: "fonts/Romanica.ttf" (dafont.com/romanica.font, free for personal use only)

/** The name to pass as `font` to text() and formatText(). */
export const GAME_FONT = "game";

/** Loads the font. Call once after kaplay(), with the other load functions. */
export function loadGameFont() {
    loadFont(GAME_FONT, FONT_FILE);
}
