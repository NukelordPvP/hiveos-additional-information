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
