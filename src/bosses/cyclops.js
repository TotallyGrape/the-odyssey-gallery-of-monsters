// Polyphemus the cyclops: a puzzle fight.
// Talk him into a false sense of security (deception) to multiply your next attack,
// blind him with exactly enough damage (the sweet spot), then FLEE.
// Too little damage and the cave stays sealed; too much and it collapses.

import { steps, TIERS } from "../encounter.js";

/** @typedef {import("../encounter.js").BattleState} BattleState */
/** @typedef {import("../encounter.js").MoveResult} MoveResult */
/** @typedef {import("../encounter.js").Grade} Grade */

// ---- Numbers ----
const PLAYER_HP = 100;
const BASE_DAMAGE = 15;
const MULTIPLIERS = [1, 2, 4, 6]; // damage multiplier for each deception level
const MAX_DECEPTION = MULTIPLIERS.length - 1;
const SWEET_SPOT = 60;            // total damage at which he is blinded and FLEE works
const OVERKILL = 90;              // total damage that is instant death
const COUNTER_DAMAGE = 10;        // HP lost when he hits back
const FLEE_FAIL_DAMAGE = 30;      // HP lost when FLEE fails
const HIDES = 2;                  // how many times you can hide among the flock
const HIDE_HEAL = 10;

// ---- Helpers ----
const blinded = (/** @type {BattleState} */ s) => s.damage >= SWEET_SPOT && s.damage < OVERKILL;
const multiplier = (/** @type {BattleState} */ s) => MULTIPLIERS[Math.min(s.deception, MAX_DECEPTION)];

/** @returns {MoveResult} */
const death = (/** @type {string} */ text) => ({ text, outcome: "death" });

/**
 * An attack: damage is multiplied by deception, which is then spent.
 * @param {BattleState} s
 * @param {Grade} g
 * @returns {MoveResult}
 */
