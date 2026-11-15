// Generic boss-fight engine. It knows nothing about any particular boss:
// each boss is a data object (see src/bosses/) that lists its own moves and rules.
//
// A fight's state is a plain object of numbers. Every boss has `hp` (the player's health)
// and `damage` (total damage dealt to the boss), and may add its own, e.g. `courage`.
// On/off facts are stored as 0 or 1.
//
// The engine owns every number. The AI (src/ai.js) only decides how a turn is *presented*:
//   - FIGHT and FLEE: it offers a few options. Each option is a label, one of the boss's moves,
//     and a risk tier (TIERS below).
//   - SPEAK: the player types anything. The AI reads it as one of the boss's moves and judges
//     how good an idea it was (QUALITIES below). Each boss also has two open-ended moves, "ploy"
//     and "ward", so that any reasonable idea the player invents has a fixed, bounded effect.
// Either way the turn then runs here: the move changes the numbers, the boss hits back,
// and the engine checks whether the fight is over.
//
// This file and the boss files are also loaded by the dev server (server/ai.js),
// so they must not use any KAPLAY functions.

/** @typedef {Record<string, number>} BattleState */
/** @typedef {"fight" | "speak" | "flee"} Action */
/** @typedef {"continue" | "victory" | "death"} Outcome */

/**
 * How hard a move is played.
 * @typedef {Object} Grade
 * @property {number} power    scales what the move does (1 = normal)
 * @property {number} counter  scales how hard the boss hits back this turn (1 = normal)
 */

/** Risk tiers for the FIGHT and FLEE options. */
export const TIERS = /** @type {Record<string, Grade>} */ ({
    cautious: { power: 0.75, counter: 0.5 },
    steady: { power: 1, counter: 1 },
    reckless: { power: 1.5, counter: 1.75 },
});
/** @typedef {"cautious" | "steady" | "reckless"} Tier */

/** How good a typed SPEAK idea was. */
export const QUALITIES = /** @type {Record<string, Grade>} */ ({
    weak: { power: 0.5, counter: 1 },
    solid: { power: 1, counter: 1 },
    inspired: { power: 1.25, counter: 0.5 },
});
/** @typedef {"weak" | "solid" | "inspired"} Quality */

/**
 * What a move's run() returns.
 * @typedef {Object} MoveResult
 * @property {string} text                  plain account of what happened (used when the AI narrator is unavailable)
 * @property {"victory" | "death"} [outcome] set to end the fight here
 * @property {boolean} [counter]            false = the boss does not hit back this turn
 */

/**
 * One thing the player can do. Moves are the fixed rules; the AI only chooses how to dress them up.
 * @typedef {Object} Move
 * @property {Action} action                         which main button it belongs to
 * @property {string} label                          button text when the AI is unavailable
 * @property {string} hint                           what it does, in plain words, for the AI
 * @property {string[]} [keywords]                   words that pick this move from typed text when the AI is unavailable
 * @property {(s: BattleState) => boolean} [when]    available only while this is true (always, if left out)
 * @property {(s: BattleState) => boolean} [fatal]   true while playing this move kills the player
 * @property {(s: BattleState, g: Grade) => MoveResult} run  changes the state it is given and says what happened
 */

/**
 * @typedef {Object} Boss
 * @property {string} id                             short name used between the game and the server
 * @property {string} name
 * @property {string} sprite                         name of a loaded sprite
 * @property {{ title: string, pages: string[] }} story  shown before the fight (see src/transition.js)
 * @property {string} intro                          shown when the fight starts, if the AI is unavailable
 * @property {string} scene                          the brief that sets the scene for the AI narrator
 * @property {string} rules                          how the fight is won and lost, in words, for the AI
 * @property {BattleState} start                     starting numbers; must include hp and damage
 * @property {number} [bossHp]                       if set, reaching this much damage wins the fight
 * @property {string} victoryText                    shown when bossHp is reached
 * @property {string} hpDeath                        shown when the player's hp runs out
 * @property {(s: BattleState) => string} status     the status line at the top of the screen
 * @property {(s: BattleState) => string} describe   where the fight stands, in plain words, for the AI
 * @property {(s: BattleState, mult: number) => string} counter  the boss hits back: changes the state, returns the text
 * @property {Record<string, Move>} moves
 */

/** An option on a FIGHT or FLEE menu. */
/** @typedef {{ label: string, move: string, tier: Tier }} Option */

/** @typedef {{ state: BattleState, text: string, outcome: Outcome, damageDealt: number, hpLost: number }} TurnResult */

