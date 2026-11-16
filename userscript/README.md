# HiveOS Additional Information — Userscript Project

This is a modular source project for a general-purpose HiveOS interface enhancement userscript. It is not tied to any particular miner, algorithm, coin, or workload.

The source is split into focused files for easier maintenance. The build combines them into one installable Tampermonkey userscript; no external npm dependencies are required.

## Build

Requires Node.js 18 or newer. From this directory run:

```bash
npm run build
npm run check
```

The installable file is generated at `dist/HiveOS_Additional_Information.user.js`. Import that file into Tampermonkey.

## Source layout

- `src/config.js` — central settings, including scan interval.
- `src/00-config-and-helpers.js` — shared helpers, rig identity and storage key utilities.
- `src/10-hiveos-dom.js` — GPU row discovery and HiveOS value readers.
- `src/20-oc-history.js` — persistent per-rig/per-GPU overclock history and averages.
- `src/ui/30-metrics.js` — hashrate and efficiency displays.
- `src/ui/40-overlays.js` — OC timer, current/previous OC values, state indicator and refresh countdown.
- `src/50-app.js` — scan orchestration, timers and browser event handlers.
- `scripts/build.mjs` — assembles the modules into the installable userscript.
- `userscript-header.txt` — Tampermonkey metadata header.

## Architecture

The source files are concatenated in a fixed order into one userscript closure. This avoids runtime module-loading issues in Tampermonkey while allowing the source to remain modular. Edit files under `src/`, not the generated file under `dist/`.

## Existing data compatibility

The internal localStorage key prefix is intentionally retained from the previous implementation so existing per-rig OC history is not discarded when changing the project name. It is an internal compatibility detail, not the product name.

## Current scope

This is the modularized baseline of the existing HiveOS enhancement script. The project structure makes future additions independent of any particular miner or workload. Features such as more resilient DOM observation and isolated module error handling can be added in later changes.


## OC change detection

OC settings are polled every second and sampled on the existing five-second scan. Core, MEM, and PL are handled independently: a temporarily blank/unavailable field no longer blocks detection of changes in the other fields. The last known value is retained for unavailable fields. Parsed values are compared, with native cell text used as a secondary signal for cells such as PL where the selected text can change while the first numeric token stays the same. When a change is detected, the prior known settings are saved as `previous` before valid new values become current.
