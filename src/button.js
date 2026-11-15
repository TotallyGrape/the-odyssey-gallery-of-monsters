

import { GAME_FONT } from "./font.js";
import { isInputLocked } from "./inputLock.js";
import { playSfx } from "./sfx.js";

const BUTTON_FONT = GAME_FONT;
const BUTTON_TEXT_SIZE = 36;
// Plain numbers here, not vec2(): this file is imported before kaplay() has run
const BUTTON_PADDING = { x: 48, y: 28 };   // extra room around the text when auto-sizing (total, both sides)
const BUTTON_MIN_SIZE = { x: 128, y: 64 }; // auto-sized buttons are never smaller than this

/**
 * Adds a clickable button, centred on `p`.
 * @param {string} txt text on the button
 * @param {import("kaplay").Vec2} p centre of the button
 * @param {import("kaplay").Vec2 | null} s size of the button; pass null to fit the size to the text
 * @param {() => void} f called when the button is clicked
 * @param {{ fill?: number[], text?: number[], z?: number, modal?: boolean, sound?: import("./sfx.js").SfxName }} [colors] options:
 *   fill / text - button and text colours as [r, g, b]; white with black text if left out
 *   z           - draw order; higher is on top
 *   modal       - true for buttons that belong to an overlay: they keep working while input is locked
 *   sound       - sound played on click; "click" if left out
 */
export function addButton(
    txt = "start game",
    p = vec2(200, 100),
    s = null,
    f = () => debug.log("hello"),
    colors = {},
) {
    const fill = colors.fill ?? [255, 255, 255];
    const ink = colors.text ?? [0, 0, 0];
    // While an overlay is open (src/inputLock.js), ordinary buttons ignore the mouse
    const blocked = () => isInputLocked() && !colors.modal;

    // No size given: measure the text and wrap the button around it
    if (!s) {
        const measured = formatText({ text: txt, font: BUTTON_FONT, size: BUTTON_TEXT_SIZE });
        s = vec2(
            Math.max(BUTTON_MIN_SIZE.x, measured.width + BUTTON_PADDING.x),
            Math.max(BUTTON_MIN_SIZE.y, measured.height + BUTTON_PADDING.y),
        );
    }

    // add a parent background object
    const btn = add([
        rect(s.x, s.y, { radius: 8 }),
        pos(p),
        area(),
        scale(1),
        rotate(0), // gives the button an angle we can animate
        anchor("center"),
        outline(4, rgb(ink[0], ink[1], ink[2])),
        color(fill[0], fill[1], fill[2]),
        z(colors.z ?? 0),
    ]);

    // add a child object that displays the text
    btn.add([
        text(txt, {
            font: BUTTON_FONT,
            size: BUTTON_TEXT_SIZE,
        }),
        
        anchor("center"),
        color(ink[0], ink[1], ink[2]),
    ]);

    // onHoverUpdate() comes from area() component
    // it runs every frame when the object is being hovered
    btn.onHoverUpdate(() => {
        if (blocked()) {
            btn.scale = vec2(1);
            btn.angle = 0;
            return;
        }
        // rock gently back and forth: sin() swings between -1 and 1 over time
        // 4 = speed of the wobble, 5 = max tilt in degrees
        btn.angle = Math.sin(time() * 4) * 5;
        btn.scale = vec2(1.2);
        setCursor("pointer");
    });

    // onHoverEnd() comes from area() component
    // it runs once when the object stopped being hovered
    btn.onHoverEnd(() => {
        btn.scale = vec2(1);
        btn.angle = 0; // straighten back up
    });

    // onClick() comes from area() component
    // it runs once when the object is clicked
    btn.onHover(() => {
        if (!blocked()) playSfx("hover");
    });

    btn.onClick(() => {
        if (blocked()) return;
        playSfx(colors.sound ?? "click");
        f();
    });

    return btn;
}