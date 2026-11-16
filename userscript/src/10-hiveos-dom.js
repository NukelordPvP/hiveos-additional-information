// HiveOS GPU discovery and value parsing
// This file is concatenated into the userscript by scripts/build.mjs.

    // GPU ROW DETECTION
    // ============================================================

    function getGpuRows() {
        const candidates = [];

        document.querySelectorAll('div').forEach(el => {
            const text = el.innerText || '';

            if (
                /^GPU \d+\s+/i.test(text) &&
                text.includes('GeForce') &&
                el.children.length >= 9
            ) {
                const gpu = getGpuNumber(el);
                if (gpu !== null) candidates.push({ row: el, gpu });
            }
        });

        // Nested HiveOS wrappers can also match the text test above.
        // Process exactly one actual row per GPU: prefer the candidate
        // whose native HiveOS cells parse correctly, then the smallest
        // direct-child count to avoid outer wrappers.
        const selected = new Map();

        for (const candidate of candidates) {
            const { row, gpu } = candidate;
            const values = [
                getNativeCellNumber(row, 2), // hashrate
                getNativeCellNumber(row, 5), // power
                getNativeCellNumber(row, 6), // core
                getNativeCellNumber(row, 7), // memory
                getNativeCellNumber(row, 8)  // PL
            ];
            const score = values.filter(value => value !== null).length;
            const previous = selected.get(gpu);

            if (
                !previous ||
                score > previous.score ||
                (score === previous.score &&
                    row.children.length < previous.row.children.length)
            ) {
                selected.set(gpu, { row, score });
            }
        }

        return Array.from(selected.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([, item]) => item.row);
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
