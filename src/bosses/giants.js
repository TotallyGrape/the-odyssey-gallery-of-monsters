// The Laestrygonians: giants on the harbour cliffs who sink ships with boulders.
// A planning fight. The giants repeat three moves in order:
//   1. Stones   - a light hit. The safe turn to prepare.
//   2. Boulder  - a heavy hit, unless you ordered the ships into shelter.
//   3. Wade in  - a medium hit, but they are in the water and every attack does double.
// Attacking every turn loses. The winning rhythm is prepare, shelter, strike.
// SPEAK gives the orders that set a turn up; FIGHT is where the setup pays off.

/** @typedef {import("../encounter.js").BattleState} BattleState */
/** @typedef {import("../encounter.js").ChoiceResult} ChoiceResult */

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
 * @param {number} base
 * @param {string} text
 * @returns {ChoiceResult}
 */
function strike(s, base, text) {
    const dealt = base * (exposed(s) ? EXPOSED_MULTIPLIER : 1);
    s.damage += dealt;
    return { text: `${text} ${exposed(s) ? "They are in the open water. " : ""}You deal ${dealt} damage.` };
}

/** @type {import("../encounter.js").Boss} */
export const GIANTS = {
    name: "The Laestrygonians",
    sprite: "cyclops", // placeholder art until the giants have their own picture
    story: {
        title: "THE HARBOUR",
        pages: [
            "What is left of the fleet limps into a calm harbour ringed by cliffs. It looks like the first good luck in years.",
            "It is a larder. The Laestrygonians are giants, and they fish for ships with boulders.",
            "They throw in a rhythm. Learn it. Shelter from the big one, and strike when they wade in to collect.",
        ],
    },
    intro: "The harbour is a trap. Giants line the cliffs above your ships.",
    start: { hp: CREW_HP, damage: 0, phase: STONES, scouted: 0, fire: 0, shelter: 0, reckless: 0, feint: 1 },
    bossHp: BOSS_HP,
    victoryText: "The last giant sinks beneath the harbour. You row for open sea.",
    hpDeath: "The last ship breaks apart. The giants wade out to collect the crew.",

    status: (s) =>
        `Giants ${remaining(s)}/${BOSS_HP}   Crew ${s.hp}`
        + (s.fire ? "   Fire arrows ready" : ""),

    // The giants make their current move, then line up the next one.
    counter: (s) => {
        const move = MOVES[s.phase];
        let damage = move.damage + (s.reckless ? SPEAR_EXTRA_COUNTER : 0);
        let text = move.text;
        if (s.shelter) {
            const blocked = s.phase === BOULDER;
            damage = blocked ? 0 : Math.round(damage * SHELTER_REDUCTION);
            text = blocked ? "The boulder shatters on the rocks you sheltered behind." : `${move.text} The rocks shield most of the fleet.`;
        }
        s.hp -= damage;
        s.shelter = 0;
        s.reckless = 0;
        s.phase = (s.phase + 1) % MOVES.length;
        // Once scouts are posted, each turn ends with what the giants are about to do
        if (s.scouted && s.hp > 0) text += ` The scouts signal: ${MOVES[s.phase].plan}.`;
        return text;
    },

    fight: [
        {
            label: "Arrow Volley",
            run: (s) => {
                const fire = s.fire === 1;
                s.fire = 0;
                return strike(s, VOLLEY_DAMAGE * (fire ? FIRE_MULTIPLIER : 1), fire ? "Burning arrows arc up at the giants." : "Your archers loose at the cliffs.");
            },
        },
        {
            label: "Spear Charge",
            run: (s) => {
                s.reckless = 1;
                return strike(s, SPEAR_DAMAGE, "Your men leap from the ships with spears, far from cover.");
            },
        },
    ],

    speak: [
        {
            label: "Send Scouts",
            when: (s) => s.scouted === 0,
            run: (s) => {
                s.scouted = 1;
                return { text: "Your scouts climb the cliff path. From now on they will signal what the giants are about to do." };
            },
        },
        {
            label: "Light Fire Arrows",
            when: (s) => s.fire === 0,
            run: (s) => {
                s.fire = 1;
                return { text: "The archers dip their arrows in pitch and light them. The next volley will burn." };
            },
        },
        {
            label: "Take Shelter",
            run: (s) => {
                s.shelter = 1;
                return { text: "You order the ships in behind the harbour rocks." };
            },
        },
        {
            label: "Feign Surrender",
            when: (s) => s.feint === 1 && !exposed(s),
            run: (s) => {
                s.feint = 0;
                s.phase = WADE;
                return {
                    text: "You strike your sails and call out for mercy. The giants drop their stones and wade in to take the ships. They will not fall for it twice.",
                    counter: false,
                };
            },
        },
    ],

    flee: [
        {
            label: "Cut the Anchor Cables",
            run: (s) => {
                s.hp -= FLEE_LOSS;
                return {
                    text: "You cut the cables and row for the harbour mouth. Boulders close it before you reach it, and a ship goes down.",
                    counter: false,
                };
            },
        },
    ],
};
