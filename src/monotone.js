// Whole-screen monotone effect: every pixel keeps its brightness but takes one colour,
// so white becomes the chosen colour and black stays black.
//
// Usage (after kaplay() has run):
//   loadMonotone();                    once, with the other load calls
//   setMonotone(rgb(90, 150, 255));    tint the whole screen blue
//   setMonotone(rgb(255, 80, 80), 0.5) half-strength red
//   clearMonotone();                   back to normal colours

const SHADER_NAME = "monotone";

const FRAGMENT = `
uniform vec3 u_tint;    // the single colour, 0-255 per channel (how KAPLAY sends a Color)
uniform float u_amount; // 0 = normal colours, 1 = fully monotone

vec4 frag(vec2 pos, vec2 uv, vec4 color, sampler2D tex) {
    vec4 c = def_frag();
    float brightness = dot(c.rgb, vec3(0.299, 0.587, 0.114));
    return vec4(mix(c.rgb, u_tint / 255.0 * brightness, u_amount), c.a);
}
`;

/** Loads the shader. Call once, next to the other load functions. */
export function loadMonotone() {
    loadShader(SHADER_NAME, undefined, FRAGMENT);
}

/**
 * Turns the whole screen into shades of one colour. Can be called again at any time to change it.
 * @param {import("kaplay").Color} tint
 * @param {number} [amount] 0 to 1: how strongly the effect replaces the normal colours
 */
export function setMonotone(tint, amount = 1) {
    usePostEffect(SHADER_NAME, () => ({
        u_tint: tint,
        u_amount: amount,
    }));
}

/** Removes the effect. */
export function clearMonotone() {
    setMonotone(rgb(255, 255, 255), 0);
}
