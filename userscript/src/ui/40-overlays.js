// OC timer, OC values, GPU state and countdown UI
// This file is concatenated into the userscript by scripts/build.mjs.

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


        column.innerHTML = '';


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


            container.innerHTML = '';


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
    // GPU STATE COLUMN
    //
    // Added to the GPU hardware information area.
    //
    // MATCHING = current Core/MEM/PL equal saved previous Core/MEM/PL
    // CHANGED  = one or more settings differ
    // NO PREVIOUS = there is no saved previous OC yet
    // ============================================================

    function getOrCreateGpuStateElement(
        row
    ) {
        // Place the badge in the GPU hardware-information cell.
        // Appending it to the whole row with position:absolute/right
        // overlaps HiveOS's native fan, controls and action area.
        const hardwareCell = row.children[0];

        if (!hardwareCell) {
            return null;
        }

        let state =
        hardwareCell.querySelector(
            ':scope > .nuke-gpu-state'
        );

        if (state) {
            return state;
        }

        state = document.createElement('span');
        state.className = 'nuke-gpu-state';
        state.style.display = 'inline-block';
        state.style.position = 'static';
        state.style.marginLeft = '8px';
        state.style.verticalAlign = 'middle';
        state.style.fontSize = '9px';
        state.style.fontWeight = '700';
        state.style.lineHeight = '14px';
        state.style.padding = '1px 5px';
        state.style.borderRadius = '4px';
        state.style.whiteSpace = 'nowrap';
        state.style.pointerEvents = 'none';
        state.style.zIndex = '1';

        hardwareCell.appendChild(state);
        return state;
    }


    function updateGpuState(
        row,
        history
    ) {
        const state =
        getOrCreateGpuStateElement(
            row
        );

        if (!state) {
            return;
        }

        if (
            !history ||
            !history.previous
        ) {
            state.textContent =
            'NO PREVIOUS';

        state.style.color =
        '#9ca3af';

        state.style.background =
        'rgba(156, 163, 175, 0.12)';

        return;
        }


        const matchesPrevious =
        history.core === history.previous.core &&
        history.memory === history.previous.memory &&
        history.pl === history.previous.pl;


        if (matchesPrevious) {
            state.textContent =
            'MATCHING';

        state.style.color =
        '#22c55e';

        state.style.background =
        'rgba(34, 197, 94, 0.12)';

        } else {
            state.textContent =
            'CHANGED';

        state.style.color =
        '#f59e0b';

        state.style.background =
        'rgba(245, 158, 11, 0.12)';
        }
    }


    // ============================================================
    // GLOBAL REFRESH COUNTDOWN
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
