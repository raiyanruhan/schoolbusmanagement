# Security Policy

## Supported Versions

Only the latest released version of School Bus Manager is supported. The
app checks for updates automatically — see [Auto-Update](README.md#auto-update)
— so make sure you're on the
[latest release](https://github.com/raiyanruhan/schoolbusmanagement/releases/latest)
before reporting an issue.

## Reporting a Vulnerability

Please do not open a public issue for security vulnerabilities.

Instead, use GitHub's private vulnerability reporting for this repository:

1. Go to the [Security tab](https://github.com/raiyanruhan/schoolbusmanagement/security).
2. Click **Report a vulnerability**.

If that isn't available to you, contact the maintainers directly through
[hylith.com](https://hylith.com).

## Scope

Things worth reporting privately:

* A way to read or modify another session's data through the app's
  `audio-file://` protocol handler or IPC surface (`src/main/ipc/`)
* A way to make the auto-updater install anything other than a release
  published from this repository
* Any path that lets the renderer process (untrusted, `contextIsolation`
  and `nodeIntegration: false`) reach Node.js or the filesystem outside the
  IPC API defined in `src/preload/index.ts`

Things that are expected behavior, not vulnerabilities: the app storing all
data locally and offline in SQLite under the OS user-data directory — there
is no server component, so there's no remote account or data store to
compromise.
