// Scylla, the six-headed monster of the strait: a fight you win by fighting.
// Fleeing never works. SPEAK is where you decide how to fight:
//   courage  - multiplies your damage, and is kept between attacks
//   insight  - unlocks a stronger attack
//   enraged  - doubles your next hit, but her counterattacks are doubled until you land it
//   guard    - blocks her next counterattack

/** @typedef {import("../encounter.js").BattleState} BattleState */
/** @typedef {import("../encounter.js").ChoiceResult} ChoiceResult */

// ---- Numbers ----
const BOSS_HP = 100;
const CREW_HP = 100;                  // the player's health is the crew
const SPEAR_DAMAGE = 15;
const NECK_DAMAGE = 30;
const COURAGE_MULTIPLIERS = [1, 1.5, 2]; // damage multiplier for each courage level
const ENRAGED_MULTIPLIER = 2;         // applies to your next hit and to her counterattacks
const COUNTER_DAMAGE = 12;            // crew lost when she hits back
const FINISH_AT = 25;                 // "Sever the Last Head" appears when she has this much HP or less
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
 * An attack: base damage x courage, doubled if she is enraged (which ends the rage).
 * @param {BattleState} s
 * @param {number} base
 * @param {string} text
 * @returns {ChoiceResult}
 */
function strike(s, base, text) {
    const dealt = Math.round(base * courageMultiplier(s) * (s.enraged ? ENRAGED_MULTIPLIER : 1));
    s.damage += dealt;
    s.enraged = 0;
    return { text: `${text} You deal ${dealt} damage.` };
}

/** @type {import("../encounter.js").Boss} */
export const SCYLLA = {
    name: "Scylla",
    sprite: "scylla",
    intro: "The strait narrows. Six heads uncoil from the cliff above your ship.",
    start: { hp: CREW_HP, damage: 0, courage: 0, insight: 0, enraged: 0, guard: 0, prayers: PRAYERS },
    bossHp: BOSS_HP,
    victoryText: "The last head falls into the sea. The strait is yours.",
    hpDeath: "The last of your crew is gone. Scylla takes the ship.",

    status: (s) =>
        `Scylla ${remaining(s)}/${BOSS_HP}   Crew ${s.hp}   Courage ${s.courage} (x${courageMultiplier(s)})`
        + (s.insight ? "   Insight" : "")
        + (s.enraged ? "   ENRAGED" : ""),

    counter: (s) => {
        if (s.guard) {
            s.guard = 0;
            return "Athena turns the heads aside.";
        }
        s.hp -= COUNTER_DAMAGE * (s.enraged ? ENRAGED_MULTIPLIER : 1);
        return s.enraged ? "Enraged, her heads tear into the crew." : "A head snaps down and takes a man.";
    },

    fight: [
        {
            label: "Spear Thrust",
            run: (s) => strike(s, SPEAR_DAMAGE, "Your spear bites into scaled hide."),
        },
        {
            label: "Strike the Necks",
            when: (s) => s.insight === 1,
            run: (s) => strike(s, NECK_DAMAGE, "You go for the soft necks where they leave the rock."),
        },
        {
            label: "Sever the Last Head",
            when: (s) => remaining(s) <= FINISH_AT,
            run: (s) => {
                s.damage = BOSS_HP;
                return { text: "You climb the rigging and bring the blade down." };
            },
        },
    ],

    speak: [
        {
            label: "Rally the Crew",
            run: (s) => {
                if (s.courage >= MAX_COURAGE) return { text: "The crew is already roaring. There is nothing more to give." };
                s.courage++;
                return { text: "You call every man to the rail. Their blows will land harder." };
            },
        },
        {
            label: "Recall Circe's Warning",
            when: (s) => s.insight === 0,
            run: (s) => {
                s.insight = 1;
                return { text: "Circe said the necks are soft where they leave the rock. You know where to strike." };
            },
        },
        {
            label: "Pray to Athena",
            when: (s) => s.prayers > 0,
            run: (s) => {
                s.prayers--;
                s.guard = 1;
                s.hp = Math.min(CREW_HP, s.hp + PRAYER_HEAL);
                return { text: "You pray to Athena. The crew steadies." };
            },
        },
        {
            label: "Taunt Scylla",
            run: (s) => {
                if (s.enraged) {
                    s.hp -= SECOND_TAUNT_LOSS;
                    return { text: "You taunt her again. All six heads strike at once and take six men.", counter: false };
                }
                s.enraged = 1;
                return { text: "You mock her. She lunges low, necks stretched and open." };
            },
        },
        {
            label: "Beg for Mercy",
            run: (s) => {
                s.hp -= BEG_LOSS;
                s.courage = 0;
                return { text: "You beg. She answers by taking a man. The crew loses heart.", counter: false };
            },
        },
    ],

    flee: [
        {
            label: "Row for the Strait",
            run: (s) => {
                s.hp -= FLEE_LOSS;
                s.courage = Math.max(0, s.courage - 1);
                return {
                    text: "Charybdis churns on the far side. There is nowhere to row. Scylla takes six men from the oars.",
                    counter: false,
                };
            },
        },
    ],
};
