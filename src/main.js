// @ts-check
/// <reference path="./game.js" />

document.addEventListener('DOMContentLoaded', () => {
    const canvas = /** @type {HTMLCanvasElement|null} */ (document.getElementById('game-canvas'));
    if (!canvas) {
        console.error('Canvas element not found!');
        return;
    }

    const game = new Game(canvas);
    game.start();
});
