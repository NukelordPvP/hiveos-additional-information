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
