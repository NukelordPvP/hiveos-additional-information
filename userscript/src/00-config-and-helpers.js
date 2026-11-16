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
