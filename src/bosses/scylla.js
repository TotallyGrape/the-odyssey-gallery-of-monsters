// Scylla, the six-headed monster of the strait: a fight you win by fighting.
// Fleeing never works. What you say decides how you fight:
//   courage  - multiplies your damage, and is kept between attacks
//   insight  - unlocks a stronger attack
//   enraged  - doubles your next hit, but her counterattacks are doubled until you land it
//   guard    - blocks her next counterattack

import { steps, wardMove, EDGE_MULTIPLIER } from "../encounter.js";

/** @typedef {import("../encounter.js").BattleState} BattleState */
/** @typedef {import("../encounter.js").MoveResult} MoveResult */
/** @typedef {import("../encounter.js").Grade} Grade */

// ---- Numbers ----
const BOSS_HP = 100;
const CREW_HP = 100;                  // the player's health is the crew
const SPEAR_DAMAGE = 15;
const NECK_DAMAGE = 30;
const COURAGE_MULTIPLIERS = [1, 1.5, 2]; // damage multiplier for each courage level
const ENRAGED_MULTIPLIER = 2;         // applies to your next hit and to her counterattacks
const COUNTER_DAMAGE = 12;            // crew lost when she hits back
const FINISH_AT = 25;                 // the finishing blow is possible when she has this much HP or less
const FLEE_LOSS = 35;
const BEG_LOSS = 20;
const SECOND_TAUNT_LOSS = 40;
const PRAYERS = 2;                    // how many times Athena will answer
const PRAYER_HEAL = 10;

// ---- Helpers ----
const MAX_COURAGE = COURAGE_MULTIPLIERS.length - 1;
const remaining = (/** @type {BattleState} */ s) => Math.max(0, BOSS_HP - s.damage);
const courageMultiplier = (/** @type {BattleState} */ s) => COURAGE_MULTIPLIERS[Math.min(s.courage, MAX_COURAGE)];

/**
 * An attack: base damage x courage x tier, doubled if she is enraged (which ends the rage).
 * @param {BattleState} s
 * @param {Grade} g
 * @param {number} base
 * @param {string} text
 * @returns {MoveResult}
 */
function strike(s, g, base, text) {
    const dealt = Math.round(base * courageMultiplier(s) * (s.enraged ? ENRAGED_MULTIPLIER : 1) * (s.edge ? EDGE_MULTIPLIER : 1) * g.power);
    s.damage += dealt;
    s.enraged = 0;
    s.edge = 0;
    return { text: `${text} You deal ${dealt} damage.` };
}

