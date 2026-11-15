// The white frame around the game area, shared by every scene.

export const BORDER_WIDTH = 6;

/** Adds the border to the current scene, drawn on top of everything else. */
export function addGameBorder() {
    return add([
        rect(width() - BORDER_WIDTH, height() - BORDER_WIDTH, { fill: false }),
        pos(BORDER_WIDTH / 2, BORDER_WIDTH / 2),
        outline(BORDER_WIDTH, rgb(255, 255, 255)),
        fixed(),
        z(3000),
    ]);
}
