// ==UserScript==
// @name         HiveOS Additional Information
// @namespace    https://hiveos.farm/
// @version      35.2.0
// @description  GPU metrics, overclock history, timers and additional HiveOS interface information
// @match        https://the.hiveos.farm/*
// @match        https://*.hiveos.farm/*
// @grant        none
// ==/UserScript==

(function () {
'use strict';

/* ===== src/config.js ===== */
// Central settings. Edit these values instead of searching through the app.
// The legacy implementation currently reads CHECK_INTERVAL from this declaration.
const CHECK_INTERVAL = 5000;


/* ===== src/00-config-and-helpers.js ===== */
// Configuration and common helpers
// This file is concatenated into the userscript by scripts/build.mjs.


    // Versioned rig-specific storage prevents GPU 0 on one worker from
    // sharing history with GPU 0 on another worker. The HiveOS worker URL
    // origin + pathname identifies the active rig. Query/hash
    // fragments are intentionally excluded so refreshes and tabs
    // keep using the same saved history key.
    const OC_STORAGE_PREFIX =
    'nuke-hiveos-oc-history-rig-v2-';

    function getRigIdentifier() {
        return (
            window.location.origin +
            window.location.pathname
        );
    }

    let secondsRemaining =
    CHECK_INTERVAL / 1000;


    // ============================================================
    // HELPERS
    // ============================================================

    function parseNumber(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return null;
        }

        const match =
        String(value)
        .replace(/,/g, '')
        .match(/-?\d+(?:\.\d+)?/);

        if (!match) {
            return null;
        }

        const number =
        parseFloat(match[0]);

        return Number.isFinite(number)
        ? number
        : null;
    }


    function formatDuration(seconds) {
        seconds =
        Math.max(
            0,
            Math.floor(seconds)
        );

        const hours =
        Math.floor(
            seconds / 3600
        );

        const minutes =
        Math.floor(
            (seconds % 3600) / 60
        );

        const secs =
        seconds % 60;


        if (hours > 0) {
            return (
                `${hours}h ` +
                `${String(minutes).padStart(2, '0')}m`
            );
        }


        if (minutes > 0) {
            return (
                `${minutes}m ` +
                `${String(secs).padStart(2, '0')}s`
            );
        }


        return `${secs}s`;
    }


    function getRigStoragePrefix() {
        return (
            OC_STORAGE_PREFIX +
            encodeURIComponent(
                getRigIdentifier()
            ) +
            '-gpu-'
        );
    }


    // ============================================================


/* ===== src/10-hiveos-dom.js ===== */
// HiveOS GPU discovery and value parsing
// This file is concatenated into the userscript by scripts/build.mjs.

    // GPU ROW DETECTION
    // ============================================================

    function getGpuRows() {
        const rows = [];

        document
        .querySelectorAll('div')
        .forEach(el => {
            const text =
            el.innerText || '';

            if (
                /^GPU \d+\s+/i.test(text) &&
                text.includes('GeForce') &&
                el.children.length >= 9
            ) {
                const gpu =
                getGpuNumber(el);

                if (
                    gpu !== null &&
                    !rows.includes(el)
                ) {
                    rows.push(el);
                }
            }
        });

        return rows;
    }


    function getGpuNumber(row) {
        const text =
        row.innerText || '';

        const match =
        text.match(
            /^GPU\s+(\d+)/i
        );

        if (!match) {
            return null;
        }

        return parseInt(
            match[1],
            10
        );
    }


    // ============================================================
    // NATIVE HIVEOS CELLS
    //
    // [2] = TH
    // [5] = Power
    // [6] = Core
    // [7] = MEM
    // [8] = PL
    //
    // Custom columns are positioned absolutely so native
    // HiveOS child indexes remain unchanged.
    // ============================================================

    // Read the original HiveOS cell contents only. Our own UI overlays are
    // injected into Core/MEM/PL cells; reading cell.innerText directly can
    // accidentally read our own saved "cur:" value and feed it back as if it
    // were the live GPU setting. Clone the cell and remove all owned overlays.
    function getNativeCellText(row, index) {
        const cell = row?.children?.[index];
        if (!cell) return '';

        const clone = cell.cloneNode(true);
        clone.querySelectorAll(
            '.nuke-oc-values, .nuke-th-container, .nuke-efficiency-column, .nuke-oc-column, .nuke-gpu-state, #nuke-global-refresh-countdown'
        ).forEach(node => node.remove());

        return (clone.innerText || clone.textContent || '').trim();
    }

    function getNativeCellNumber(row, index) {
        return parseNumber(getNativeCellText(row, index));
    }

    function getHashrate(row) {
        return getNativeCellNumber(row, 2);
    }

    function getPower(row) {
        return getNativeCellNumber(row, 5);
    }

    function getCore(row) {
        return getNativeCellNumber(row, 6);
    }

    function getMemory(row) {
        return getNativeCellNumber(row, 7);
    }

    function getPL(row) {
        return getNativeCellNumber(row, 8);
    }

    function getLiveOcSettings(row) {
        return {
            core: getCore(row),
            memory: getMemory(row),
            pl: getPL(row),
            raw: {
                core: getNativeCellText(row, 6),
                memory: getNativeCellText(row, 7),
                pl: getNativeCellText(row, 8)
            }
        };
    }

    // ============================================================


/* ===== src/20-oc-history.js ===== */
// Per-rig, per-GPU persistent OC history and averages
// This file is concatenated into the userscript by scripts/build.mjs.

    // OC STORAGE
    // ============================================================

    function getOcStorageKey(gpu) {
        return (
            getRigStoragePrefix() +
            gpu
        );
    }


    function createEmptyOcHistory() {
        return {
            core: null,
            memory: null,
            pl: null,

            startTime:
            Date.now(),

 sampleCount:
 0,

 sumHashrate:
 0,

 sumEfficiency:
 0,

 previous:
 null
        };
    }


    function loadOcHistory(gpu) {
        try {
            const raw =
            localStorage.getItem(
                getOcStorageKey(gpu)
            );

            if (!raw) {
                return createEmptyOcHistory();
            }

            const data =
            JSON.parse(raw);

            if (
                !data ||
                typeof data !== 'object'
            ) {
                return createEmptyOcHistory();
            }


            return {
                core:
                data.core ?? null,

                memory:
                data.memory ?? null,

                pl:
                data.pl ?? null,

                startTime:
                Number(data.startTime) ||
                Date.now(),

 sampleCount:
 Number(data.sampleCount) ||
 0,

 sumHashrate:
 Number(data.sumHashrate) ||
 0,

 sumEfficiency:
 Number(data.sumEfficiency) ||
 0,

 previous:
 data.previous ||
 null
            };

        } catch (error) {
            console.warn(
                '[Nuke HiveOS] Failed to load OC history:',
                error
            );

            return createEmptyOcHistory();
        }
    }


    function saveOcHistory(
        gpu,
        history
    ) {
        try {
            localStorage.setItem(
                getOcStorageKey(gpu),
                                 JSON.stringify(history)
            );

        } catch (error) {
            console.warn(
                '[Nuke HiveOS] Failed to save OC history:',
                error
            );
        }
    }


    // ============================================================
    // UPDATE OC
    //
    // Called whenever valid OC settings are available.
    // Does not require hashrate or power to be loaded.
    // ============================================================

    function updateOcHistory(
        gpu,
        core,
        memory,
        pl
    ) {
        if (
            core === null ||
            memory === null ||
            pl === null
        ) {
            return loadOcHistory(gpu);
        }

        const history =
        loadOcHistory(gpu);


        const initialized =
        history.core !== null &&
        history.memory !== null &&
        history.pl !== null;


        // --------------------------------------------------------
        // FIRST OBSERVATION
        // --------------------------------------------------------

        if (!initialized) {
            history.core =
            core;

            history.memory =
            memory;

            history.pl =
            pl;

            history.startTime =
            Date.now();

            history.sampleCount =
            0;

            history.sumHashrate =
            0;

            history.sumEfficiency =
            0;

            saveOcHistory(
                gpu,
                history
            );

            return history;
        }


        // --------------------------------------------------------
        // CHECK FOR OC CHANGE
        // --------------------------------------------------------

        const changed =
        history.core !== core ||
        history.memory !== memory ||
        history.pl !== pl;


        if (changed) {

            // Save the completed OC as previous.
            history.previous = {
                core:
                history.core,

                memory:
                history.memory,

                pl:
                history.pl,

                startTime:
                history.startTime,

                endTime:
                Date.now(),

 averageHashrate:
 history.sampleCount > 0
 ? history.sumHashrate / history.sampleCount
 : null,

 averageEfficiency:
 history.sampleCount > 0
 ? history.sumEfficiency / history.sampleCount
 : null
            };


            // Start new OC.
            history.core =
            core;

            history.memory =
            memory;

            history.pl =
            pl;

            history.startTime =
            Date.now();

            history.sampleCount =
            0;

            history.sumHashrate =
            0;

            history.sumEfficiency =
            0;
        }


        saveOcHistory(
            gpu,
            history
        );

        return history;
    }


    // ============================================================
    // ADD CURRENT SAMPLE
    // ============================================================

    function addCurrentOcSample(
        gpu,
        hashrate,
        efficiency
    ) {
        const history =
        loadOcHistory(gpu);


        history.sampleCount += 1;

        history.sumHashrate +=
        hashrate;

        history.sumEfficiency +=
        efficiency;


        saveOcHistory(
            gpu,
            history
        );


        return history;
    }


    // ============================================================
    // CURRENT OC AVERAGES
    // ============================================================

    function getCurrentOcAverages(
        history
    ) {
        if (
            !history ||
            history.sampleCount <= 0
        ) {
            return {
                hashrate: null,
                efficiency: null
            };
        }


        return {
            hashrate:
            history.sumHashrate /
            history.sampleCount,

            efficiency:
            history.sumEfficiency /
            history.sampleCount
        };
    }


    // ============================================================
    // PREVIOUS OC AVERAGES
    // ============================================================

    function getPreviousOcAverages(
        history
    ) {
        if (
            !history ||
            !history.previous
        ) {
            return {
                hashrate: null,
                efficiency: null
            };
        }


        return {
            hashrate:
            Number.isFinite(
                history.previous.averageHashrate
            )
            ? history.previous.averageHashrate
            : null,

            efficiency:
            Number.isFinite(
                history.previous.averageEfficiency
            )
            ? history.previous.averageEfficiency
            : null
        };
    }


    // ============================================================


/* ===== src/ui/30-metrics.js ===== */
// TH and TH/W display
// This file is concatenated into the userscript by scripts/build.mjs.

    // TH COLUMN
    // ============================================================

    function updateHashrateColumn(
        row,
        currentHashrate,
        currentOcAverage,
        previousHashrate
    ) {
        const cell =
        row.children[2];

        if (!cell) {
            return;
        }


        let container =
        cell.querySelector(
            ':scope > .nuke-th-container'
        );


        if (!container) {
            container =
            document.createElement(
                'div'
            );

            container.className =
            'nuke-th-container';

                container.style.fontSize =
                '10px';

                container.style.lineHeight =
                '11px';

                container.style.whiteSpace =
                'nowrap';

                container.style.marginTop =
                '2px';

            container.style.pointerEvents =
            'none';

            container.style.position =
            'relative';

            container.style.zIndex =
            '10';

            cell.appendChild(
                container
            );
        }


        container.innerHTML = '';


        if (
            currentOcAverage !== null
        ) {
            const average =
            document.createElement(
                'div'
            );

            average.textContent =
            `avg cur: ${currentOcAverage.toFixed(2)} TH`;

            average.style.opacity =
            '0.8';

            container.appendChild(
                average
            );
        }


        if (
            previousHashrate !== null
        ) {
            const previous =
            document.createElement(
                'div'
            );

            previous.textContent =
            `prev avg: ${previousHashrate.toFixed(2)} TH`;

            previous.style.opacity =
            '0.8';

            container.appendChild(
                previous
            );
        }
    }


    // ============================================================
    // EFFICIENCY COLUMN
    // ============================================================

    function getOrCreateEfficiencyColumn(
        row
    ) {
        let column =
        row.querySelector(
            ':scope > .nuke-efficiency-column'
        );


        if (column) {
            return column;
        }


        column =
        document.createElement(
            'div'
        );

        column.className =
        'nuke-efficiency-column';

            column.style.position =
            'absolute';

            column.style.top =
            '0px';

            column.style.width =
            '95px';

            column.style.display =
            'flex';

            column.style.flexDirection =
            'column';

            column.style.justifyContent =
            'center';

            column.style.fontSize =
            '10px';

            column.style.lineHeight =
            '13px';

            column.style.whiteSpace =
            'nowrap';

            column.style.pointerEvents =
            'none';

            column.style.zIndex =
            '20';

            row.style.position =
            'relative';

            row.appendChild(
                column
            );


            return column;
    }


    function positionEfficiencyColumn(
        row
    ) {
        const hashrateCell =
        row.children[2];

        if (!hashrateCell) {
            return;
        }


        const column =
        getOrCreateEfficiencyColumn(
            row
        );


        const width =
        95;

        const gap =
        5;


        column.style.left =
        `${Math.max(
            0,
            hashrateCell.offsetLeft -
            width -
            gap
        )}px`;
    }


    function updateEfficiencyColumn(
        row,
        currentEfficiency,
        currentOcAverage,
        previousEfficiency
    ) {
        const column =
        getOrCreateEfficiencyColumn(
            row
        );


        positionEfficiencyColumn(
            row
        );


        column.innerHTML = '';


        const current =
        document.createElement(
            'div'
        );

        current.textContent =
        `cur: ${currentEfficiency.toFixed(3)} TH/W`;

        column.appendChild(
            current
        );


        if (
            currentOcAverage !== null
        ) {
            const average =
            document.createElement(
                'div'
            );

            average.textContent =
            `avg cur: ${currentOcAverage.toFixed(3)} TH/W`;

            average.style.opacity =
            '0.8';

            column.appendChild(
                average
            );
        }


        if (
            previousEfficiency !== null
        ) {
            const previous =
            document.createElement(
                'div'
            );

            previous.textContent =
            `prev avg: ${previousEfficiency.toFixed(3)} TH/W`;

            previous.style.opacity =
            '0.8';

            column.appendChild(
                previous
            );
        }
    }


    // ============================================================


/* ===== src/ui/40-overlays.js ===== */
// OC timer, OC values, GPU state and countdown UI
// This file is concatenated into the userscript by scripts/build.mjs.

    // OC TIMER COLUMN
    // ============================================================

    function getOrCreateOcColumn(
        row
    ) {
        let column =
        row.querySelector(
            ':scope > .nuke-oc-column'
        );


        if (column) {
            return column;
        }


        column =
        document.createElement(
            'div'
        );

        column.className =
        'nuke-oc-column';

            column.style.position =
            'absolute';

            column.style.top =
            '0px';

            column.style.width =
            '58px';

            column.style.display =
            'flex';

            column.style.flexDirection =
            'column';

            column.style.justifyContent =
            'center';

            column.style.fontSize =
            '10px';

            column.style.lineHeight =
            '13px';

            column.style.whiteSpace =
            'nowrap';

            column.style.pointerEvents =
            'none';

            column.style.zIndex =
            '30';

            row.style.position =
            'relative';

            row.appendChild(
                column
            );


            return column;
    }


    function positionOcColumn(
        row
    ) {
        const hashrateCell =
        row.children[2];

        if (!hashrateCell) {
            return;
        }


        const column =
        getOrCreateOcColumn(
            row
        );


        const efficiencyWidth =
        95;

        const efficiencyGap =
        5;

        const ocWidth =
        58;

        const ocGap =
        5;


        const efficiencyLeft =
        hashrateCell.offsetLeft -
        efficiencyWidth -
        efficiencyGap;


        const ocLeft =
        efficiencyLeft -
        ocWidth -
        ocGap;


        column.style.left =
        `${Math.max(
            0,
            ocLeft
        )}px`;
    }


    function updateOcColumn(
        row,
        history
    ) {
        const column =
        getOrCreateOcColumn(
            row
        );


        positionOcColumn(
            row
        );


        column.innerHTML = '';


        const elapsed =
        Math.floor(
            (
                Date.now() -
                history.startTime
            ) / 1000
        );


        const timer =
        document.createElement(
            'div'
        );

        timer.textContent =
        `OC: ${formatDuration(elapsed)}`;


        column.appendChild(
            timer
        );
    }


    // ============================================================
    // CORE / MEM / PL CURRENT + PREVIOUS
    // ============================================================

    function updateOcValueDisplay(
        cell,
        currentValue,
        previousValue
    ) {
        if (!cell) {
            return;
        }


        cell.style.position =
        'relative';


            let container =
            cell.querySelector(
                ':scope > .nuke-oc-values'
            );


            if (!container) {
                container =
                document.createElement(
                    'div'
                );

                container.className =
                'nuke-oc-values';

                    container.style.position =
                    'absolute';

                    container.style.left =
                    '0px';

        container.style.right =
        '0px';

        container.style.top =
        '25px';

        container.style.fontSize =
        '9px';

        container.style.lineHeight =
        '10px';

        container.style.whiteSpace =
        'nowrap';

        container.style.textAlign =
        'center';

        container.style.pointerEvents =
        'none';

        container.style.zIndex =
        '50';

        cell.appendChild(
            container
        );
            }


            container.innerHTML = '';


            // Current
            if (
                currentValue !== null &&
                currentValue !== undefined
            ) {
                const current =
                document.createElement(
                    'div'
                );

                current.textContent =
                `cur: ${currentValue}`;

                container.appendChild(
                    current
                );
            }


            // Always show a distinct previous line. Never substitute current values.
            const previous = document.createElement('div');
            previous.textContent = `prev: ${
                previousValue !== null && previousValue !== undefined
                    ? previousValue
                    : '—'
            }`;
            previous.style.opacity = '0.75';
            previous.style.color = '#f59e0b';
            container.appendChild(previous);
    }


    function updateCurrentPreviousValues(
        row,
        history
    ) {
        if (!history) {
            return;
        }


        updateOcValueDisplay(
            row.children[6],
            history.core,
            history.previous
            ? history.previous.core
            : null
        );


        updateOcValueDisplay(
            row.children[7],
            history.memory,
            history.previous
            ? history.previous.memory
            : null
        );


        updateOcValueDisplay(
            row.children[8],
            history.pl,
            history.previous
            ? history.previous.pl
            : null
        );
    }


    // ============================================================
    // GPU STATE COLUMN
    //
    // Added to the GPU hardware information area.
    //
    // MATCHING = current Core/MEM/PL equal saved previous Core/MEM/PL
    // CHANGED  = one or more settings differ
    // NO PREVIOUS = there is no saved previous OC yet
    // ============================================================

    function getOrCreateGpuStateElement(
        row
    ) {
        // Place the badge in the GPU hardware-information cell.
        // Appending it to the whole row with position:absolute/right
        // overlaps HiveOS's native fan, controls and action area.
        const hardwareCell = row.children[0];

        if (!hardwareCell) {
            return null;
        }

        let state =
        hardwareCell.querySelector(
            ':scope > .nuke-gpu-state'
        );

        if (state) {
            return state;
        }

        state = document.createElement('span');
        state.className = 'nuke-gpu-state';
        state.style.display = 'inline-block';
        state.style.position = 'static';
        state.style.marginLeft = '8px';
        state.style.verticalAlign = 'middle';
        state.style.fontSize = '9px';
        state.style.fontWeight = '700';
        state.style.lineHeight = '14px';
        state.style.padding = '1px 5px';
        state.style.borderRadius = '4px';
        state.style.whiteSpace = 'nowrap';
        state.style.pointerEvents = 'none';
        state.style.zIndex = '1';

        hardwareCell.appendChild(state);
        return state;
    }


    function updateGpuState(row, history) {
        const state = getOrCreateGpuStateElement(row);
        if (!state) return;

        if (!history || !history.previous) {
            state.textContent = 'PREV: NONE';
            state.title = 'No previous OC configuration has been saved yet';
            state.style.color = '#9ca3af';
            state.style.background = 'rgba(156, 163, 175, 0.12)';
            return;
        }

        const previousMatchesLive =
            history.core === history.previous.core &&
            history.memory === history.previous.memory &&
            history.pl === history.previous.pl;

        if (previousMatchesLive) {
            state.textContent = 'PREV: MATCHING';
            state.title = 'Live Core/MEM/PL settings match the saved previous OC';
            state.style.color = '#22c55e';
            state.style.background = 'rgba(34, 197, 94, 0.12)';
        } else {
            state.textContent = 'PREV: DIFFERENT';
            state.title = 'Saved previous OC differs from live/current Core/MEM/PL settings';
            state.style.color = '#f59e0b';
            state.style.background = 'rgba(245, 158, 11, 0.12)';
        }
    }

    // ============================================================
    // GLOBAL REFRESH COUNTDOWN
    // ============================================================

    function getOrCreateGlobalRefresh() {
        let element =
        document.getElementById(
            'nuke-global-refresh-countdown'
        );


        if (element) {
            return element;
        }


        element =
        document.createElement(
            'div'
        );

        element.id =
        'nuke-global-refresh-countdown';

            element.style.position =
            'fixed';

            element.style.fontSize =
            '9px';

        element.style.lineHeight =
        '11px';

        element.style.whiteSpace =
        'nowrap';

        element.style.opacity =
        '0.65';

        element.style.pointerEvents =
        'none';

        element.style.zIndex =
        '999999';

        document.body.appendChild(
            element
        );


        return element;
    }


    function updateGlobalRefreshCountdown() {
        const rows =
        getGpuRows();


        if (!rows.length) {
            return;
        }


        const firstRow =
        rows[0];

        const hashrateCell =
        firstRow.children[2];


        if (!hashrateCell) {
            return;
        }


        const refresh =
        getOrCreateGlobalRefresh();


        const rect =
        hashrateCell.getBoundingClientRect();


        const left =
        rect.left +
        (rect.width / 2);


        const top =
        rect.top -
        15;


        refresh.textContent =
        `↻ ${secondsRemaining}s`;


        refresh.style.left =
        `${left}px`;

        refresh.style.top =
        `${Math.max(
            0,
            top
        )}px`;

        refresh.style.transform =
        'translateX(-50%)';
    }


    // ============================================================


/* ===== src/50-app.js ===== */
// GPU scan loop, timers and event handlers
// This file is concatenated into the userscript by scripts/build.mjs.

    // MAIN GPU SCAN
    // ============================================================

    function scanGPUs() {
        const rows =
        getGpuRows();


        for (const row of rows) {

            const gpu =
            getGpuNumber(row);


            if (gpu === null) {
                continue;
            }


            const hashrate =
            getHashrate(row);

            const power =
            getPower(row);

            const liveOc = getLiveOcSettings(row);
            const { core, memory, pl } = liveOc;


            // ----------------------------------------------------
            // UPDATE OC SETTINGS FIRST
            //
            // This is independent of hashrate and power.
            // It allows changes to be detected after a page refresh
            // even before mining statistics have loaded.
            // ----------------------------------------------------

            const ocHistory =
            updateOcHistory(
                gpu,
                core,
                memory,
                pl
            );

            if (core === null || memory === null || pl === null) {
                console.warn('[HiveOS Additional Information] Could not read all live OC fields', {
                    gpu,
                    core: liveOc.raw.core,
                    memory: liveOc.raw.memory,
                    pl: liveOc.raw.pl
                });
            }


            // ----------------------------------------------------
            // UPDATE GPU STATE
            // ----------------------------------------------------

            updateGpuState(
                row,
                ocHistory
            );


            // ----------------------------------------------------
            // REQUIRE VALID MINING DATA FOR TH/W STATISTICS
            // ----------------------------------------------------

            if (
                hashrate === null ||
                power === null ||
                power <= 0
            ) {
                updateOcColumn(
                    row,
                    ocHistory
                );

                updateCurrentPreviousValues(
                    row,
                    ocHistory
                );

                continue;
            }


            // ----------------------------------------------------
            // INSTANTANEOUS EFFICIENCY
            // ----------------------------------------------------

            const efficiency =
            hashrate /
            power;


            // ----------------------------------------------------
            // ADD CURRENT SAMPLE TO CURRENT OC
            // ----------------------------------------------------

            const updatedHistory =
            addCurrentOcSample(
                gpu,
                hashrate,
                efficiency
            );


            // ----------------------------------------------------
            // CURRENT OC AVERAGES
            // ----------------------------------------------------

            const currentOc =
            getCurrentOcAverages(
                updatedHistory
            );


            // ----------------------------------------------------
            // PREVIOUS OC AVERAGES
            // ----------------------------------------------------

            const previousOc =
            getPreviousOcAverages(
                updatedHistory
            );


            // ----------------------------------------------------
            // TH COLUMN
            // ----------------------------------------------------

            updateHashrateColumn(
                row,
                hashrate,
                currentOc.hashrate,
                previousOc.hashrate
            );


            // ----------------------------------------------------
            // SEPARATE TH/W COLUMN
            // ----------------------------------------------------

            updateEfficiencyColumn(
                row,
                efficiency,
                currentOc.efficiency,
                previousOc.efficiency
            );


            // ----------------------------------------------------
            // OC TIMER
            // ----------------------------------------------------

            updateOcColumn(
                row,
                updatedHistory
            );


            // ----------------------------------------------------
            // CORE / MEM / PL
            // ----------------------------------------------------

            updateCurrentPreviousValues(
                row,
                updatedHistory
            );


            // ----------------------------------------------------
            // GPU STATE
            // ----------------------------------------------------

            updateGpuState(
                row,
                updatedHistory
            );
        }


        updateGlobalRefreshCountdown();
    }


    // ============================================================
    // UPDATE PER-GPU TIMERS
    //
    // Runs every second without adding another mining sample.
    // ============================================================

    function updateTimers() {
        const rows =
        getGpuRows();


        for (const row of rows) {

            const gpu =
            getGpuNumber(row);


            if (gpu === null) {
                continue;
            }


            // Poll LIVE HiveOS OC values every timer tick. A page refresh is
            // not required when Core, MEM or PL changes. updateOcHistory()
            // archives the old current settings as previous when a difference
            // is detected, then starts a new current OC period.
            const liveOc = getLiveOcSettings(row);
            const { core, memory, pl } = liveOc;

            if (core === null || memory === null || pl === null) {
                console.warn('[HiveOS Additional Information] OC polling could not read all live fields', {
                    gpu,
                    core: liveOc.raw.core,
                    memory: liveOc.raw.memory,
                    pl: liveOc.raw.pl
                });
                continue;
            }

            const history = updateOcHistory(gpu, core, memory, pl);

            // Update the displayed current/previous values and badge as soon
            // as the changed settings are detected, independent of mining data.
            updateCurrentPreviousValues(row, history);
            updateGpuState(row, history);

            // OC timer
            updateOcColumn(
                row,
                history
            );


            // Current/previous OC values
            updateCurrentPreviousValues(
                row,
                history
            );


            // GPU state
            updateGpuState(
                row,
                history
            );
        }


        updateGlobalRefreshCountdown();
    }


    // ============================================================
    // INITIAL START
    // ============================================================

    setTimeout(() => {

        secondsRemaining =
        CHECK_INTERVAL / 1000;

        scanGPUs();

    }, 1500);


    // ============================================================
    // ONE-SECOND TIMER
    // ============================================================

    setInterval(() => {

        secondsRemaining--;


        if (
            secondsRemaining < 0
        ) {
            secondsRemaining = 0;
        }


        updateTimers();

    }, 1000);


    // ============================================================
    // FIVE-SECOND MINING SAMPLE
    // ============================================================

    setInterval(() => {

        secondsRemaining =
        CHECK_INTERVAL / 1000;

        scanGPUs();

    }, CHECK_INTERVAL);


    // ============================================================
    // RESIZE
    // ============================================================

    function repositionCustomColumns() {
        const rows =
        getGpuRows();


        for (const row of rows) {

            positionOcColumn(
                row
            );

            positionEfficiencyColumn(
                row
            );
        }


        updateGlobalRefreshCountdown();
    }


    window.addEventListener(
        'resize',
        repositionCustomColumns
    );


    // ============================================================
    // SCROLL
    // ============================================================

    window.addEventListener(
        'scroll',
        updateGlobalRefreshCountdown,
        true
    );

})();
