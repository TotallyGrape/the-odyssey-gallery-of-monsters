// The game's link to the AI endpoints on the dev server (server/ai.js).
//
//   requestTurn(...)    Gemini narrates the turn just played and offers the next FIGHT / FLEE options
//   requestSpeech(...)  Gemini reads the player's typed words as one of the boss's moves
//
// Both return null if the AI can't be reached or answers badly. The caller then carries on
// with the game's own plain text and menus, so a fight never gets stuck.

const TIMEOUT = 22000; // milliseconds; the server already retries once within this

// Set when the endpoints turn out not to exist at all (e.g. the game was built and uploaded
// somewhere without the dev server). After that the game stops asking.
let missing = false;

/**
 * @param {string} route
 * @param {object} body
 * @returns {Promise<any | null>}
 */
async function post(route, body) {
    if (missing) return null;
    try {
        const response = await fetch(route, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(TIMEOUT),
        });
        const isJson = (response.headers.get("Content-Type") ?? "").includes("application/json");
        if (!response.ok || !isJson) {
            if (response.status === 404 || response.status === 405 || (response.ok && !isJson)) missing = true;
            return null;
        }
        return await response.json();
    } catch {
        return null;
    }
}

/**
 * @typedef {Object} LastTurn  the turn that was just played
 * @property {import("./encounter.js").Action} action
 * @property {string} move
 * @property {string} [label]     the option's label, when a button was picked
 * @property {string} [tier]
 * @property {string} [said]      the player's words, when they were typed
 * @property {string} [quality]
 * @property {string} text        the engine's plain account of the result
 * @property {number} damageDealt
 * @property {number} hpLost
 * @property {import("./encounter.js").Outcome} outcome
 */

/** @typedef {{ did: string, told: string }} HistoryTurn */

/**
 * Asks for the narration of a turn and the options for the next one.
 * @param {{ boss: string, state: import("./encounter.js").BattleState, history: HistoryTurn[], last: LastTurn | null }} request
 *   `last` is null at the start of a fight, which asks for the opening instead
 * @returns {Promise<{ narration: string, fight: unknown, flee: unknown } | null>}
 */
export async function requestTurn(request) {
    const answer = await post("api/turn", request);
    return answer && typeof answer.narration === "string" && answer.narration ? answer : null;
}

/**
 * Asks which move the player's typed words amount to, and how good the idea was.
 * @param {{ boss: string, state: import("./encounter.js").BattleState, history: HistoryTurn[], text: string }} request
 * @returns {Promise<{ move: string, quality: string } | null>}
 */
export async function requestSpeech(request) {
    const answer = await post("api/speak", request);
    return answer && typeof answer.move === "string" ? answer : null;
}
