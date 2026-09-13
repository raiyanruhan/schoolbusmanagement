<h1 align="center">School Bus Manager</h1>

<h3 align="center">Offline-first desktop app for planning, dispatching, and announcing daily school bus runs.</h3>

---

## Table of Contents

* [Overview](#overview)
* [Policy, rules and guidelines](#policy-rules-and-guidelines)
* [Project layout](#project-layout)
  * [Main process](#main-process)
  * [Renderer](#renderer)
  * [Shared types](#shared-types)
* [Adding a new feature end-to-end](#adding-a-new-feature-end-to-end)
* [Commit conventions](#commit-conventions)
* [Before opening a pull request](#before-opening-a-pull-request)
* [How releases are built and published](#how-releases-are-built-and-published)
* [Reporting bugs and requesting features](#reporting-bugs-and-requesting-features)
* [Reporting security vulnerabilities](#reporting-security-vulnerabilities)

## Overview

[`raiyanruhan/schoolbusmanagement`](https://github.com/raiyanruhan/schoolbusmanagement) is the source repository for School Bus Manager, an Electron + React + TypeScript desktop app built by [Hylith](https://hylith.com). This is closed, proprietary software built for a specific school's operation — the repository isn't open to public contributions, but this document exists so both maintainers (and anyone Hylith brings onto the project later) work the same way.

This document covers how the project is laid out, the conventions the codebase already follows, and what's expected before a change is merged.

## Policy, rules and guidelines

The renderer never talks to Node.js, the filesystem, or the database directly — everything crosses the process boundary through the typed API in `src/preload/index.ts`. A new feature that needs main-process data must add to that API, not work around it.

Every mutation goes through a repository (`src/main/repositories/`), never raw SQL scattered through services or IPC handlers. Keeps the data layer in one place, consistent with the existing `busRepo.ts`, `routeRepo.ts`, etc.

Anything that can strand a user mid-task — an update, a destructive action — must be confirmed or reversible. See `MandatoryUpdateModal.tsx` and `ConfirmDialog.tsx` for the existing patterns.

## Project layout

You need Node.js 20+ and npm.

```bash
git clone https://github.com/raiyanruhan/schoolbusmanagement.git
cd schoolbusmanagement
npm install
npm run dev
```

Native module note: `better-sqlite3` is compiled per Electron ABI. If it fails to load after an Electron version bump, run `npm run rebuild`.

### Main process

* `src/main/index.ts` — entry point: creates the main window and the kiosk Display Board window, registers the `audio-file://` protocol, starts the updater.
* `src/main/db/` — Drizzle schema (`schema.ts`), migrations, and seed data.
* `src/main/repositories/` — one file per entity, all SQL lives here.
* `src/main/services/` — business logic that composes repositories (`plannerService.ts`, `autoPlannerService.ts`, `updateService.ts`, …).
* `src/main/engine/` — the run-assignment engine: conflict detection, gender logic, capacity planning, time calculations. Pure logic, no I/O.
* `src/main/ipc/` — one `*.ipc.ts` file per domain, each registering its `ipcMain.handle` calls; wired together in `ipc/index.ts`.

### Renderer

* `src/renderer/pages/` — top-level routed screens.
* `src/renderer/components/` — grouped by domain (`audio/`, `planner/`, `settings/`, `layout/`, `ui/`).
* `src/renderer/store/` — Zustand stores. Keep one store per concern (`plannerStore`, `sessionStore`, `uiStore`, `updateStore`), not one giant global store.
* `src/renderer/hooks/`, `lib/`, `utils/` — shared renderer-only helpers.

### Shared types

`src/shared/types.ts` holds every type that crosses the preload boundary (domain entities, IPC input/output shapes, `UpdateStatus`, …). If the renderer and main process both need a shape, it belongs here, not duplicated.

## Adding a new feature end-to-end

Follow the shape of an existing domain (e.g. `bus`) when adding a new one:

1. **Schema** — add/extend a table in `src/main/db/schema.ts`.
2. **Repository** — `src/main/repositories/<name>Repo.ts` for the raw queries.
3. **Service** — `src/main/services/<name>Service.ts` if there's business logic beyond CRUD.
4. **IPC** — `src/main/ipc/<name>.ipc.ts`, registered in `ipc/index.ts`.
5. **Preload** — add the typed method under the matching namespace in `src/preload/index.ts`.
6. **Shared types** — add input/output types to `src/shared/types.ts`.
7. **Renderer** — call it from a store or component via `window.api.<namespace>.<method>()`.

## Commit conventions

This repo follows [Conventional Commits](https://www.conventionalcommits.org/): `feat(scope): …`, `fix(scope): …`, `refactor: …`, `docs: …`, `build: …`, `chore(release): …`. Check `git log` for examples before writing a new one.

## Before opening a pull request

* `npm run build` passes (type-checks main/preload/renderer and builds all three).
* You've run the actual app (`npm run dev`) and exercised the golden path for whatever you changed — type-checking isn't feature verification.
* New user-facing text is set in both places if the app is localized for a given screen (check for existing `*_bn` fields before adding English-only strings to a bilingual screen).

## How releases are built and published

Releases are cut by bumping the version and pushing the tag it creates:

```bash
npm version patch   # or minor / major
git push --follow-tags
```

`.github/workflows/release.yml` picks up the `v*.*.*` tag, builds the installer, and publishes it to GitHub Releases, where electron-updater's auto-update pipeline picks it up automatically. See [Auto-Update](README.md#auto-update) for how optional vs. mandatory releases work.

## Reporting bugs and requesting features

Open an issue on [this repository](https://github.com/raiyanruhan/schoolbusmanagement/issues).

## Reporting security vulnerabilities

Do not open a public issue for a security vulnerability — see [SECURITY.md](SECURITY.md) for how to report one responsibly.
