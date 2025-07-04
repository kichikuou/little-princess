// @ts-check
/// <reference path="./common.js" />

/**
 * Provides drawing utilities for rendering on a canvas.
 */
class Draw {
    /**
     * Canvas 2D rendering context.
     * @type {CanvasRenderingContext2D}
     */
    #ctx;

    /**
     * Current X position of the cursor.
     * @type {number}
     */
    #cursorX = 0;
    /**
     * Current Y position of the cursor.
     * @type {number}
     */
    #cursorY = 0;

    /**
     * Foreground color.
     * @type {string}
     */
    #foreColor = 'rgb(255, 255, 255)';
    /**
     * Background color.
     * @type {string}
     */
    #backColor = 'rgb(0, 0, 0)';

    /**
     * Gets the foreground color.
     * @returns {string}
     */
    get foreColor() { return this.#foreColor; }
    /**
     * Gets the background color.
     * @returns {string}
     */
    get backColor() { return this.#backColor; }

    /**
     * Initializes the Draw instance with a canvas.
     * @param {HTMLCanvasElement} canvas
     */
    constructor(canvas) {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get 2D context from canvas.');
        }
        ctx.imageSmoothingEnabled = false;
        this.#ctx = ctx;
    }

    /**
     * Sets the cursor position.
     * @param {number} x
     * @param {number} y
     */
    preset(x, y) {
        this.#cursorX = x;
        this.#cursorY = y * 2;
    }

    /**
     * Sets the foreground and background colors.
     * @param {string} fore
     * @param {string} back
     */
    setColors(fore, back) {
        this.#foreColor = fore;
        this.#backColor = back;
    }

    /**
     * Draws an image line by line with an optional delay.
     * @param {string} fileName
     * @param {number} [wait=0] - Delay in milliseconds between lines.
     * @returns {Promise<void>}
     */
    async drawPicture(fileName, wait = 0) {
        const lowerFileName = fileName.toLowerCase();
        const img = await this.loadImage(`cg/${lowerFileName}.gif`);

        const [width, height, left, top] = this.getPictureRect(fileName);

        for (let y = 0; y < height; y++) {
            // Draw a 1px high strip from the source image, and stretch it to 2px high on the destination canvas.
            this.#ctx.drawImage(img, 0, y, width, 1, left, (top + y) * 2, width, 2);
            if (wait > 0) {
                await sleep(wait);
            }
        }
    }

    /**
     * Returns the rectangle parameters for the image.
     * @param {string} fileName
     * @returns {[number, number, number, number]}
     * @private
     */
    getPictureRect(fileName) {
        const lowerFileName = fileName.toLowerCase();
        if (lowerFileName.startsWith('cg')) {
            return [328, 132, 6, 8];
        }
        if (lowerFileName.startsWith('kao')) {
            return [148, 94, 352, 46];
        }
        return [512, 212, 0, 0];
    }

    /**
     * Draws text at the current cursor position.
     * @param {string} text
     */
    drawText(text) {
        this.#ctx.font = '16px "MS Gothic", monospace';
        this.#ctx.textBaseline = 'top';

        // Clear the background for the entire text area first. All chars are hankaku (8px wide)
        this.#ctx.fillStyle = this.#backColor;
        this.#ctx.fillRect(this.#cursorX, this.#cursorY, text.length * 8, 16);

        this.#ctx.fillStyle = this.#foreColor;

        for (let char of text) {
            char = getHankaku(char);
            if (!isHankaku(char)) {
                this.#ctx.save();
                this.#ctx.scale(0.5, 1);
                // We need to double the X-coordinate because the context is scaled by 0.5
                this.#ctx.fillText(char, this.#cursorX * 2, this.#cursorY);
                this.#ctx.restore();
            } else {
                this.#ctx.fillText(char, this.#cursorX, this.#cursorY);
            }
            this.#cursorX += 8;
        }
    }

    /**
     * Fills a rectangular area with a color.
     * @param {number} sx - Start X.
     * @param {number} sy - Start Y.
     * @param {number} ex - End X.
     * @param {number} ey - End Y.
     * @param {string} color - Fill color.
     */
    boxFill(sx, sy, ex, ey, color) {
        this.#ctx.fillStyle = color;
        this.#ctx.fillRect(sx, sy * 2, ex - sx + 1, (ey - sy + 1) * 2);
    }

    /**
     * Loads an image from the given source.
     * @param {string} src
     * @returns {Promise<HTMLImageElement>}
     * @private
     */
    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }
}
