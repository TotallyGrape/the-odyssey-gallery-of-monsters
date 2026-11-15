// A single on/off switch that says "an overlay is open, ignore normal game input".
// Buttons made with addButton() obey it automatically. Any other click or key handler
// in a scene should start with:  if (isInputLocked()) return;

let locked = false;

/** Call when an overlay opens. */
export function lockInput() {
    locked = true;
}

/** Call when the overlay closes. */
export function unlockInput() {
    locked = false;
}

/** True while an overlay is open. */
export function isInputLocked() {
    return locked;
}
