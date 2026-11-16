// ==UserScript==
// @name         HiveOS PearlHash TH + TH/W + OC Lifetime Averages
// @namespace    https://hiveos.farm/
// @version      34.1
// @description  Persists current and previous OC settings for every GPU and detects changes after page refresh
// @match        https://the.hiveos.farm/*
// @match        https://*.hiveos.farm/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const CHECK_INTERVAL = 2000;

    // Versioned rig-specific storage prevents GPU 0 on one worker from
    // sharing history with GPU 0 on another worker. The HiveOS worker URL
    // URL origin + pathname identifies the active rig. Query/hash
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
            encodeURIComponent(getRigIdentifier()) +
            '-gpu-' +
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

            // Always preserve the last observed settings, even if
            // the OC changed before a mining sample was collected.
            // This is what allows a refresh to detect and display
            // the previous settings reliably.
            history.previous = {
                core: history.core,
                memory: history.memory,
                pl: history.pl,
                startTime: history.startTime,
                endTime: Date.now(),

 // Averages are only available when samples exist.
 averageHashrate: history.sampleCount > 0
 ? history.sumHashrate / history.sampleCount
 : null,

 averageEfficiency: history.sampleCount > 0
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


            saveOcHistory(
                gpu,
                history
            );
        }


        return history;
    }


    // ============================================================
    // ADD CURRENT OC SAMPLE
    // ============================================================

    function addCurrentOcSample(
        gpu,
        hashrate,
        efficiency
    ) {
        const history =
        loadOcHistory(gpu);


        history.sampleCount++;

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

    function getCurrentOcAverages(history) {
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

    function getPreviousOcAverages(history) {
        const previous =
        history?.previous;

        if (!previous) {
            return {
                hashrate: null,
                efficiency: null
            };
        }


        return {
            hashrate:
            previous.averageHashrate,

            efficiency:
            previous.averageEfficiency
        };
    }


    // ============================================================
    // CUSTOM COLUMN HELPERS
    // ============================================================

    function getOrCreateCell(
        row,
        id,
        className
    ) {
        let cell =
        row.querySelector(
            `:scope > .${className}`
        );


        if (cell) {
            return cell;
        }


        cell =
        document.createElement('div');

        cell.className =
        className;

        cell.id =
        id;

        cell.style.position =
        'absolute';

        cell.style.top =
        '0';

        cell.style.height =
        '100%';

        cell.style.display =
        'flex';

        cell.style.flexDirection =
        'column';

        cell.style.alignItems =
        'center';

        cell.style.justifyContent =
        'center';

        cell.style.whiteSpace =
        'nowrap';

        cell.style.fontSize =
        '11px';

        cell.style.lineHeight =
        '14px';

        cell.style.pointerEvents =
        'none';

        cell.style.zIndex =
        '5';

        row.appendChild(cell);


        return cell;
    }


    function positionOcColumn(row) {
        const cell =
        getOrCreateCell(
            row,
            'nuke-oc-column',
            'nuke-oc-column'
        );


        const plCell =
        row.children[8];


        if (!plCell) {
            return;
        }


        const rect =
        plCell.getBoundingClientRect();

        const rowRect =
        row.getBoundingClientRect();


        cell.style.left =
        `${rect.left - rowRect.left}px`;

        cell.style.width =
        `${rect.width}px`;


        return cell;
    }


    function positionEfficiencyColumn(row) {
        const cell =
        getOrCreateCell(
            row,
            'nuke-efficiency-column',
            'nuke-efficiency-column'
        );


        const powerCell =
        row.children[5];


        if (!powerCell) {
            return;
        }


        const rect =
        powerCell.getBoundingClientRect();

        const rowRect =
        row.getBoundingClientRect();


        cell.style.left =
        `${rect.left - rowRect.left}px`;

        cell.style.width =
        `${rect.width}px`;


        return cell;
    }


    // ============================================================
    // HASHRATE COLUMN
    // ============================================================

    function updateHashrateColumn(
        row,
        currentHashrate,
        averageHashrate,
        previousHashrate
    ) {
        const cell =
        getOrCreateCell(
            row,
            'nuke-hashrate-column',
            'nuke-hashrate-column'
        );


        const nativeCell =
        row.children[2];


        if (!nativeCell) {
            return;
        }


        const rect =
        nativeCell.getBoundingClientRect();

        const rowRect =
        row.getBoundingClientRect();


        cell.style.left =
        `${rect.left - rowRect.left}px`;

        cell.style.width =
        `${rect.width}px`;


        const current =
        currentHashrate !== null
        ? `${currentHashrate.toFixed(2)}`
        : '--';


        const average =
        averageHashrate !== null
        ? `${averageHashrate.toFixed(2)}`
        : '--';


        const previous =
        previousHashrate !== null
        ? `${previousHashrate.toFixed(2)}`
        : '--';


        cell.innerHTML = `
        <div style="color:#fff;">${current}</div>
        <div style="color:#22c55e;">${average}</div>
        <div style="color:#f59e0b;">${previous}</div>
        `;
    }


    // ============================================================
    // EFFICIENCY COLUMN
    // ============================================================

    function updateEfficiencyColumn(
        row,
        currentEfficiency,
        averageEfficiency,
        previousEfficiency
    ) {
        const cell =
        positionEfficiencyColumn(row);


        if (!cell) {
            return;
        }


        const current =
        currentEfficiency !== null
        ? currentEfficiency.toFixed(3)
        : '--';


        const average =
        averageEfficiency !== null
        ? averageEfficiency.toFixed(3)
        : '--';


        const previous =
        previousEfficiency !== null
        ? previousEfficiency.toFixed(3)
        : '--';


        cell.innerHTML = `
        <div style="color:#fff;">${current}</div>
        <div style="color:#22c55e;">${average}</div>
        <div style="color:#f59e0b;">${previous}</div>
        `;
    }


    // ============================================================
    // OC TIMER COLUMN
    // ============================================================

    function updateOcColumn(
        row,
        history
    ) {
        const cell =
        positionOcColumn(row);


        if (!cell) {
            return;
        }


        const elapsed =
        (Date.now() - history.startTime) / 1000;


        cell.innerHTML = `
        <div style="color:#fff;">${formatDuration(elapsed)}</div>
        `;
    }


    // ============================================================
    // CURRENT / PREVIOUS OC VALUES
    // ============================================================

    function updateCurrentPreviousValues(
        row,
        history
    ) {
        const core =
        history.core !== null
        ? history.core
        : '--';

        const memory =
        history.memory !== null
        ? history.memory
        : '--';

        const pl =
        history.pl !== null
        ? history.pl
        : '--';


        const previous =
        history.previous;


        const previousCore =
        previous?.core ?? '--';

        const previousMemory =
        previous?.memory ?? '--';

        const previousPL =
        previous?.pl ?? '--';


        const coreCell =
        row.children[6];

        const memoryCell =
        row.children[7];

        const plCell =
        row.children[8];


        if (
            coreCell &&
            !coreCell.querySelector('.nuke-current-previous')
        ) {
            const wrapper =
            document.createElement('div');

            wrapper.className =
            'nuke-current-previous';

        wrapper.style.display =
        'flex';

        wrapper.style.flexDirection =
        'column';

        wrapper.style.alignItems =
        'center';

        wrapper.style.fontSize =
        '10px';

        wrapper.style.lineHeight =
        '12px';

        coreCell.appendChild(wrapper);
        }


        if (
            memoryCell &&
            !memoryCell.querySelector('.nuke-current-previous')
        ) {
            const wrapper =
            document.createElement('div');

            wrapper.className =
            'nuke-current-previous';

        wrapper.style.display =
        'flex';

        wrapper.style.flexDirection =
        'column';

        wrapper.style.alignItems =
        'center';

        wrapper.style.fontSize =
        '10px';

        wrapper.style.lineHeight =
        '12px';

        memoryCell.appendChild(wrapper);
        }


        if (
            plCell &&
            !plCell.querySelector('.nuke-current-previous')
        ) {
            const wrapper =
            document.createElement('div');

            wrapper.className =
            'nuke-current-previous';

        wrapper.style.display =
        'flex';

        wrapper.style.flexDirection =
        'column';

        wrapper.style.alignItems =
        'center';

        wrapper.style.fontSize =
        '10px';

        wrapper.style.lineHeight =
        '12px';

        plCell.appendChild(wrapper);
        }


        const coreWrapper =
        coreCell?.querySelector('.nuke-current-previous');

        const memoryWrapper =
        memoryCell?.querySelector('.nuke-current-previous');

        const plWrapper =
        plCell?.querySelector('.nuke-current-previous');


        if (coreWrapper) {
            coreWrapper.innerHTML = `
            <div style="color:#22c55e;">${core}</div>
            <div style="color:#f59e0b;">${previousCore}</div>
            `;
        }


        if (memoryWrapper) {
            memoryWrapper.innerHTML = `
            <div style="color:#22c55e;">${memory}</div>
            <div style="color:#f59e0b;">${previousMemory}</div>
            `;
        }


        if (plWrapper) {
            plWrapper.innerHTML = `
            <div style="color:#22c55e;">${pl}</div>
            <div style="color:#f59e0b;">${previousPL}</div>
            `;
        }
    }


    // ============================================================
    // GPU SETTINGS STATE BADGE
    //
    // MATCHING = live OC matches saved previous OC
    // CHANGED  = live OC differs from saved previous OC
    // NO PREVIOUS = no previous OC exists
    // ============================================================

    function updateGpuSettingsState(
        row,
        history,
        core,
        memory,
        pl
    ) {
        const hardwareCell =
        row.children[0];

        if (!hardwareCell) {
            return;
        }


        let state =
        hardwareCell.querySelector(
            '.nuke-gpu-settings-state'
        );


        if (!state) {
            state =
            document.createElement('span');

            state.className =
            'nuke-gpu-settings-state';

            state.style.display =
            'inline-block';

        state.style.marginLeft =
        '6px';

        state.style.padding =
        '2px 5px';

        state.style.borderRadius =
        '4px';

        state.style.fontSize =
        '9px';

        state.style.fontWeight =
        'bold';

        state.style.lineHeight =
        '12px';

        state.style.verticalAlign =
        'middle';

        hardwareCell.appendChild(state);
        }


        const previous =
        history.previous;


        if (!previous) {
            state.textContent =
            'NO PREVIOUS';

        state.style.color =
        '#9ca3af';

        state.style.background =
        'rgba(156,163,175,0.14)';

        state.title =
        'No previous OC settings have been recorded';

        return;
        }


        const matchesPrevious =
        previous.core === core &&
        previous.memory === memory &&
        previous.pl === pl;


        if (matchesPrevious) {
            state.textContent =
            'MATCHING';

        state.style.color =
        '#22c55e';

        state.style.background =
        'rgba(34,197,94,0.14)';

        state.title =
        'Current live OC matches the saved previous OC settings';

        } else {
            state.textContent =
            'CHANGED';

        state.style.color =
        '#f59e0b';

        state.style.background =
        'rgba(245,158,11,0.14)';

        state.title =
        'At least one current OC setting differs from the saved previous settings';
        }
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


            // Detect and display OC state even while HiveOS is still
            // loading hashrate/power after a page refresh.
            if (
                core === null ||
                memory === null ||
                pl === null
            ) {
                continue;
            }

            const ocHistory = updateOcHistory(gpu, core, memory, pl);
            updateGpuSettingsState(row, ocHistory, core, memory, pl);

            if (
                hashrate === null ||
                power === null ||
                power <= 0
            ) {
                updateCurrentPreviousValues(row, ocHistory);
                updateOcColumn(row, ocHistory);
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

            updateGpuSettingsState(
                row,
                history,
                getCore(row),
                                   getMemory(row),
                                   getPL(row)
            );


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
    //
    // On every page load/refresh, scan the rendered GPU rows and
    // compare their live Core/MEM/PL values against each GPU's
    // saved current settings in localStorage. If any differ,
    // the saved settings become "previous" and the live values
    // become "current". Each rig has its own storage namespace.
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
