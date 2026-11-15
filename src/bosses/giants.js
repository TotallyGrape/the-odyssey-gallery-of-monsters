// The Laestrygonians: giants on the harbour cliffs who sink ships with boulders.
// A planning fight. The giants repeat three moves in order:
//   1. Stones   - a light hit. The safe turn to prepare.
//   2. Boulder  - a heavy hit, unless you ordered the ships into shelter.
//   3. Wade in  - a medium hit, but they are in the water and every attack does double.
// Attacking every turn loses. The winning rhythm is prepare, shelter, strike.
// What you say gives the orders that set a turn up; FIGHT is where the setup pays off.

import { steps } from "../encounter.js";

/** @typedef {import("../encounter.js").BattleState} BattleState */
/** @typedef {import("../encounter.js").MoveResult} MoveResult */
/** @typedef {import("../encounter.js").Grade} Grade */

// ---- Numbers ----
const BOSS_HP = 120;
const CREW_HP = 100;
const VOLLEY_DAMAGE = 12;
const SPEAR_DAMAGE = 20;
const SPEAR_EXTRA_COUNTER = 10; // extra crew lost on the giants' next move after a spear charge
const EXPOSED_MULTIPLIER = 2;   // all attacks, while the giants are wading in
const FIRE_MULTIPLIER = 2;      // Arrow Volley only, when fire arrows are ready
const SHELTER_REDUCTION = 0.5;  // shelter halves stones and wading hits (and blocks the boulder entirely)
const FLEE_LOSS = 30;
const RESCUES = 2;              // how many times you can stop to pull men from the water
const RESCUE_HEAL = 8;

// The giants' moves, in the order they repeat. `plan` is what the scouts report in the text box.
const STONES = 0, BOULDER = 1, WADE = 2;
const MOVES = [
    { damage: 8, plan: "they are gathering stones", text: "Stones rain down from the cliffs." },
    { damage: 30, plan: "they are lifting a boulder", text: "A boulder the size of a house crushes a ship." },
    { damage: 15, plan: "they are wading in, out in the open", text: "A giant wades in and spears men like fish." },
];

// ---- Helpers ----
const remaining = (/** @type {BattleState} */ s) => Math.max(0, BOSS_HP - s.damage);
const exposed = (/** @type {BattleState} */ s) => s.phase === WADE;

/**
 * An attack. Doubled while the giants are wading in.
 * @param {BattleState} s
 * @param {Grade} g
 * @param {number} base
 * @param {string} text
 * @returns {MoveResult}
 */
function strike(s, g, base, text) {
    const dealt = Math.round(base * (exposed(s) ? EXPOSED_MULTIPLIER : 1) * g.power);
    s.damage += dealt;
    return { text: `${text} ${exposed(s) ? "They are in the open water. " : ""}You deal ${dealt} damage.` };
}

