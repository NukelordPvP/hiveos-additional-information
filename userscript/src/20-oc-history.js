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
 null,

 raw:
 data.raw || null
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
        pl,
        raw = null
    ) {
        const history = loadOcHistory(gpu);
        const incoming = { core, memory, pl };
        const fields = ['core', 'memory', 'pl'];
        const validFields = fields.filter(field =>
            Number.isFinite(incoming[field])
        );

        // HiveOS sometimes renders an unavailable field as "-". Do not let
        // one missing field block detection of changes to the other fields.
        if (validFields.length === 0) return history;

        const hasBaseline = fields.some(field =>
            Number.isFinite(history[field])
        );

        if (!hasBaseline) {
            for (const field of validFields) {
                history[field] = incoming[field];
            }
            history.raw = { ...(history.raw || {}), ...(raw || {}) };
            history.startTime = Date.now();
            saveOcHistory(gpu, history);
            return history;
        }

        const changedFields = validFields.filter(field => {
            const oldValue = history[field];
            if (!Number.isFinite(oldValue)) return false;
            if (oldValue !== incoming[field]) return true;

            // For cells such as PL, HiveOS can change the selected text while
            // the first numeric token remains the same. Use raw text as a
            // secondary signal only when both versions are available.
            const oldRaw = history.raw?.[field];
            const newRaw = raw?.[field];
            return typeof oldRaw === 'string' && oldRaw.trim() !== '' &&
                typeof newRaw === 'string' && newRaw.trim() !== '' &&
                oldRaw.trim() !== newRaw.trim();
        });

        if (changedFields.length > 0) {
            history.previous = {
                core: Number.isFinite(history.core) ? history.core : null,
                memory: Number.isFinite(history.memory) ? history.memory : null,
                pl: Number.isFinite(history.pl) ? history.pl : null,
                raw: history.raw || null,
                startTime: history.startTime,
                endTime: Date.now(),
                averageHashrate: history.sampleCount > 0
                    ? history.sumHashrate / history.sampleCount : null,
                averageEfficiency: history.sampleCount > 0
                    ? history.sumEfficiency / history.sampleCount : null
            };

            history.startTime = Date.now();
            history.sampleCount = 0;
            history.sumHashrate = 0;
            history.sumEfficiency = 0;
        }

        // Update only values that HiveOS actually supplied. Keep the last
        // known value for a field that is temporarily blank/unavailable.
        for (const field of validFields) {
            history[field] = incoming[field];
        }
        if (raw) {
            history.raw = { ...(history.raw || {}), ...Object.fromEntries(
                fields.filter(field => validFields.includes(field) &&
                    typeof raw[field] === 'string' && raw[field].trim() !== '')
                    .map(field => [field, raw[field]])
            ) };
        }

        saveOcHistory(gpu, history);
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
