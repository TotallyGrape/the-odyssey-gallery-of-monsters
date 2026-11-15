// The one place the game's font is chosen. Every piece of text uses GAME_FONT, and big titles use addTitle().
// To change the font: put the new file in public/fonts/ and change FONT_FILE below.

const FONT_FILE = "fonts/MountOlympus.otf"; // relative to the public/ folder
// Previous font: "fonts/Romanica.ttf" (dafont.com/romanica.font, free for personal use only)

// KAPLAY draws each letter once at this size onto a shared sheet, then scales it to the size the
// text asks for. Close to the sizes normal text uses (24-48), so little scaling is needed.
const RASTER_SIZE = 48;

/** The name to pass as `font` to text() and formatText(). */
export const GAME_FONT = "game";

/** Loads the font. Call once after kaplay(), with the other load functions. */
export function loadGameFont() {
    loadFont(GAME_FONT, FONT_FILE, { size: RASTER_SIZE, filter: "linear" });
}

/**
 * Adds a large title, centred on its position.
 *
 * Big text drawn through KAPLAY's letter sheet picks up slivers of the neighbouring letters and
 * ragged edges. A title is instead drawn once by the browser, at its exact size, into its own
 * picture, which is then shown as a sprite.
 * @param {string} message
 * @param {number} size text size in game units
 * @param {import("kaplay").Vec2} at centre of the title
 * @param {number[]} [tint] colour as [r, g, b]; white if left out
 * @returns the title object: set its `opacity` to fade it
 */
export function addTitle(message, size, at, tint = [255, 255, 255]) {
    const name = `title:${size}:${message}`;
    if (!getSprite(name)) {
        const font = `${size}px "${GAME_FONT}"`;
        const pad = Math.ceil(size * 0.15); // room so no edge of a letter is cut off
        const canvas = document.createElement("canvas");
        const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
        ctx.font = font;
        const m = ctx.measureText(message);
        canvas.width = Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + pad * 2;
        canvas.height = Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + pad * 2;
        ctx.font = font; // resizing a canvas resets its settings
        ctx.fillStyle = "#ffffff"; // white, so color() can tint it
        ctx.fillText(message, pad + m.actualBoundingBoxLeft, pad + m.actualBoundingBoxAscent);
        loadSprite(name, canvas, { singular: true }); // its own texture, nothing nearby to bleed in
    }
    return add([sprite(name), pos(at), anchor("center"), color(tint[0], tint[1], tint[2]), opacity(1)]);
}