/** How much of the enemy's next hit gets through when the player has improvised some protection (state.ward). */
export const WARD_REDUCTION = 0.5;
/** How much harder the next attack lands after an improvised ploy (state.edge), for bosses that use it. */
export const EDGE_MULTIPLIER = 1.5;

/**
 * The open-ended defensive move every boss offers: any sensible way the player invents to blunt the
 * enemy's next blow. It sets state.ward, which resolveMove() spends on the next hit. On or off, so it can't be stacked.
 * @param {string} examples in-world examples for the AI, e.g. "overturn a table, douse the fire"
 * @param {string} text     plain account of it working
 * @returns {Move}
 */
export function wardMove(examples, text) {
    return {
        action: "speak",
        label: "Take Cover",
        hint: `OPEN-ENDED DEFENCE. Any other sensible, physically possible way to protect against the enemy's next blow that is not one of the listed moves (for example: ${examples}). `
            + `The enemy's next hit is reduced to ${WARD_REDUCTION * 100}%. On or off: it cannot be stacked. Fails if weak.`,
        keywords: ["cover", "shield", "block", "dodge", "barricade", "protect", "defend", "brace"],
        when: (s) => s.ward === 0,
        run: (s, g) => {
            if (steps(g.power) === 0) return { text: "It does little good." };
            s.ward = 1;
            return { text };
        },
    };
}

/** The move used when typed words fit nothing the boss allows: nothing happens, and the boss acts. */
export const NO_MOVE = "none";
/** @type {Move} */
const NOTHING = {
    action: "speak",
    label: "Hesitate",
    hint: "Nothing useful happens and the enemy acts.",
    run: () => ({ text: "Nothing comes of it." }),
};

/** Longest label that fits a menu button. */
export const LABEL_MAX = 22;

/**
 * Whole steps a graded move earns: 0 for a weak attempt, 1 normally, 2 for an inspired one.
 * @param {number} power
 */
export function steps(power) {
    return power >= 1.25 ? 2 : power >= 0.75 ? 1 : 0;
}

// Typographic characters the AI likes to use, given by character number so this file stays plain ASCII.
/** @param {number[]} codes */
const anyOf = (codes) => new RegExp(`[${codes.map((code) => String.fromCharCode(code)).join("")}]`, "g");
const ACCENTS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, "g");
const CURLY_SINGLE = anyOf([0x2018, 0x2019, 0x201a, 0x2032]);
const CURLY_DOUBLE = anyOf([0x201c, 0x201d, 0x201e, 0x2033]);
const DASHES = anyOf([0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2212]);

/**
 * Makes text safe to draw and to speak: plain ASCII on one line, with none of the characters
 * KAPLAY reads as style tags.
 * @param {unknown} value
 * @param {number} max longest result; longer text is cut at the end of a sentence or word
 */
