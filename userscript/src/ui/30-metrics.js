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
