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
                pl,
                liveOc.raw
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

            if (core === null && memory === null && pl === null) {
                continue;
            }

            // updateOcHistory handles each valid field independently; a blank
            // MEM/Core/PL cell must not suppress changes detected elsewhere.
            const history = updateOcHistory(gpu, core, memory, pl, liveOc.raw);

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
