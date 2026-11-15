// Polyphemus the cyclops: a puzzle fight.
// Talk him into a false sense of security (deception) to multiply your next attack,
// blind him with exactly enough damage (the sweet spot), then FLEE.
// Too little damage and the cave stays sealed; too much and it collapses.

/** @typedef {import("../encounter.js").BattleState} BattleState */
/** @typedef {import("../encounter.js").ChoiceResult} ChoiceResult */

// ---- Numbers ----
const PLAYER_HP = 100;
const BASE_DAMAGE = 15;
const MULTIPLIERS = [1, 2, 4, 6]; // damage multiplier for each deception level
const SWEET_SPOT = 60;            // total damage at which FLEE unlocks
const OVERKILL = 90;              // total damage that is instant death
const COUNTER_DAMAGE = 10;        // HP lost when he hits back
const FLEE_FAIL_DAMAGE = 30;      // HP lost when FLEE fails

// ---- Helpers ----
const inSweetSpot = (/** @type {BattleState} */ s) => s.damage >= SWEET_SPOT && s.damage < OVERKILL;
const multiplier = (/** @type {BattleState} */ s) => MULTIPLIERS[Math.min(s.deception, MULTIPLIERS.length - 1)];

/** @returns {ChoiceResult} */
const death = (/** @type {string} */ text) => ({ text, outcome: "death" });

/**
 * An attack: damage is multiplied by deception, which is then spent.
 * @param {BattleState} s
 * @returns {ChoiceResult}
 */
function attack(s) {
    const dealt = BASE_DAMAGE * multiplier(s);
    s.damage += dealt;
    s.deception = 0;
    if (s.damage >= OVERKILL) return death(`You deal ${dealt} damage. Overkill. His blind thrashing collapses the cave on top of you.`);
    if (s.damage >= SWEET_SPOT) {
        return {
            text: `You deal ${dealt} damage. The stake finds his eye. He is blinded and thrashing. Now is the moment to get out.`,
            counter: false,
        };
    }
    return { text: `You deal ${dealt} damage. Too weak to blind him. The boulder still seals the cave.` };
}

/**
 * A SPEAK step that raises deception by one. Offered only at its own deception level.
 * @param {number} level
 * @param {string} label
 * @param {string} text
 * @returns {import("../encounter.js").Choice}
 */
const deceive = (level, label, text) => ({
    label,
    when: (s) => !inSweetSpot(s) && s.deception === level,
    run: (s) => {
        s.deception++;
        return { text };
    },
});

/** @type {import("../encounter.js").Boss} */
export const CYCLOPS = {
    name: "Polyphemus",
    sprite: "cyclops",
    intro: "The cave is sealed. Polyphemus the cyclops looms over you.",
    start: { hp: PLAYER_HP, damage: 0, deception: 0 },
    victoryText: "",
    hpDeath: "Your strength gives out. Polyphemus has his dinner.",

    status: (s) => `Polyphemus   HP ${s.hp}   Deception ${s.deception} (x${multiplier(s)})   Damage ${s.damage}/${SWEET_SPOT}`,

    counter: (s) => {
        s.hp -= COUNTER_DAMAGE;
        return "Polyphemus strikes back.";
    },

    fight: [
        { label: "Strike", when: (s) => !inSweetSpot(s) && s.deception < 2, run: attack },
        { label: "Heated Olive Stake", when: (s) => !inSweetSpot(s) && s.deception >= 2, run: attack },
        {
            label: "Press the Attack",
            when: inSweetSpot,
            run: () => death("You stayed too long. You are crushed by his blind fury."),
        },
    ],

    speak: [
        deceive(0, "Offer Wine", "You offer him wine. He drinks deep and grows tipsy."),
        deceive(1, "My Name is Nobody", "You tell him your name is Nobody. He believes you."),
        deceive(2, "Keep Bragging", "You keep bragging. He is starting to squint at you. Danger zone."),
        {
            label: "Push Your Luck",
            when: (s) => !inSweetSpot(s) && s.deception >= 3,
            run: () => death("Caught in the lie. Polyphemus sees through you and crushes you."),
        },
        {
            label: "Taunt Him",
            when: inSweetSpot,
            run: () => death("He hears your voice and throws a boulder at it."),
        },
    ],

    flee: [
        {
            label: null, // nothing to choose: the attempt just fails
            when: (s) => !inSweetSpot(s),
            run: (s) => {
                const deceived = s.deception > 0;
                s.hp -= FLEE_FAIL_DAMAGE;
                return {
                    text: deceived
                        ? "He is tipsy, not blind. The boulder is still sealed, and he swats you back."
                        : "The boulder blocks the exit. Polyphemus attacks.",
                    counter: false,
                };
            },
        },
        {
            label: "Hide Under the Rams",
            when: inSweetSpot,
            run: () => ({
                text: "You cling to the belly of a ram and slip out past his hands. You escaped the cave.",
                outcome: "victory",
            }),
        },
    ],
};
