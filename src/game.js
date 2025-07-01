// @ts-check
/// <reference path="./common.js" />
/// <reference path="./draw.js" />
/// <reference path="../se/kazumi.js" />
/// <reference path="../se/verb.js" />
/// <reference path="../se/noun.js" />

/**
 * Scenario data indexed by file name.
 * @type {Object.<string, string[]>}
 */
var SCENARIO = {};

// A simple state machine to replace GOTO statements
/**
 * @typedef {'main'|'getcmd'|'wakarimasen'|'event'|'ending'|'end'} GameState
 */

/**
 * @typedef {Object} ScenarioResult
 * @property {GameState} nextState
 * @property {number} intIndex
 * @property {number} intD3
 * @property {number} intKr
 */

/**
 * Main game logic controller.
 */
class Game {
    /**
     * Draw utility instance.
     * @type {Draw}
     */
    #draw;
    /**
     * Game running flag.
     * @type {boolean}
     */
    #isRunning = false;
    /**
     * Game stop flag.
     * @type {boolean}
     */
    #isStop = false; // mblnStop
    /**
     * Last key pressed.
     * @type {string|null}
     */
    #keyBuffer = null;

    // Game data from frmMain
    /**
     * Verb data.
     * @type {string[]}
     */
    #mstrA = new Array(48).fill("");
    /**
     * Noun data.
     * @type {string[]}
     */
    #mstrB = new Array(48).fill("");
    /**
     * Scenario lines.
     * @type {string[]}
     */
    #mstrG = new Array(101).fill("");
    /**
     * Item state.
     * @type {number[]}
     */
    #mintIT = new Array(101).fill(0);
    /**
     * Item names.
     * @type {string[]}
     */
    #mstrKN = new Array(17).fill("");
    /**
     * Scenario keys.
     * @type {string[]}
     */
    #mstrKE = new Array(11).fill("");
    /**
     * Scenario GG data.
     * @type {string[]}
     */
    #mstrGG = new Array(101).fill("");
    /**
     * Last picture file name.
     * @type {string}
     */
    #mstrQ1 = "";
    /**
     * Last scenario file name.
     * @type {string}
     */
    #mstrQ2 = "";

    /**
     * Creates a new Game instance.
     * @param {HTMLCanvasElement} canvas
     */
    constructor(canvas) {
        this.#draw = new Draw(canvas);
        this.setupInputListeners();
    }

    /**
     * Sets up keyboard input listeners.
     * @private
     */
    setupInputListeners() {
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    /**
     * Handles keydown events.
     * @param {KeyboardEvent} e
     * @private
     */
    handleKeyDown(e) {
        if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
            e.preventDefault();
            this.handleCtrlC();
            return;
        }

        switch (e.key) {
            case 'F1':
            case 'F3':
            case 'F5':
                e.preventDefault();
                this.#keyBuffer = e.key.toLowerCase();
                break;
            case 'Backspace':
                e.preventDefault();
                this.#keyBuffer = '\b'; // Use backspace character
                break;
            case 'Enter':
                e.preventDefault();
                this.#keyBuffer = '\r'; // Use carriage return
                break;
            default:
                if (e.key.length === 1 && (e.key.match(/[a-z0-9\s-]/i))) {
                    e.preventDefault();
                    this.#keyBuffer = e.key;
                }
                break;
        }
    }

    /**
     * Handles Ctrl+C key event.
     * @private
     * @returns {Promise<void>}
     */
    async handleCtrlC() {
        if (this.#isStop) {
            const originalBackColor = this.#draw.backColor;
            const originalForeColor = this.#draw.foreColor;
            this.#draw.setColors('rgb(255, 255, 255)', 'rgb(0, 0, 0)');

            await this.#draw.drawPicture("kao4");
            this.#draw.preset(380, 110);
            this.#draw.drawText(" お さ な い てﾞ ");
            await sleep(1000);
            await this.#draw.drawPicture("kao1");

            this.#draw.setColors(originalForeColor, originalBackColor);
        }
    }