export function cleanText(value, max) {
    let text = String(value ?? "")
        .normalize("NFKD")
        .replace(ACCENTS, "") // keep the plain letter
        .replace(CURLY_SINGLE, "'")
        .replace(CURLY_DOUBLE, '"')
        .replace(DASHES, "-")
        .replace(/[\[\]\\*_#`<>{}|~^]/g, "")
        .replace(/[^\x20-\x7E]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (text.length <= max) return text;
    text = text.slice(0, max);
    const sentenceEnd = Math.max(text.lastIndexOf(". "), text.lastIndexOf("! "), text.lastIndexOf("? "));
    if (sentenceEnd > max * 0.5) return text.slice(0, sentenceEnd + 1);
    const wordEnd = text.lastIndexOf(" ");
    return (wordEnd > 0 ? text.slice(0, wordEnd) : text).replace(/[,;:\-]$/, "").trim();
}

/**
 * Fresh state for the start of a fight.
 * @param {Boss} boss
 * @returns {BattleState}
 */
export function newBattleState(boss) {
    return { ...boss.start };
}

/**
 * Looks a move up by id.
 * @param {Boss} boss
 * @param {string} id
 * @returns {Move | undefined}
 */
export function getMove(boss, id) {
    if (id === NO_MOVE) return NOTHING;
    return Object.prototype.hasOwnProperty.call(boss.moves, id) ? boss.moves[id] : undefined;
}

/**
 * The moves the player could make right now.
 * @param {Boss} boss
 * @param {BattleState} state
 * @param {Action} [action] only moves of this main button; every move if left out
 * @returns {{ id: string, move: Move }[]}
 */
export function availableMoves(boss, state, action) {
    return Object.entries(boss.moves)
        .filter(([, move]) => (!action || move.action === action) && (!move.when || move.when(state)))
        .map(([id, move]) => ({ id, move }));
}

/**
 * True if this move can be played in this state.
 * @param {Boss} boss
 * @param {BattleState} state
 * @param {string} id
 */
export function isAvailable(boss, state, id) {
    if (id === NO_MOVE) return true;
    const move = getMove(boss, id);
    return !!move && (!move.when || move.when(state));
}

/**
 * The menu to show when the AI gave nothing usable: every available move, played steadily.
 * @param {Boss} boss
 * @param {BattleState} state
 * @param {Action} action
 * @returns {Option[]}
 */
export function fallbackOptions(boss, state, action) {
    return availableMoves(boss, state, action).slice(0, 3).map(({ id, move }) => ({ label: move.label, move: id, tier: "steady" }));
}

/**
 * Checks the options the AI offered against the rules and returns the ones that can be shown:
 * real moves of the right kind that are available now, no repeats, tidy labels, three at most.
 * Falls back to the plain menu if fewer than two survive.
 * @param {Boss} boss
 * @param {BattleState} state
 * @param {Action} action
 * @param {unknown} offered
 * @returns {Option[]}
 */
export function checkOptions(boss, state, action, offered) {
    /** @type {Option[]} */
    const options = [];
    const seen = new Set();
    const labels = new Set();
    for (const raw of Array.isArray(offered) ? offered : []) {
        if (!raw || typeof raw !== "object") continue;
        const id = String(raw.move ?? "");
        const tier = /** @type {Tier} */ (Object.prototype.hasOwnProperty.call(TIERS, raw.tier) ? raw.tier : "steady");
        const move = getMove(boss, id);
        if (id === NO_MOVE || !move || move.action !== action || !isAvailable(boss, state, id)) continue;
        const label = cleanText(raw.label, LABEL_MAX) || move.label;
        const key = `${id}:${tier}`;
        if (seen.has(key) || labels.has(label.toLowerCase())) continue;
        seen.add(key);
        labels.add(label.toLowerCase());
        options.push({ label, move: id, tier });
        if (options.length === 3) break;
    }
    if (options.length >= 2) return options;

    // Too few: top up with the plain versions of whatever else is available
    for (const plain of fallbackOptions(boss, state, action)) {
        const key = `${plain.move}:${plain.tier}`;
        if (seen.has(key) || labels.has(plain.label.toLowerCase())) continue;
        seen.add(key);
        labels.add(plain.label.toLowerCase());
        options.push(plain);
        if (options.length === 3) break;
    }
    return options;
}

/**
 * Reads typed words without the AI: the available move whose keywords appear most often.
 * @param {Boss} boss
 * @param {BattleState} state
 * @param {string} said
 * @returns {{ move: string, quality: Quality }}
 */
export function matchSpeech(boss, state, said) {
    const words = said.toLowerCase();
    let best = NO_MOVE;
    let bestScore = 0;
    for (const { id, move } of availableMoves(boss, state)) {
        const score = (move.keywords ?? []).filter((word) => words.includes(word)).length;
        if (score > bestScore) {
            best = id;
            bestScore = score;
        }
    }
    return { move: best, quality: "solid" };
}

/**
 * Play one turn: run the move, let the boss hit back, check for the end.
 * Does not change the state passed in; the new state is in the result.
 * @param {Boss} boss
 * @param {BattleState} state
 * @param {string} moveId
 * @param {Grade} grade
 * @returns {TurnResult}
 */
export function resolveMove(boss, state, moveId, grade) {
    const move = isAvailable(boss, state, moveId) ? getMove(boss, moveId) ?? NOTHING : NOTHING;
    const next = { ...state };
    const result = move.run(next, grade);
    let text = result.text;

    /** @returns {TurnResult} */
    const end = (/** @type {Outcome} */ outcome) => {
        next.hp = Math.max(0, next.hp);
        return {
            state: next,
            text: text.trim(),
            outcome,
            damageDealt: Math.max(0, next.damage - state.damage),
            hpLost: Math.max(0, state.hp - next.hp),
        };
    };

    if (result.outcome) return end(result.outcome);

    if (boss.bossHp !== undefined && next.damage >= boss.bossHp) {
        text += ` ${boss.victoryText}`;
        return end("victory");
    }

    if (next.hp > 0 && result.counter !== false) {
        // Improvised protection takes the edge off this hit, and is used up by it
        const warded = next.ward === 1;
        text += ` ${boss.counter(next, grade.counter * (warded ? WARD_REDUCTION : 1))}`;
        if (warded) next.ward = 0;
    }

    if (next.hp <= 0) {
        text += ` ${boss.hpDeath}`;
        return end("death");
    }
    return end("continue");
}
