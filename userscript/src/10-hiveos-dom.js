// HiveOS GPU discovery and value parsing
// This file is concatenated into the userscript by scripts/build.mjs.

    // GPU ROW DETECTION
    // ============================================================

    function getGpuRows() {
        // HiveOS can contain nested wrappers whose innerText begins with
        // "GPU N". Select the actual GPU hardware row and keep one row per GPU.
        const candidates = Array.from(document.querySelectorAll('div'))
            .filter(el => {
                if (el.children.length < 9) return false;
                const firstCellText =
                    el.children[0]?.innerText ||
                    el.children[0]?.textContent ||
                    '';
                return /^GPU\s+\d+/i.test(firstCellText.trim()) &&
                    firstCellText.includes('GeForce');
            });

        const byGpu = new Map();
        for (const row of candidates) {
            const gpu = getGpuNumber(row);
            if (gpu === null) continue;
            const existing = byGpu.get(gpu);
            if (!existing || row.children.length < existing.children.length) {
                byGpu.set(gpu, row);
            }
        }

        return Array.from(byGpu.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([, row]) => row);
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
            '[class*="nuke-"], #nuke-global-refresh-countdown'
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