    /**
     * Waits for a key press.
     * @param {boolean} [blnFunc=false] - If true, only function keys are accepted.
     * @returns {Promise<string>}
     * @private
     */
    async waitKey(blnFunc = false) {
        while (this.#isRunning) {
            const key = this.#keyBuffer;
            if (key !== null) {
                this.#keyBuffer = null; // Consume key
                if (blnFunc) {
                    if (key.startsWith('f')) {
                        return key; // Return if it is a function key
                    }
                    // If we only want function keys, and this is not one, we loop again.
                } else {
                    return key; // Return any key
                }
            }
            await sleep(10);
        }
        return "";
    }

    /**
     * Starts the game loop.
     * @returns {Promise<void>}
     */
    async start() {
        this.#isRunning = true;
        this.#isStop = false;

        if (!await this.eventOpening()) {
            this.endGame();
            return;
        }

        if (!await this.initializeMika()) {
            this.endGame();
            return;
        }

        await this.drawPicture("CG01", 10);
        if (!this.#isRunning) { this.endGame(); return; }
        await this.loadScenario("SE01");

        // Game loop using a state machine
        /** @type {GameState} */
        let currentState = 'main';
        let intKr = 0;
        let intD3 = 1; // Start from 1
        let intIndex = 1;

        while (this.#isRunning) {
            switch (currentState) {
                case 'main': {
                    const result = await this.advanceScenario(intD3, intIndex, intKr);
                    currentState = result.nextState;
                    intD3 = result.intD3;
                    intIndex = result.intIndex;
                    intKr = result.intKr;
                    break;
                }
                case 'getcmd': {
                    const command = await this.getCommand();
                    if (command === null) { // F5 (Load) was pressed
                        currentState = 'main';
                        intKr = 0;
                        intD3 = 1;
                        intIndex = 1;
                        await this.drawPicture(this.#mstrQ1);
                        await this.loadScenario(this.#mstrQ2);
                        break;
                    }
                    if (command === "") {
                        continue; // Loop to get command again if empty
                    }
                    const result = this.processCommand(command, intKr);
                    currentState = result.nextState;
                    intD3 = result.intD3;
                    intIndex = result.intIndex;
                    intKr = result.intKr;
                    break;
                }
                case 'wakarimasen':
                    await this.showWakarimasen();
                    currentState = 'getcmd';
                    break;
                case 'ending':
                    await this.eventEnding();
                    currentState = 'end';
                    break;
                case 'end':
                    this.endGame();
                    return; // Exit the loop and the game
                default:
                    this.#isRunning = false;
                    break;
            }
        }

        this.endGame();
    }

    /**
     * Prompts the user for a command.
     * @returns {Promise<string|null>}
     * @private
     */
    async getCommand() {
        let command = "";

        while (this.#isRunning) {
            // Redraw command prompt
            this.#draw.preset(11, 151);
            this.#draw.drawText(` COMMAND =${command}★${' '.repeat(28 - command.length)}`);

            const key = await this.waitKey(false);
            if (!this.#isRunning) return "";

            if (key === 'f1') {
                await this.funcItem();
                continue; // Redraw prompt
            } else if (key === 'f3') {
                await this.funcSave();
                continue; // Redraw prompt
            } else if (key === 'f5') {
                await this.funcLoad();
                return null; // Signal to reload main state
            } else if (key === '\b') { // Backspace
                if (command.length > 0) {
                    command = command.slice(0, -1);
                }
            } else if (key === '\r') { // Enter
                const hasAlphabet = /[a-zA-Z]/.test(command);
                if (hasAlphabet || command.length > 20) {
                    this.#draw.setColors('rgb(255, 255, 255)', 'rgb(0, 0, 0)');
                    await this.#draw.drawPicture("kao3");
                    this.#draw.preset(380, 110);
                    if (hasAlphabet) {
                        this.#draw.drawText(" わ か り ま せ ん ");
                    } else {
                        this.#draw.drawText(" なかﾞすきﾞます ");
                    }
                    await sleep(1000);
                    await this.#draw.drawPicture("kao1");
                    this.#draw.setColors('rgb(255, 255, 255)', 'rgb(0, 127, 0)');
                    command = ""; // Reset command
                } else {
                    this.#draw.preset(11, 151);
                    this.#draw.drawText(` COMMAND =${command} `);
                    break; // Exit loop to process command
                }
            } else if (key.length === 1 && command.length < 28) {
                const newChar = (key === '-') ? 'ー' : key;
                command = convertRoman(command + newChar);
            }
        }
        return command.trim();
    }

    /**
     * Processes a command and returns the next scenario state.
     * @param {string} command
     * @param {number} intKr
     * @returns {ScenarioResult}
     * @private
     */
    processCommand(command, intKr) {
        let strD1, strD2;
        const spaceIndex = command.indexOf(' ');
        if (spaceIndex !== -1) {
            strD1 = command.substring(0, spaceIndex).trim();
            strD2 = command.substring(spaceIndex + 1).trim();
        } else {
            strD1 = command.trim();
            strD2 = "";
        }

        strD1 = strD1 || "ア";
        strD2 = strD2 || "ア";

        const hankakuD1 = getHankaku(strD1[0]);
        const hankakuD2 = getHankaku(strD2[0]);

        const hankakuKatakana = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ";
        const intDD = hankakuKatakana.indexOf(hankakuD1);
        const intDE = hankakuKatakana.indexOf(hankakuD2);

        if (intDD === -1) {
            return { nextState: 'wakarimasen', intIndex: 1, intD3: 4, intKr: 0 };
        }

        const d1WithParens = `(${strD1})`;
        const d2WithParens = `(${strD2})`;

        let intD3 = this.#mstrA[intDD].indexOf(d1WithParens);
        if (intD3 === -1) {
            return { nextState: 'wakarimasen', intIndex: 1, intD3: 4, intKr: 0 };
        }

        let intD4 = -1;
        if (intDE !== -1) {
            intD4 = this.#mstrB[intDE].indexOf(d2WithParens);
        }

        intD3 = parseInt(this.#mstrA[intDD].substring(intD3 + d1WithParens.length, intD3 + d1WithParens.length + 2)) * 1000;

        if (intD4 !== -1) {
            intD4 = parseInt(this.#mstrB[intDE].substring(intD4 + d2WithParens.length, intD4 + d2WithParens.length + 3));
        }
        intD3 = intD3 + (intD4 !== -1 ? intD4 : 0);
        let strL = String(intD3).padStart(5, '0');

        let newKr = 1;
        let found = false;
        while (newKr <= 6) {
            if (this.#mstrKE[newKr]) {
                const d4Index = this.#mstrKE[newKr].indexOf(strL);
                if (d4Index !== -1) {
                    intD3 = parseInt(this.#mstrKE[newKr].substring(d4Index + 6, d4Index + 8));
                    found = true;
                    break;
                }
            }
            newKr++;
        }

        if (!found) {
            return { nextState: 'wakarimasen', intIndex: 1, intD3: 4, intKr: 0 };
        }

        return { nextState: 'main', intIndex: 1, intD3, intKr: newKr };
    }

    /**
     * Advances the scenario based on the current state.
     * @param {number} intD3
     * @param {number} intIndex
     * @param {number} intKr
     * @returns {Promise<ScenarioResult>}
     * @private
     */
    async advanceScenario(intD3, intIndex, intKr) {
        let currentD3 = intD3;
        let currentIndex = intIndex;

        if (intKr > 3) {
            while (this.#mstrGG[currentD3].substring(currentIndex - 1, currentIndex) !== "+") {
                const val1 = parseInt(this.#mstrGG[currentD3].substring(currentIndex - 1, currentIndex + 1));
                const val2 = parseInt(this.#mstrGG[currentD3].substring(currentIndex + 1, currentIndex + 3));
                if (this.#mintIT[val1] === val2) {
                    currentIndex += 4;
                } else {
                    return { nextState: 'wakarimasen', intIndex: 1, intD3: 4, intKr: 0 };
                }
            }
            this.#mstrG[99] = this.#mstrGG[currentD3];
            currentD3 = 99;
        } else {
            let conditionMet = false;
            while (!conditionMet) {
                const scenarioLine = this.#mstrG[currentD3];
                if (!scenarioLine) {
                     return { nextState: 'wakarimasen', intIndex: 1, intD3: 4, intKr: 0 };
                }
                let tempIndex = 1;
                let allConditionsInLineMet = true;
                while (scenarioLine.substring(tempIndex - 1, tempIndex) !== "+") {
                    const val1 = parseInt(scenarioLine.substring(tempIndex - 1, tempIndex + 1));
                    const val2 = parseInt(scenarioLine.substring(tempIndex + 1, tempIndex + 3));
                    if (this.#mintIT[val1] !== val2) {
                        allConditionsInLineMet = false;
                        break;
                    }
                    tempIndex += 4;
                }
                if (allConditionsInLineMet) {
                    conditionMet = true;
                    currentIndex = tempIndex;
                } else {
                    currentD3++;
                }
            }
        }

        const scenario = this.#mstrG[currentD3];
        const plusPos = scenario.indexOf('+') + 1;
        const minusPos = scenario.indexOf('-');
        const message = scenario.substring(plusPos, minusPos);

        this.#draw.boxFill(10, 164, 500, 208, 'rgb(0, 127, 0)');
        let y = 170;
        let x = 10;
        for (const char of message) {
            if (char === '*') {
                y += 9;
                x = 8;
            } else {
                this.#draw.preset(x, y);
                this.#draw.drawText(char);
                x += 9; // Assuming fixed width
            }
        }

        const c1 = parseInt(scenario.substring(minusPos + 1, minusPos + 3));
        const c2 = parseInt(scenario.substring(minusPos + 3, minusPos + 5));
        this.#mintIT[c1] = c2;

        const c3 = parseInt(scenario.substring(minusPos + 5, minusPos + 7));
        const c4 = parseInt(scenario.substring(minusPos + 7, minusPos + 9));
        this.#mintIT[c3] = c4;

        const action = scenario.substring(minusPos + 9, minusPos + 10);
        const param = scenario.substring(minusPos + 10, minusPos + 12);

        switch (action) {
            case 'E':
                return { nextState: 'getcmd', intIndex: currentIndex, intD3: currentD3, intKr };
            case '?':
                const eventNum = parseInt(param);
                if (eventNum === 1) {
                    if (!await this.event1130()) { this.endGame(); return { nextState: 'end', intIndex: 1, intD3: 4, intKr: 0 }; }
                    this.#mintIT[1] = 3;
                    this.#mintIT[14] = 3;
                    return { nextState: 'main', intIndex: 1, intD3: 4, intKr: 0 };
                } else if (eventNum === 2) {
                    if (!await this.event1150()) { this.endGame(); return { nextState: 'end', intIndex: 1, intD3: 4, intKr: 0 }; }
                    return { nextState: 'main', intIndex: 1, intD3: 4, intKr: 0 };
                } else if (eventNum === 3) {
                    return { nextState: 'ending', intIndex: 1, intD3: 4, intKr: 0 };
                } else if (eventNum === 4) {
                    await this.drawPicture("CG39", 10);
                    if (!this.#isRunning) { this.endGame(); return { nextState: 'end', intIndex: 1, intD3: 4, intKr: 0 }; }
                    await this.loadScenario("SE25");
                    return { nextState: 'main', intIndex: 1, intD3: 4, intKr: 0 };
                } else if (eventNum === 5) {
                    return { nextState: 'ending', intIndex: 1, intD3: 4, intKr: 0 };
                }
                break;
            case 'G':
                this.#draw.setColors('rgb(255, 255, 255)', 'rgb(0, 0, 0)');
                await this.#draw.drawPicture("kao2");
                this.#draw.preset(380, 110);
                this.#draw.drawText(" ちょっと まってね ");
                await this.drawPicture(`CG${param}`, 10);
                if (!this.#isRunning) { this.endGame(); return { nextState: 'end', intIndex: 1, intD3: 4, intKr: 0 }; }
                await this.loadScenario(`SE${param}`);
                await this.#draw.drawPicture("kao1");
                this.#draw.setColors('rgb(255, 255, 255)', 'rgb(0, 127, 0)');
                return { nextState: 'main', intIndex: 1, intD3: 4, intKr: 0 };
            case 'S':
                await this.drawPicture(`CG${param}`, 10);
                if (!this.#isRunning) { this.endGame(); return { nextState: 'end', intIndex: 1, intD3: 4, intKr: 0 }; }
                return { nextState: 'getcmd', intIndex: 1, intD3: 4, intKr: 0 };
        }

        // Default fall-through
        this.#draw.setColors('rgb(255, 255, 255)', 'rgb(0, 0, 0)');
        await this.#draw.drawPicture("kao2");
        this.#draw.preset(360, 110);
        this.#draw.drawText(" Scenario Error ");
        return { nextState: 'end', intIndex: 1, intD3: 4, intKr: 0 };
    }

    /**
     * Shows the "wakarimasen" (unknown command) message.
     * @returns {Promise<void>}
     * @private
     */
    async showWakarimasen() {
        this.#draw.setColors('rgb(255, 255, 255)', 'rgb(0, 0, 0)');
        await this.#draw.drawPicture("kao3");
        this.#draw.preset(380, 110);
        this.#draw.drawText(" わ か り ま せ ん ");
        await sleep(1000);
        await this.#draw.drawPicture("kao1");
        this.#draw.setColors('rgb(255, 255, 255)', 'rgb(0, 127, 0)');
    }

    /**
     * Displays the item list.
     * @returns {Promise<void>}
     * @private
     */
    async funcItem() {
        this.#draw.setColors('rgb(255, 0, 0)', 'rgb(0, 127, 0)');
        this.#draw.preset(365, 151);
        this.#draw.drawText("モチモノ");

        this.#draw.boxFill(10, 164, 500, 208, 'rgb(0, 127, 0)');
        this.#draw.setColors('rgb(255, 255, 255)', 'rgb(0, 127, 0)');

        let x = -20;
        let y = 170;
        for (let i = 1; i <= 16; i++) {
            x += 60;
            if (x > 455) {
                x = 40;
                y += 8;
            }
            if (this.#mintIT[i] === 2) {
                this.#draw.preset(x, y);
                this.#draw.drawText(this.#mstrKN[i]);
            }
        }

        await sleep(500);
        this.#draw.preset(365, 151);
        this.#draw.drawText("モチモノ");
    }

    /**
     * Saves the game state.
     * @returns {Promise<void>}
     * @private
     */
    async funcSave() {
        this.#draw.setColors('rgb(255, 0, 0)', 'rgb(0, 127, 0)');
        this.#draw.preset(416, 151);
        this.#draw.drawText("セーフﾞ");

        this.#draw.boxFill(10, 164, 500, 208, 'rgb(0, 127, 0)');
        this.#draw.setColors('rgb(255, 255, 255)', 'rgb(0, 127, 0)');
        this.#draw.preset(10, 170);
        this.#draw.drawText(" テﾞータ セーフﾞ   すこし まってくたﾞさい ");

        const saveData = {
            q1: this.#mstrQ1,
            q2: this.#mstrQ2,
            it: this.#mintIT,
        };
        localStorage.setItem('lp32-save', JSON.stringify(saveData));

        await sleep(500);
        this.#draw.preset(10, 180);
        this.#draw.drawText(" おわりました ");
        this.#draw.preset(416, 151);
        this.#draw.drawText("セーフﾞ");
    }

    /**
     * Loads the game state.
     * @returns {Promise<void>}
     * @private
     */
    async funcLoad() {
        this.#draw.setColors('rgb(0, 0, 0)', 'rgb(255, 255, 255)');
        await this.#draw.drawPicture("kao2");
        this.#draw.preset(380, 110);
        this.#draw.drawText(" ちょっと まってね ");

        this.#draw.setColors('rgb(255, 0, 0)', 'rgb(0, 127, 0)');
        this.#draw.preset(461, 151);
        this.#draw.drawText("ロートﾞ");

        this.#draw.boxFill(10, 164, 500, 208, 'rgb(0, 127, 0)');
        this.#draw.setColors('rgb(255, 255, 255)', 'rgb(0, 127, 0)');
        this.#draw.preset(10, 170);
        this.#draw.drawText(" テﾞータ ロートﾞ   すこし まってくたﾞさい ");

        const savedData = localStorage.getItem('lp32-save');
        if (savedData) {
            const { q1, q2, it } = JSON.parse(savedData);
            this.#mstrQ1 = q1;
            this.#mstrQ2 = q2;
            this.#mintIT = it;
        }

        await sleep(500);

        await this.#draw.drawPicture("kao1");
        this.#draw.preset(10, 180);
        this.#draw.drawText(" おわりました ");
        this.#draw.preset(461, 151);
        this.#draw.drawText("ロートﾞ");

        await this.drawPicture(this.#mstrQ1, 10);
        if (!this.#isRunning) return;
        await this.loadScenario(this.#mstrQ2);
    }

    /**
     * Plays the opening event.
     * @returns {Promise<boolean>}
     * @private
     */
    async eventOpening() {
        this.#draw.setColors('rgb(255, 255, 255)', 'rgb(0, 0, 0)');

        await this.#draw.drawPicture("littleup", 10);
        if (!this.#isRunning) return false;
        this.#draw.preset(10, 160);
        this.#draw.drawText(" DEMOを みる なら space みないなら そのたの キー ");
        const key = await this.waitKey();
        if (key === "") return false;
        if (key !== " ") return true;

        await this.#draw.drawPicture("PAFFEUP", 10);
        if (!this.#isRunning) return false;
        this.#draw.preset(20, 200);
        this.#draw.drawText(" ほﾟか ほﾟか と はれた ある にちようひﾞ ★");
        if (await this.waitKey() === "") return false;

        this.#draw.preset(20, 200);
        this.#draw.drawText(" とっても かわいい かのしﾞょの みきちゃんと テﾞートてﾞす★");
        if (await this.waitKey() === "") return false;

        this.#draw.preset(20, 200);
        this.#draw.drawText(" てﾞも ふこうな てﾞきこﾞとは とつせﾞん やってきた   ★");
        if (await this.waitKey() === "") return false;

        await this.#draw.drawPicture("PAFFEUP2");
        this.#draw.preset(20, 200);
        this.#draw.drawText(" とつせﾞん そら かﾞ まっくら に なったと おもうと   ★");
        if (await this.waitKey() === "") return false;

        await this.#draw.drawPicture("WAHAHA", 10);
        if (!this.#isRunning) return false;
        await this.#draw.drawPicture("WAHAHA2");
        this.#draw.preset(20, 200);
        this.#draw.drawText(" くろいマントを はおった トﾞラキュラ かﾞ         ★");
        if (await this.waitKey() === "") return false;

        this.#draw.preset(20, 200);
        this.#draw.drawText(" みきちゃん を さらっていって しまった           ★");
        if (await this.waitKey() === "") return false;

        this.#draw.preset(20, 200);
        this.#draw.drawText(" ほﾞくは けんめいに トﾞラキュラを おった         ★");
        if (await this.waitKey() === "") return false;

        this.#draw.preset(20, 200);
        this.#draw.drawText(" きかﾞ つくと そこは みしらぬ せかいたﾞった       ★");
        if (await this.waitKey() === "") return false;

        this.#draw.preset(20, 200);
        this.#draw.drawText(" みきちゃん きっと たすけたﾞして あけﾞるよ まっててくれ ★");
        if (await this.waitKey() === "") return false;

        return true;
    }

    /**
     * Plays event 1130.
     * @returns {Promise<boolean>}
     * @private
     */
    async event1130() {
        await this.drawPicture("cg07a", 10);
        if (!this.#isRunning) return false;

        this.#draw.boxFill(10, 164, 500, 208, 'rgb(0, 127, 0)');
        this.#draw.preset(10, 180);
        this.#draw.drawText(" おんなのこ ｢えへへへへ ほﾞうや いらっしやい ｣ ");
        this.#draw.preset(10, 190);
        this.#draw.drawText(" うわー からたﾞの ちからかﾞ すいとられる     あなたは いつのまにか きをうしなって しまった★");
        if (await this.waitKey() === "") return false;

        await this.drawPicture("CG01", 10);
        if (!this.#isRunning) return false;
        await this.loadScenario("SE01");
        return true;
    }

    /**
     * Plays event 1150.
     * @returns {Promise<boolean>}
     * @private
     */
    async event1150() {
        await this.drawPicture("CG13A", 10);
        if (!this.#isRunning) return false;

        this.#draw.boxFill(10, 164, 500, 208, 'rgb(0, 127, 0)');
        this.#draw.preset(10, 170);
        this.#draw.drawText(" おんなのこは しﾞょうふﾞつ したようてﾞす   これてﾞ このこも かそﾞくのもとへ いけるてﾞしょう ");
        this.#draw.preset(10, 180);
        this.#draw.drawText(" しかし なんてﾞ はたﾞかに なるのかな ? ");
        this.#draw.preset(10, 190);
        this.#draw.drawText(" やや へやかﾞ ゆれたﾞしたそﾞ いそいてﾞ いえを てﾞょう★");
        if (await this.waitKey() === "") return false;

        await this.drawPicture("CG99", 10);
        if (!this.#isRunning) return false;

        this.#draw.boxFill(10, 164, 500, 208, 'rgb(0, 127, 0)');
        this.#draw.preset(10, 170);
        this.#draw.drawText(" これは もしかしたら トﾞラキュラのしろてﾞは ないのか ");
        this.#draw.preset(10, 180);
        this.#draw.drawText(" おんなのこの しﾞょうふﾞつかﾞ なにかえいきょうしたようたﾞ ");
        this.#draw.preset(10, 190);
        this.#draw.drawText(" よし とりあえすﾞ のりこむそﾞ★");
        if (await this.waitKey() === "") return false;

        await this.drawPicture("CG20", 10);
        if (!this.#isRunning) return false;
        await this.loadScenario("SE20");
        return true;
    }

    /**
     * Plays the ending event.
     * @returns {Promise<boolean>}
     * @private
     */
    async eventEnding() {
        this.#draw.setColors('rgb(255, 255, 255)', 'rgb(0, 127, 0)');

        await this.drawPicture("CG91", 10);
        if (!this.#isRunning) return false;
        this.#draw.boxFill(10, 164, 500, 208, 'rgb(0, 127, 0)');
        this.#draw.preset(10, 170);
        this.#draw.drawText(" トﾞラキュラは ほろんたﾞ あなたは ふﾞしﾞ みきちゃんを たすけたﾞしたのたﾞ ");
        this.#draw.preset(10, 180);
        this.#draw.drawText(" しかし ここは とﾞこなんたﾞろう とﾞちらにいけはﾞ もとの せかいに もとﾞれるのたﾞろうか ");
        this.#draw.preset(10, 190);
        this.#draw.drawText(" みきちゃんは しんはﾟいそうに ほﾞくの かおを のそﾞきこんたﾞ ");
        await sleep(1000);
        if (await this.waitKey() === "") return false;

        this.#isStop = false;

        this.#draw.boxFill(0, 0, 512, 424, 'rgb(0, 0, 0)');
        await this.drawPicture("END2", 10);
        if (!this.#isRunning) return false;

        this.#draw.setColors('rgb(255, 255, 255)', 'rgb(0, 0, 0)');
        this.#draw.preset(30, 10);
        this.#draw.drawText(" リトル フﾟリンセス ");
        this.#draw.preset(30, 40);
        this.#draw.drawText("   (レモネートﾞ 1コﾞウ カイソﾞウ)");
        this.#draw.preset(30, 60);
        this.#draw.drawText("      CHAMPION SOFT ");
        this.#draw.preset(30, 80);
        this.#draw.drawText("         T･A･D･A    ");
        this.#draw.preset(30, 150);
        this.#draw.drawText("    お し ま い  ");

        return true;
    }

    /**
     * Initializes game data.
     * @returns {Promise<boolean>}
     * @private
     */
    async initializeMika() {
        this.#mstrKN[1] = "ヒララレモン";
        this.#mstrKN[2] = "たけのこ";
        this.#mstrKN[3] = "シーチキン";
        this.#mstrKN[4] = "りんこﾞ";
        this.#mstrKN[5] = "ぬいくﾞるみ";
        this.#mstrKN[6] = "かきﾞ";
        this.#mstrKN[7] = "おの";
        this.#mstrKN[8] = "きﾞんのおの";
        this.#mstrKN[9] = "きんのおの";
        this.#mstrKN[10] = "にんにく";
        this.#mstrKN[11] = "こうすい";
        this.#mstrKN[12] = "たおる";
        this.#mstrKN[13] = "しﾞゅうしﾞか";
        this.#mstrKN[14] = "タﾞイヤ";
        this.#mstrKN[15] = "サファイヤ";
        this.#mstrKN[16] = "ルヒﾞー";

        this.#mstrKE[4] = "01008(01)01004(02)01010(03)01001(04)01002(05)01003(06)01005(07)01007(08)01006(09)01009(10)01011(11)01012(12)01013(13)01015(14)01014(15)01016(16)10000(17)11000(18)12000(19)13000(20)03008(21)03004(22)03010(23)03001(24)03009(25)";
        this.#mstrKE[5] = "23015(26)23014(27)23016(28)09008(29)09004(30)09010(31)09001(32)09002(33)09003(34)09005(35)09007(36)09006(37)09009(38)09011(39)09012(40)09013(41)09015(42)09014(43)09016(44)01088(45)";
        this.#mstrKE[6] = "24065(46)24023(47)02067(48)02081(49)24074(50)24075(51)24073(52)01025(53)";

        try {
            this.#mstrGG = KAZUMI;
            this.#mstrA = VERBS;
            this.#mstrB = NOUNS;
        } catch (e) {
            console.error(e);
            return false;
        }

        await this.drawPicture("WAKU");
        await this.#draw.drawPicture("kao1");

        this.#draw.setColors('rgb(255, 255, 255)', 'rgb(0, 127, 0)');
        this.#draw.preset(365, 151);
        this.#draw.drawText("モチモノ");
        this.#draw.preset(416, 151);
        this.#draw.drawText("セーフﾞ");
        this.#draw.preset(461, 151);
        this.#draw.drawText("ロートﾞ");

        this.#isStop = true;
        return true;
    }

    /**
     * Draws a picture and updates the last picture file name.
     * @param {string} file
     * @param {number} [wait=0]
     * @returns {Promise<void>}
     * @private
     */
    async drawPicture(file, wait = 0) {
        this.#mstrQ1 = file;
        await this.#draw.drawPicture(file, wait);
    }

    /**
     * Loads a scenario file.
     * @param {string} file
     * @returns {Promise<void>}
     * @private
     */
    async loadScenario(file) {
        try {
            this.#mstrG = SCENARIO[file];
            this.#mstrQ2 = file;
            this.#mstrKE[1] = this.#mstrG[1] || "";
            this.#mstrKE[2] = this.#mstrG[2] || "";
            this.#mstrKE[3] = this.#mstrG[3] || "";
        } catch (e) {
            console.error(`Failed to load scenario ${file}`, e);
            this.#isRunning = false;
        }
    }

    /**
     * Ends the game.
     * @private
     */
    endGame() {
        this.#isRunning = false;
        console.log("Game Over");
    }
}