/** @type {import("../encounter.js").Boss} */
export const GIANTS = {
    id: "giants",
    name: "The Laestrygonians",
    sprite: "giants",
    story: {
        title: "THE HARBOUR",
        pages: [
            "What is left of the fleet limps into a calm harbour ringed by cliffs. It looks like the first good luck in years.",
            "It is a larder. The Laestrygonians are giants, and they fish for ships with boulders.",
            "They throw in a rhythm. Learn it. Shelter from the big one, and strike when they wade in to collect.",
        ],
    },
    intro: "The harbour is a trap. Giants line the cliffs above your ships.",
    scene:
        "A still, landlocked harbour ringed by high cliffs, with one narrow mouth to the sea. The Laestrygonians, man-eating giants, "
        + "line the clifftops and hurl rocks down on the trapped fleet, then wade in to spear the swimmers like fish. "
        + "They bellow rather than speak. Odysseus commands the surviving ships, their archers and spearmen; the crews are the player's health. "
        + "There are harbour rocks to shelter behind, pitch and fire for arrows, and a cliff path scouts could climb.",
    rules:
        "The giants repeat three moves in order: stones (a light hit), a boulder (a heavy hit), then wading in (a medium hit, "
        + "but while they are in the water every attack on them does double). Attacking every turn loses. "
        + "Taking shelter blocks the boulder completely and halves the other hits for that turn. Fire arrows double the next volley. "
        + "Scouts report what the giants will do next. A spear charge hits hard but leaves the men exposed to the giants' next move. "
        + "A feigned surrender lures the giants into the water early, once. Fleeing fails: the harbour mouth is closed by boulders. "
        + "The fight is won when the giants have taken enough damage.",
    start: { hp: CREW_HP, damage: 0, phase: STONES, scouted: 0, fire: 0, shelter: 0, reckless: 0, feint: 1, rescues: RESCUES },
    bossHp: BOSS_HP,
    victoryText: "The last giant sinks beneath the harbour. You row for open sea.",
    hpDeath: "The last ship breaks apart. The giants wade out to collect the crew.",

    status: (s) =>
        `Giants ${remaining(s)}/${BOSS_HP}   Crew ${s.hp}`
        + (s.fire ? "   Fire arrows ready" : "")
        + (s.scouted ? `   Scouts: ${MOVES[s.phase].plan}` : ""),

    describe: (s) =>
        `The giants are ${remaining(s) > 80 ? "barely hurt" : remaining(s) > 30 ? "bloodied" : "close to breaking"}.`
        + ` Their next move: ${MOVES[s.phase].plan}${exposed(s) ? " - this is the moment to attack" : ""}.`
        + (s.scouted ? " Scouts are posted, so Odysseus knows this." : " No scouts are posted, so Odysseus cannot be sure what comes next.")
        + (s.fire ? " Fire arrows are lit and ready." : "")
        + (s.feint ? "" : " The giants will not fall for a false surrender again.")
        + (s.rescues > 0 ? "" : " There is no time left to rescue swimmers."),

    // The giants make their current move, then line up the next one.
    counter: (s, mult) => {
        const move = MOVES[s.phase];
        let damage = (move.damage + (s.reckless ? SPEAR_EXTRA_COUNTER : 0)) * mult;
        let text = move.text;
        if (s.shelter) {
            const blocked = s.phase === BOULDER;
            damage = blocked ? 0 : damage * SHELTER_REDUCTION;
            text = blocked ? "The boulder shatters on the rocks you sheltered behind." : `${move.text} The rocks shield most of the fleet.`;
        }
        s.hp -= Math.round(damage);
        s.shelter = 0;
        s.reckless = 0;
        s.phase = (s.phase + 1) % MOVES.length;
        // Once scouts are posted, each turn ends with what the giants are about to do
        if (s.scouted && s.hp > 0) text += ` The scouts signal: ${MOVES[s.phase].plan}.`;
        return text;
    },

    moves: {
        volley: {
            action: "fight",
            label: "Arrow Volley",
            hint: `A ranged attack: ${VOLLEY_DAMAGE} damage scaled by the tier, doubled if fire arrows are ready (which uses them up), and doubled again while the giants are wading in.`,
            keywords: ["arrow", "arrows", "volley", "shoot", "archer", "archers", "bow", "loose", "attack", "fight"],
            run: (s, g) => {
                const fire = s.fire === 1;
                s.fire = 0;
                return strike(s, g, VOLLEY_DAMAGE * (fire ? FIRE_MULTIPLIER : 1), fire ? "Burning arrows arc up at the giants." : "Your archers loose at the cliffs.");
            },
        },
        charge: {
            action: "fight",
            label: "Spear Charge",
            hint: `A close attack: ${SPEAR_DAMAGE} damage scaled by the tier, doubled while the giants are wading in. The men are left in the open, so the giants' next move costs ${SPEAR_EXTRA_COUNTER} more crew.`,
            keywords: ["spear", "spears", "charge", "sword", "board", "leap", "rush", "stab"],
            run: (s, g) => {
                s.reckless = 1;
                return strike(s, g, SPEAR_DAMAGE, "Your men leap from the ships with spears, far from cover.");
            },
        },
        scout: {
            action: "speak",
            label: "Send Scouts",
            hint: "Send scouts or lookouts to watch the giants. From then on the player is told what the giants will do next. Fails if weak.",
            keywords: ["scout", "scouts", "lookout", "watch", "spy", "climb", "observe", "pattern", "rhythm"],
            when: (s) => s.scouted === 0,
            run: (s, g) => {
                if (steps(g.power) === 0) return { text: "No one hears the order over the crash of stone." };
                s.scouted = 1;
                return { text: "Your scouts climb the cliff path. From now on they will signal what the giants are about to do." };
            },
        },
        fire: {
            action: "speak",
            label: "Light Fire Arrows",
            hint: "Prepare burning arrows with pitch and fire. The next arrow volley does double damage. Fails if weak.",
            keywords: ["fire", "flame", "pitch", "burn", "light", "torch", "oil"],
            when: (s) => s.fire === 0,
            run: (s, g) => {
                if (steps(g.power) === 0) return { text: "The pitch will not catch in the spray." };
                s.fire = 1;
                return { text: "The archers dip their arrows in pitch and light them. The next volley will burn." };
            },
        },
        shelter: {
            action: "speak",
            label: "Take Shelter",
            hint: "Order the ships behind the harbour rocks, or otherwise take cover. For the giants' next move only: blocks a boulder completely, halves any other hit.",
            keywords: ["shelter", "cover", "rocks", "hide", "behind", "shield", "defend", "protect", "duck"],
            run: (s) => {
                s.shelter = 1;
                return { text: "You order the ships in behind the harbour rocks." };
            },
        },
        feint: {
            action: "speak",
            label: "Feign Surrender",
            hint: "Pretend to surrender, or otherwise lure the giants down. They skip to wading in, where every attack does double, and do not hit this turn. Works once. Fails if weak.",
            keywords: ["surrender", "feign", "pretend", "lure", "bait", "trick", "mercy", "yield", "decoy"],
            when: (s) => s.feint === 1 && !exposed(s),
            run: (s, g) => {
                if (steps(g.power) === 0) return { text: "You call out, but the giants only laugh and keep throwing." };
                s.feint = 0;
                s.phase = WADE;
                return {
                    text: "You strike your sails and call out for mercy. The giants drop their stones and wade in to take the ships. They will not fall for it twice.",
                    counter: false,
                };
            },
        },
        cut: {
            action: "flee",
            label: "Cut the Anchor Cables",
            hint: `Try to flee the harbour. Always fails: boulders close the mouth. Costs ${FLEE_LOSS} crew scaled by the tier.`,
            keywords: ["flee", "row", "run", "escape", "retreat", "cables", "anchor", "sail", "away", "leave"],
            run: (s, g) => {
                s.hp -= Math.round(FLEE_LOSS * g.counter);
                return {
                    text: "You cut the cables and row for the harbour mouth. Boulders close it before you reach it, and a ship goes down.",
                    counter: false,
                };
            },
        },
        rescue: {
            action: "flee",
            label: "Haul Men Aboard",
            hint: `Break off to haul swimmers aboard. Restores ${RESCUE_HEAL} crew scaled by the tier, but the giants still make their move. Limited uses.`,
            keywords: ["rescue", "save", "swimmers", "survivors", "haul", "pull", "heal", "wounded"],
            when: (s) => s.rescues > 0,
            run: (s, g) => {
                s.rescues--;
                s.hp = Math.min(CREW_HP, s.hp + Math.round(RESCUE_HEAL * g.power));
                return { text: "You pull back and haul swimmers out of the water." };
            },
        },
    },
};
