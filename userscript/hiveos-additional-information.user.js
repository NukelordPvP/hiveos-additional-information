// ==UserScript==
// @name         HiveOS PearlHash TH + TH/W + OC Lifetime Averages
// @namespace    https://hiveos.farm/
// @version      32.0
// @description  Adds current/previous OC TH and TH/W averages, OC timers, OC history, and global refresh countdown to HiveOS GPU rows
// @match        https://the.hiveos.farm/*
// @match        https://*.hiveos.farm/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const CHECK_INTERVAL = 5000;

    const OC_STORAGE_PREFIX =
    'nuke-hiveos-oc-history-';

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


    // ============================================================
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
    // IMPORTANT:
    //
    // These indexes must remain unchanged.
    //
    // [2] = TH
    // [5] = Power
    // [6] = Core
    // [7] = MEM
    // [8] = PL
    //
    // All custom columns are absolutely positioned so they do
    // NOT change the native HiveOS child indexes.
    // ============================================================

    function getHashrate(row) {
        const cell =
        row.children[2];

        if (!cell) {
            return null;
        }

        return parseNumber(
            cell.innerText
        );
    }


    function getPower(row) {
        const cell =
        row.children[5];

        if (!cell) {
            return null;
        }

        return parseNumber(
            cell.innerText
        );
    }


    function getCore(row) {
        const cell =
        row.children[6];

        if (!cell) {
            return null;
        }

        return parseNumber(
            cell.innerText
        );
    }


    function getMemory(row) {
        const cell =
        row.children[7];

        if (!cell) {
            return null;
        }

        return parseNumber(
            cell.innerText
        );
    }


    function getPL(row) {
        const cell =
        row.children[8];

        if (!cell) {
            return null;
        }

        return parseNumber(
            cell.innerText
        );
    }


    // ============================================================
    // OC STORAGE
    //
    // Each GPU stores:
    //
    // Current OC:
    //   core
    //   memory
    //   PL
    //   startTime
    //   sampleCount
    //   sumHashrate
    //   sumEfficiency
    //
    // Previous OC:
    //   core
    //   memory
    //   PL
    //   startTime
    //   endTime
    //   averageHashrate
    //   averageEfficiency
    // ============================================================

    function getOcStorageKey(gpu) {
        return (
            OC_STORAGE_PREFIX +
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
    // This is called BEFORE adding the current sample.
    //
    // Therefore, if the OC changes, the current sample belongs
    // to the NEW OC run.
    // ============================================================

    function updateOcHistory(
        gpu,
        core,
        memory,
        pl
    ) {
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
            if (
                history.sampleCount > 0
            ) {
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
 history.sumHashrate /
 history.sampleCount,

 averageEfficiency:
 history.sumEfficiency /
 history.sampleCount
                };
            }


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
    //
    // These values accumulate for the ENTIRE current OC lifetime.
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
    // TH COLUMN
    //
    // avg cur: XX.XX TH
    // prev avg: XX.XX TH
    //
    // avg cur follows the current OC timer.
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


        // --------------------------------------------------------
        // CURRENT OC AVERAGE TH
        // --------------------------------------------------------

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


        // --------------------------------------------------------
        // PREVIOUS OC AVERAGE TH
        // --------------------------------------------------------

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
    //
    // This is a SEPARATE column.
    //
    // cur: X.XXX TH/W
    // avg cur: X.XXX TH/W
    // prev avg: X.XXX TH/W
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


        column.innerHTML =
        '';


        // --------------------------------------------------------
        // CURRENT EFFICIENCY
        // --------------------------------------------------------

        const current =
        document.createElement(
            'div'
        );

        current.textContent =
        `cur: ${currentEfficiency.toFixed(3)} TH/W`;

        column.appendChild(
            current
        );


        // --------------------------------------------------------
        // CURRENT OC AVERAGE EFFICIENCY
        // --------------------------------------------------------

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


        // --------------------------------------------------------
        // PREVIOUS OC AVERAGE EFFICIENCY
        // --------------------------------------------------------

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


        column.innerHTML =
        '';


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


            container.innerHTML =
            '';


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


        // Previous
        if (
            previousValue !== null &&
            previousValue !== undefined
        ) {
            const previous =
            document.createElement(
                'div'
            );

            previous.textContent =
            `prev: ${previousValue}`;

            previous.style.opacity =
            '0.65';

            container.appendChild(
                previous
            );
        }
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
    // GLOBAL REFRESH COUNTDOWN
    //
    // ONE timer for the whole table.
    //
    // It is positioned above the TH column.
    // It is NOT part of each GPU row.
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

            const core =
            getCore(row);

            const memory =
            getMemory(row);

            const pl =
            getPL(row);


            if (
                hashrate === null ||
                power === null ||
                power <= 0
            ) {
                continue;
            }


            // ----------------------------------------------------
            // INSTANTANEOUS EFFICIENCY
            // ----------------------------------------------------

            const efficiency =
            hashrate /
            power;


            // ----------------------------------------------------
            // UPDATE OC FIRST
            //
            // If OC changed, this creates the new OC run before
            // this sample gets added.
            // ----------------------------------------------------

            const ocHistory =
            updateOcHistory(
                gpu,
                core,
                memory,
                pl
            );


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
        }


        // --------------------------------------------------------
        // GLOBAL REFRESH TIMER
        // --------------------------------------------------------

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


            const history =
            loadOcHistory(gpu);


            if (
                history.core === null ||
                history.memory === null ||
                history.pl === null
            ) {
                continue;
            }


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