function attack(s, g) {
    const dealt = Math.round(BASE_DAMAGE * multiplier(s) * g.power);
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

/** @type {import("../encounter.js").Boss} */
export const CYCLOPS = {
    id: "cyclops",
    name: "Polyphemus",
    sprite: "cyclops",
    story: {
        title: "THE CAVE",
        pages: [
            "Troy has fallen. After ten years of war, Odysseus turns his ships toward Ithaca and home.",
            "On a nameless island his men find a cave full of cheese and lambs, and help themselves. Then the owner comes home and rolls a boulder across the door.",
            "Polyphemus the cyclops has one eye, no manners and a taste for sailors. He cannot be beaten by strength. He can be fooled.",
            "Talk him off his guard, strike once, and get out. Kill him, and no one is left to move the boulder.",
        ],
    },
    intro: "The cave is sealed. Polyphemus the cyclops looms over you.",
    scene:
        "A firelit cave on a nameless island, the door sealed by a boulder only the giant can move. "
        + "Polyphemus, a one-eyed cyclops and son of Poseidon, has already eaten some of the crew. He is vain, greedy, "
        + "slow-witted and fond of wine, and he speaks in blunt, hungry sentences. Around the cave: his flock of rams and ewes, "
        + "wheels of cheese, skins of strong wine the crew brought, a fire, and a green olive-wood stake as long as a mast. "
        + "The player's health is Odysseus's own strength: when he is hurt, it is Odysseus who is struck, not his men.",
    rules:
        "Strength alone cannot win. Deceiving him (wine, flattery, the false name Nobody) raises deception, which multiplies the next attack "
        + "and is spent by it. He must be hurt enough to be blinded, but not so much that his thrashing collapses the cave. "
        + "While he can still see, every escape attempt fails. Once he is blinded the only way to live is to slip out quietly, "
        + "for example under the bellies of the rams: attacking again or making noise is fatal. Lying to him after he is fully deceived is fatal too.",
    start: { hp: PLAYER_HP, damage: 0, deception: 0, hides: HIDES },
    victoryText: "",
    hpDeath: "Your strength gives out. Polyphemus has his dinner.",

    status: (s) => `Polyphemus   HP ${s.hp}   Deception ${s.deception} (x${multiplier(s)})   Damage ${s.damage}/${SWEET_SPOT}`,

    describe: (s) =>
        (blinded(s)
            ? "Polyphemus is BLINDED and thrashing. The only safe thing left is to slip out quietly."
            : "Polyphemus can still SEE perfectly well. He is not blinded and the boulder still seals the cave.")
        + (blinded(s) ? "" : [
            " He is wary and not deceived at all.",
            " He is a little off his guard.",
            " He is well deceived.",
            " He is completely taken in, and one more lie would be fatal.",
        ][Math.min(s.deception, MAX_DECEPTION)])
        // Exactly what a strike would do right now at each tier, so the options can be labelled honestly
        + (blinded(s) ? "" : ` If Odysseus struck now: ${Object.entries(TIERS).map(([tier, grade]) => {
            const total = s.damage + Math.round(BASE_DAMAGE * multiplier(s) * grade.power);
            return `a ${tier} strike would ${total >= OVERKILL ? "bring the cave down and kill him" : total >= SWEET_SPOT ? "blind the cyclops" : "be too weak to blind the cyclops"}`;
        }).join("; ")}.`)
        + (s.hides > 0 ? "" : " There is nowhere left to hide."),

    counter: (s, mult) => {
        s.hp -= Math.round(COUNTER_DAMAGE * mult);
        return blinded(s) ? "Polyphemus flails blindly and catches you." : "Polyphemus strikes back.";
    },

    moves: {
        strike: {
            action: "fight",
            label: "Strike",
            hint: `Attack him. Damage is ${BASE_DAMAGE} times the deception multiplier (x1, x2, x4, x6 at deception 0 to 3), then scaled by the tier, and deception drops to 0. `
                + `Total damage from ${SWEET_SPOT} to ${OVERKILL - 1} blinds him, which is the goal. Total damage of ${OVERKILL} or more collapses the cave and kills the player.`,
            keywords: ["attack", "strike", "stab", "stake", "spear", "sword", "hit", "blind", "eye", "kill"],
            when: (s) => !blinded(s),
            run: attack,
        },
        press: {
            action: "fight",
            label: "Press the Attack",
            hint: "Keep attacking after he is blinded. Always fatal: his blind fury crushes the player.",
            keywords: ["attack", "strike", "stab", "stake", "spear", "sword", "hit", "kill"],
            when: blinded,
            fatal: () => true,
            run: () => death("You stayed too long. You are crushed by his blind fury."),
        },
        deceive: {
            action: "speak",
            label: "Deceive Him",
            hint: `Trick, flatter, bribe or lie to him: wine, a false name, praise. Raises deception by 1 (by 2 if inspired, not at all if weak), up to ${MAX_DECEPTION}. `
                + `Fatal if deception is already ${MAX_DECEPTION}: he sees through the lie.`,
            keywords: ["wine", "drink", "nobody", "name", "gift", "offer", "flatter", "praise", "lie", "trick", "brag", "friend", "guest", "sing", "story"],
            when: (s) => !blinded(s),
            fatal: (s) => s.deception >= MAX_DECEPTION,
            run: (s, g) => {
                if (s.deception >= MAX_DECEPTION) return death("Caught in the lie. Polyphemus sees through you and crushes you.");
                const gained = steps(g.power);
                if (gained === 0) return { text: "Your words are clumsy. He is not fooled." };
                s.deception = Math.min(MAX_DECEPTION, s.deception + gained);
                return {
                    text: s.deception >= MAX_DECEPTION
                        ? "He believes every word, but he is starting to squint at you. One more lie would be one too many."
                        : "He believes you, and his guard drops.",
                };
            },
        },
        shout: {
            action: "speak",
            label: "Taunt Him",
            hint: "Speak to him, taunt him or boast aloud after he is blinded. Always fatal: he hurls a boulder at the voice.",
            keywords: ["taunt", "mock", "boast", "shout", "yell", "laugh", "odysseus", "name", "say", "tell"],
            when: blinded,
            fatal: () => true,
            run: () => death("He hears your voice and throws a boulder at it."),
        },
        escape: {
            action: "flee",
            label: "Slip Out",
            hint: `Try to get out of the cave. Wins the fight if he is blinded. Otherwise it fails and costs ${FLEE_FAIL_DAMAGE} HP, scaled by the tier.`,
            keywords: ["escape", "flee", "run", "leave", "ram", "sheep", "flock", "boulder", "door", "sneak", "slip", "crawl", "out"],
            fatal: () => false,
            run: (s, g) => {
                if (blinded(s)) {
                    return { text: "You cling to the belly of a ram and slip out past his hands. You escaped the cave.", outcome: "victory" };
                }
                const deceived = s.deception > 0;
                s.hp -= Math.round(FLEE_FAIL_DAMAGE * g.counter);
                return {
                    text: deceived
                        ? "He is tipsy, not blind. The boulder is still sealed, and he swats you back."
                        : "The boulder blocks the exit. Polyphemus attacks.",
                    counter: false,
                };
            },
        },
        hide: {
            action: "flee",
            label: "Hide in the Flock",
            hint: `Duck out of sight among the sheep to catch your breath. Heals ${HIDE_HEAL} HP scaled by the tier, and he does not hit back this turn. Does not get you out.`,
            keywords: ["hide", "rest", "breath", "cover", "shadow", "wait", "heal", "bandage"],
            when: (s) => s.hides > 0,
            run: (s, g) => {
                s.hides--;
                s.hp = Math.min(PLAYER_HP, s.hp + Math.round(HIDE_HEAL * g.power));
                return { text: "You press in among the sheep. His hand sweeps past and finds only wool.", counter: false };
            },
        },
    },
};