/** @type {import("../encounter.js").Boss} */
export const SCYLLA = {
    id: "scylla",
    name: "Scylla",
    sprite: "scylla",
    story: {
        title: "THE STRAIT",
        pages: [
            "The cyclops has a father. His name is Poseidon, and the sea has been against you ever since.",
            "The witch Circe gave one warning before you sailed. The strait ahead has a whirlpool on one side and Scylla on the other. Six heads. Six men, every time.",
            "There is no way around. Keep the crew's courage up, remember what Circe told you, and do not turn the ship.",
        ],
    },
    intro: "The strait narrows. Six heads uncoil from the cliff above your ship.",
    scene:
        "A narrow strait between sheer cliffs, in spray and thunder. On one side the whirlpool Charybdis swallows the sea; "
        + "on the other, Scylla uncoils from her cave: six long necks, six heads with triple rows of teeth, snatching men from the deck. "
        + "She does not speak; she shrieks and strikes. Odysseus commands one ship and its frightened crew of oarsmen and spearmen. "
        + "The crew are the player's health. Circe warned him of this place, and Athena favours him.",
    rules:
        "This fight is won by wounding Scylla until the last head falls; there is no way around and fleeing only costs men. "
        + "Rallying the crew raises courage, which multiplies every attack. Recalling Circe's advice reveals the soft necks, a stronger attack. "
        + "Athena answers a prayer only twice: she turns aside the next blow and steadies the crew. "
        + "Taunting Scylla enrages her: the next hit on her is doubled but so are her strikes until it lands, and taunting twice is a disaster. "
        + "Begging costs men and all courage. When she is nearly dead a finishing blow ends it.",
    start: { hp: CREW_HP, damage: 0, courage: 0, insight: 0, enraged: 0, guard: 0, prayers: PRAYERS, edge: 0, ward: 0 },
    bossHp: BOSS_HP,
    victoryText: "The last head falls into the sea. The strait is yours.",
    hpDeath: "The last of your crew is gone. Scylla takes the ship.",

    status: (s) =>
        `Scylla ${remaining(s)}/${BOSS_HP}   Crew ${s.hp}   Courage ${s.courage} (x${courageMultiplier(s)})`
        + (s.insight ? "   Insight" : "")
        + (s.guard ? "   Guarded" : "")
        + (s.edge ? "   Ploy ready" : "")
        + (s.ward ? "   Braced" : "")
        + (s.enraged ? "   ENRAGED" : ""),

    describe: (s) =>
        `Scylla is ${remaining(s) > 66 ? "barely wounded" : remaining(s) > FINISH_AT ? "wounded but far from finished" : "nearly dead: a finishing blow is possible"}.`
        + ` The crew is ${["frightened", "steadier", "roaring and fearless"][Math.min(s.courage, MAX_COURAGE)]}.`
        + (s.insight ? " Odysseus knows the necks are her weak point." : " Odysseus has not yet recalled where she is weak.")
        + (s.enraged ? " She is ENRAGED: her strikes are doubled until the next blow lands on her, which will be doubled too." : "")
        + (s.guard ? " Her next strike will be turned aside." : "")
        + (s.edge ? " A ploy is prepared: the next attack on her will land harder." : "")
        + (s.ward ? " The crew has some protection ready against her next strike." : "")
        + (s.prayers > 0 ? "" : " Athena will answer no more prayers."),

    counter: (s, mult) => {
        if (s.guard) {
            s.guard = 0;
            return "The heads strike and are turned aside.";
        }
        s.hp -= Math.round(COUNTER_DAMAGE * (s.enraged ? ENRAGED_MULTIPLIER : 1) * mult);
        return s.enraged ? "Enraged, her heads tear into the crew." : "A head snaps down and takes a man.";
    },

    moves: {
        spear: {
            action: "fight",
            label: "Spear Thrust",
            hint: `A basic attack: ${SPEAR_DAMAGE} damage times the courage multiplier and the tier, doubled if she is enraged.`,
            keywords: ["attack", "spear", "strike", "stab", "sword", "hit", "throw", "arrow", "fight"],
            run: (s, g) => strike(s, g, SPEAR_DAMAGE, "Your spear bites into scaled hide."),
        },
        necks: {
            action: "fight",
            label: "Strike the Necks",
            hint: `A strong attack on the soft necks: ${NECK_DAMAGE} damage times the courage multiplier and the tier, doubled if she is enraged. Needs insight.`,
            keywords: ["neck", "necks", "throat", "soft"],
            when: (s) => s.insight === 1,
            run: (s, g) => strike(s, g, NECK_DAMAGE, "You go for the soft necks where they leave the rock."),
        },
        sever: {
            action: "fight",
            label: "Sever the Last Head",
            hint: "The finishing blow. Kills her outright and wins the fight.",
            keywords: ["sever", "finish", "last", "behead", "head", "cut"],
            when: (s) => remaining(s) <= FINISH_AT,
            run: (s) => {
                s.damage = BOSS_HP;
                return { text: "You climb the rigging and bring the blade down." };
            },
        },
        rally: {
            action: "speak",
            label: "Rally the Crew",
            hint: `Encourage, command or inspire the crew. Raises courage by 1 (by 2 if inspired, not at all if weak), up to ${MAX_COURAGE}. Courage multiplies all damage and is kept.`,
            keywords: ["rally", "crew", "men", "courage", "brave", "speech", "shout", "encourage", "row", "hold", "ithaca", "home", "sing"],
            run: (s, g) => {
                if (s.courage >= MAX_COURAGE) return { text: "The crew is already roaring. There is nothing more to give." };
                const gained = steps(g.power);
                if (gained === 0) return { text: "Your words are lost in the wind. The crew does not stir." };
                s.courage = Math.min(MAX_COURAGE, s.courage + gained);
                return { text: "You call every man to the rail. Their blows will land harder." };
            },
        },
        recall: {
            action: "speak",
            label: "Recall Circe's Warning",
            hint: "Remember Circe's advice, or study Scylla for a weakness. Gives insight, which unlocks the stronger attack on the necks. Fails if weak.",
            keywords: ["circe", "remember", "recall", "warning", "weak", "weakness", "study", "watch", "look", "think", "advice"],
            when: (s) => s.insight === 0,
            run: (s, g) => {
                if (steps(g.power) === 0) return { text: "You search your memory, but the spray and the screaming drive it out." };
                s.insight = 1;
                return { text: "Circe said the necks are soft where they leave the rock. You know where to strike." };
            },
        },
        pray: {
            action: "speak",
            label: "Pray to Athena",
            hint: `Call on Athena or the gods. Blocks her next counterattack and restores ${PRAYER_HEAL} crew, scaled by quality. Only works while prayers remain.`,
            keywords: ["pray", "athena", "gods", "zeus", "goddess", "prayer", "bless", "offering"],
            when: (s) => s.prayers > 0,
            run: (s, g) => {
                s.prayers--;
                s.guard = 1;
                s.hp = Math.min(CREW_HP, s.hp + Math.round(PRAYER_HEAL * g.power));
                return { text: "You pray to Athena. The crew steadies." };
            },
        },
        ploy: {
            action: "speak",
            label: "Prepare a Ploy",
            hint: "OPEN-ENDED ADVANTAGE. Any other clever, physically possible trick, preparation or use of the ship and the strait that is not one of the listed moves "
                + "(for example: bait a head with a carcass on a hook, lash spears together into pikes, steer so the heads tangle, throw a net or burning pitch). "
                + `The next attack on her does ${EDGE_MULTIPLIER} times the damage. On or off: it cannot be stacked. Fails if weak.`,
            keywords: ["bait", "net", "hook", "trap", "lash", "tangle", "pitch", "prepare", "lure", "decoy", "rope"],
            when: (s) => s.edge === 0,
            run: (s, g) => {
                if (steps(g.power) === 0) return { text: "The idea comes to nothing in the chaos." };
                s.edge = 1;
                return { text: "It works. For a moment she is open, and your next blow will land harder." };
            },
        },
        ward: wardMove(
            "raise a roof of shields and oars, hug the far side of the channel, rig the sail as a screen",
            "The crew gets something between themselves and the teeth.",
        ),
        taunt: {
            action: "speak",
            label: "Taunt Scylla",
            hint: `Mock or provoke Scylla. She becomes enraged: the next attack on her is doubled, and her counterattacks are doubled until it lands. `
                + `Fatal mistake if she is already enraged: she takes ${SECOND_TAUNT_LOSS} crew at once.`,
            keywords: ["taunt", "mock", "insult", "provoke", "laugh", "dare", "curse"],
            run: (s) => {
                if (s.enraged) {
                    s.hp -= SECOND_TAUNT_LOSS;
                    return { text: "You taunt her again. All six heads strike at once and take six men.", counter: false };
                }
                s.enraged = 1;
                return { text: "You mock her. She lunges low, necks stretched and open." };
            },
        },
        beg: {
            action: "speak",
            label: "Beg for Mercy",
            hint: `Plead, bargain or surrender. A mistake: she takes ${BEG_LOSS} crew and courage falls to 0.`,
            keywords: ["beg", "mercy", "please", "spare", "surrender", "bargain", "plead"],
            run: (s) => {
                s.hp -= BEG_LOSS;
                s.courage = 0;
                return { text: "You beg. She answers by taking a man. The crew loses heart.", counter: false };
            },
        },
        row: {
            action: "flee",
            label: "Row for the Strait",
            hint: `Try to flee. Always fails: Charybdis blocks the way. Costs ${FLEE_LOSS} crew scaled by the tier, and 1 courage.`,
            keywords: ["flee", "row", "run", "escape", "turn", "retreat", "away", "sail"],
            run: (s, g) => {
                s.hp -= Math.round(FLEE_LOSS * g.counter);
                s.courage = Math.max(0, s.courage - 1);
                return {
                    text: "Charybdis churns on the far side. There is nowhere to row. Scylla takes men from the oars.",
                    counter: false,
                };
            },
        },
        brace: {
            action: "flee",
            label: "Shields Up",
            hint: "Pull the crew back under cover. Blocks her next counterattack, but costs 1 courage.",
            keywords: ["shield", "cover", "brace", "duck", "below", "hide", "defend", "protect"],
            when: (s) => s.guard === 0,
            run: (s) => {
                s.guard = 1;
                s.courage = Math.max(0, s.courage - 1);
                return { text: "You order the crew down behind their shields. They are safer, and less bold." };
            },
        },
    },
};
