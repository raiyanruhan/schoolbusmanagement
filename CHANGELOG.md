# Changelog

## Version 2.0.4 — 2026-09-15

* Fixed the app crashing on first launch on a fresh install (`SqliteError: no such table: routes`) — migrations were declared newest-first and ran in that literal order, so v5 tried to `ALTER TABLE routes` before v1 had created it; migrations now run in ascending version order

## Version 2.0.3 — 2026-09-14

* Fixed the app silently failing to open on some machines — startup errors (e.g. a native-module load failure) were previously swallowed, leaving background processes running with no window; startup is now wrapped so failures are logged to `fatal.log` in the app's data folder and shown in an error dialog

## Version 2.0.2 — 2026-09-13

* Fixed GitHub releases publishing as drafts instead of going live — electron-builder defaults to `draft: true`; `build.publish.releaseType` is now explicitly set to `"release"`

## Version 2.0.1 — 2026-09-13

* Licensed the source code under the Business Source License 1.1 (converts to MIT four years after each version's publication)
* Added a proper End-User License Agreement (`EULA.txt`), shown and required during setup
* Switched the Windows installer from one-click to a full wizard: Welcome → License Agreement → Choose Install Location → Install → Finish

## Version 2.0.0 — 2026-09-13

* Added an auto-update pipeline: installed apps check GitHub Releases in the background and download quietly, with a dismissible banner for optional updates and a blocking restart screen for updates an author marks mandatory in `update-manifest.json`
* Replaced every default Electron icon (window, taskbar, installer, uninstaller) with the Hylith logo
* Added author/contributor metadata (Hylith, Raiyan Bin Rashid, Jotirmoy Bhowmik) to the packaged installer's file properties
* Optimized the Windows installer: one-click NSIS install, x64-only target, maximum compression, desktop and Start Menu shortcuts
* Replaced the old `PRD.MD`/`stack.MD` working notes with `README.md`, this changelog, `LICENSE`, `SECURITY.md`, and `CONTRIBUTING.md`

## Version 1.1.0 — 2026-08-18

* Added inbound and outbound travel times to routes, used by the assignment engine's arrival-deadline math
* Ignored completed runs in conflict detection so finished trips stop triggering false bus-availability conflicts
* Enhanced shift management timing fields and updated the audio notice text in Settings
* Removed the redundant standalone Shift Management page
* Fixed the Display Board layout when boys' and girls' buses are combined on the same run
* Enhanced audio recording, trimming, and stop-timestamp management UI for announcements
* Added cross-shift bus availability checking and time-collision conflict detection
* Removed a redundant icon element from the operational health flash message on the Dashboard

## Version 1.0.0 — 2026-08-18

* Initial release: fleet, route, stop, and shift management
* Daily planner with both manual and automatic (best-plan) run assignment
* Incident tracking and conflict detection
* Display Board with route-segment run grouping and per-shift/direction configuration
* Voice announcement system — continuous loop playback, shift-based announcement groups, audio recording and waveform trimming
* GitHub Actions CI/CD workflows and initial electron-updater wiring
