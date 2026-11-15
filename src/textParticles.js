import { GAME_FONT } from "./font.js";
import { playSfx } from "./sfx.js";

// Text particles: short pieces of text that burst out, fall under gravity, fade and vanish.
// Used for damage numbers. All sizes and speeds are in game units.

const GRAVITY = 1400;         // downward pull on the text
const UP_SPEED_MIN = 380;     // each burst gets a random upward speed in this range...
const UP_SPEED_MAX = 560;
const SIDE_SPEED_MAX = 260;   // ...and a random sideways speed up to this, left or right
const LIFETIME = 1.1;         // seconds before the text is removed
const FADE_TIME = 0.35;       // the last part of the lifetime is spent fading out
const SPIN_MAX = 120;         // random spin, degrees per second either way

/**
 * Pops a piece of text out of a point with a random upward and sideways burst.
 * @param {string} message what to show, e.g. "-15"
 * @param {import("kaplay").Vec2} origin where it starts, in game coordinates
 * @param {{ size?: number, color?: import("kaplay").Color, font?: string }} [options]
 */
export function popText(message, origin, options = {}) {
    const size = options.size ?? 48;

    // Random burst: always upward, either side
    let velocity = vec2(rand(-SIDE_SPEED_MAX, SIDE_SPEED_MAX), -rand(UP_SPEED_MIN, UP_SPEED_MAX));
    const spin = rand(-SPIN_MAX, SPIN_MAX);
    let age = 0;

    const font = options.font ?? GAME_FONT;

    // The particle itself is a black copy of the text; the coloured text sits on top of it,
    // nudged up and left. The black edge keeps it readable over any background.
    const particle = add([
        text(message, { size, font }),
        pos(origin),
        anchor("center"),
        color(0, 0, 0),
        opacity(1),
        rotate(0),
        scale(1.4), // starts a little big, settles to normal size
        z(2000),    // in front of everything else
        "text_particle",
    ]);
    const shadowOffset = Math.max(2, size * 0.06);
    const face = particle.add([
        text(message, { size, font }),
        pos(-shadowOffset, -shadowOffset),
        anchor("center"),
        color(options.color ?? rgb(255, 255, 255)),
        opacity(1),
    ]);

    particle.onUpdate(() => {
        const step = dt();
        age += step;

        // gravity bends the path back down
        velocity = vec2(velocity.x, velocity.y + GRAVITY * step);
        particle.pos = particle.pos.add(velocity.scale(step));
        particle.angle += spin * step;
        particle.scale = vec2(Math.max(1, 1.4 - age * 2));

        // fade out at the end, then remove
        const remaining = LIFETIME - age;
        particle.opacity = Math.min(1, Math.max(0, remaining / FADE_TIME));
        face.opacity = particle.opacity;
        if (remaining <= 0) particle.destroy();
    });

    return particle;
}

/**
 * Damage feedback: one big number plus a few small bits bursting from the same spot.
 * @param {number} amount damage dealt
 * @param {import("kaplay").Vec2} origin where the hit landed, in game coordinates
 */
export function popDamage(amount, origin) {
    playSfx("hit");
    // bigger hits get bigger text, within limits
    const size = Math.min(96, 44 + amount * 0.6);
    popText(`-${amount}`, origin, { size });
    for (let i = 0; i < 4; i++) {
        popText("*", origin.add(rand(-20, 20), rand(-20, 20)), { size: size * 0.5, color: rgb(255, 200, 60) });
    }
}
