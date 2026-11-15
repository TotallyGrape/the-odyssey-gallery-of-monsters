// Generic boss-fight engine. It knows nothing about any particular boss:
// each boss is a data object (see src/bosses/) that lists its own choices and rules.
//
// A fight's state is a plain object of numbers. Every boss has `hp` (the player's health)
// and `damage` (total damage dealt to the boss), and may add its own, e.g. `courage`.
// On/off facts are stored as 0 or 1.
//
// Each turn the player picks FIGHT, SPEAK or FLEE, then one of the choices the boss
// currently offers for it. The engine runs that choice, lets the boss hit back,
// and checks whether the fight is over.

/** @typedef {Record<string, number>} BattleState */
/** @typedef {"fight" | "speak" | "flee"} Action */
/** @typedef {"continue" | "victory" | "death"} Outcome */

/**
 * What a choice's run() returns.
 * @typedef {Object} ChoiceResult
 * @property {string} text                  shown in the text box
 * @property {"victory" | "death"} [outcome] set to end the fight here
 * @property {boolean} [counter]            false = the boss does not hit back this turn
 */

/**
 * One option the player can pick.
 * @typedef {Object} Choice
 * @property {string | null} label                 button text; null = no button, it just happens
 * @property {(s: BattleState) => boolean} [when]  offered only while this is true (always, if left out)
 * @property {(s: BattleState) => ChoiceResult} run changes the state it is given and says what happened
 */

/**
 * @typedef {Object} Boss
 * @property {string} name
 * @property {string} sprite                        name of a loaded sprite
 * @property {{ title: string, pages: string[] }} story  shown before the fight (see src/transition.js)
 * @property {string} intro                         shown when the fight starts
 * @property {BattleState} start                    starting numbers; must include hp and damage
 * @property {number} [bossHp]                      if set, reaching this much damage wins the fight
 * @property {string} victoryText                   shown when bossHp is reached
 * @property {string} hpDeath                       shown when the player's hp runs out
 * @property {(s: BattleState) => string} status    the status line at the top of the screen
 * @property {(s: BattleState) => string} counter   the boss hits back: changes the state, returns the text
 * @property {Choice[]} fight
 * @property {Choice[]} speak
 * @property {Choice[]} flee
 */

/** @typedef {{ state: BattleState, text: string, outcome: Outcome }} TurnResult */

/**
 * Fresh state for the start of a fight.
 * @param {Boss} boss
 * @returns {BattleState}
 */
export function newBattleState(boss) {
    return { ...boss.start };
}

/**
 * The choices a main button (FIGHT / SPEAK / FLEE) offers right now.
 * @param {Boss} boss
 * @param {BattleState} state
 * @param {Action} action
 * @returns {Choice[]}
 */
export function getChoices(boss, state, action) {
    return boss[action].filter((c) => !c.when || c.when(state));
}

/**
 * Play one turn: run the picked choice, let the boss hit back, check for the end.
 * Does not change the state passed in; the new state is in the result.
 * @param {Boss} boss
 * @param {BattleState} state
 * @param {Choice} choice
 * @returns {TurnResult}
 */
export function resolveChoice(boss, state, choice) {
    const next = { ...state };
    const result = choice.run(next);
    let text = result.text;

    /** @returns {TurnResult} */
    const end = (/** @type {Outcome} */ outcome) => {
        next.hp = Math.max(0, next.hp);
        return { state: next, text, outcome };
    };

    if (result.outcome) return end(result.outcome);

    if (boss.bossHp !== undefined && next.damage >= boss.bossHp) {
        text += ` ${boss.victoryText}`;
        return end("victory");
    }

    if (next.hp > 0 && result.counter !== false) text += ` ${boss.counter(next)}`;

    if (next.hp <= 0) {
        text += ` ${boss.hpDeath}`;
        return end("death");
    }
    return end("continue");
}
