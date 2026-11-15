// Feedback for when the player takes a hit: a small screen shake and a soft red flash.
// Kept deliberately gentle: one short fade (no strobing), low opacity, small shake.
// Lower the numbers further, or set them to 0, to switch an effect off.

const SHAKE_STRENGTH = 5;    // KAPLAY's default shake is 12; this is under half of that
const FLASH_OPACITY = 0.22;  // how red the screen gets at the peak (0 = nothing, 1 = solid red)
const FLASH_TIME = 0.45;     // seconds for the red to fade away

/**
 * Plays the "player got hit" effect.
 * @param {number} [strength] 1 = normal hit. Bigger hits can pass more, capped so it never gets harsh.
 */
export function playerHitEffect(strength = 1) {
    const amount = Math.min(strength, 1.5);

    shake(SHAKE_STRENGTH * amount);

    // Only one flash at a time, so repeated hits can't stack into something brighter
    for (const old of get("hit_flash")) old.destroy();

    const peak = FLASH_OPACITY * amount;
    let age = 0;
    const flash = add([
        rect(width(), height()),
        pos(0, 0),
        color(200, 0, 0),
        opacity(peak),
        fixed(),  // stays put while the camera shakes
        z(1500),  // above the scene, below damage text
        "hit_flash",
    ]);

    // Fade smoothly from the peak to nothing, then remove
    flash.onUpdate(() => {
        age += dt();
        flash.opacity = peak * Math.max(0, 1 - age / FLASH_TIME);
        if (age >= FLASH_TIME) flash.destroy();
    });
}
