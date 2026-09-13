<a id="readme-top"></a>

<!-- PROJECT SHIELDS -->
[![Release][release-shield]][release-url]
[![License: UNLICENSED][license-shield]][license-url]
[![Platform][platform-shield]][platform-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://hylith.com">
    <img src="assets/images/hylith.png" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">School Bus Manager</h3>

  <p align="center">
    Offline-first desktop app for planning, dispatching, and announcing daily school bus runs.
    <br />
    <br />
    <a href="https://github.com/raiyanruhan/schoolbusmanagement/releases/latest">Download Latest Release</a>
    &middot;
    <a href="https://github.com/raiyanruhan/schoolbusmanagement/issues/new?labels=bug">Report Bug</a>
    &middot;
    <a href="https://github.com/raiyanruhan/schoolbusmanagement/issues/new?labels=enhancement">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#building--releasing">Building &amp; Releasing</a></li>
    <li><a href="#auto-update">Auto-Update</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->
## About The Project

School Bus Manager runs a school's entire daily bus operation from one desktop app — no internet connection required.

A school operates a fleet of buses across multiple shifts (Morning, Mid, Day), each with its own timing and gender policy. Every day the operator opens the app, confirms the day's plan, handles any incidents (breakdowns, delays, blocked roads), locks the session, and goes home. The app then drives a public-facing Display Board and voice announcements that students see and hear at each stop.

Core ideas the whole system is built on:
* **Routes & Stops** are permanent geography — they don't belong to any one shift.
* **Shifts** define timing and gender policy only.
* **Runs** are the atomic unit — one bus, one direction, one set of stops, one trip.
* **Sessions** are one calendar day; history is preserved forever.

Built as a long-lived, offline-first tool — every day's schedule, incident, and audit record lives in a local SQLite database on the machine it runs on.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

* [![Electron][Electron.js]][Electron-url]
* [![React][React.js]][React-url]
* [![TypeScript][TypeScript.lang]][TypeScript-url]
* [![Vite][Vite.js]][Vite-url]
* [![TailwindCSS][Tailwind.css]][Tailwind-url]
* [![SQLite][SQLite.db]][SQLite-url]
* [![Drizzle][Drizzle.orm]][Drizzle-url]
* [![Zustand][Zustand.js]][Zustand-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->
## Getting Started

### Prerequisites

* Windows 10/11, x64
* Node.js 20+ and npm
  ```sh
  npm install npm@latest -g
  ```

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/raiyanruhan/schoolbusmanagement.git
   ```
2. Install dependencies
   ```sh
   npm install
   ```
3. Run in development
   ```sh
   npm run dev
   ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE EXAMPLES -->
## Usage

| Script | What it does |
|---|---|
| `npm run dev` | Launches the app in development with hot reload |
| `npm run build` | Type-checks and builds main/preload/renderer |
| `npm run dist` | Packages a Windows installer (NSIS) into `release/` |
| `npm run rebuild` | Rebuilds the native `better-sqlite3` module for Electron's ABI |

## Building & Releasing

```sh
npm run dist
```

Produces `School Bus Manager-Setup-<version>.exe` in `release/` — a one-click NSIS installer, no separate runtime install required. To publish a GitHub Release electron-updater's clients can discover:

```sh
npm run dist -- --publish always
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Auto-Update

Installed apps check GitHub Releases in the background and prompt users when an update is ready — no manual re-download.

* **Optional update** — a small dismissible banner offers "Restart Now" or "Later." The app stays fully usable while it downloads.
* **Mandatory update** — a blocking screen appears once the update has finished downloading, requiring a restart to continue.

To mark a release mandatory for everyone below a given version, edit [`update-manifest.json`](update-manifest.json) on `main`:

```json
{
  "minVersion": "1.3.0",
  "mandatory": true,
  "notes": "Critical fix — please update."
}
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ROADMAP -->
## Roadmap

- [x] Fleet, route, stop, and shift management
- [x] Daily planner with automatic run assignment engine
- [x] Incident tracking & conflict detection
- [x] Display Board + voice announcements
- [x] Auto-update pipeline (optional & mandatory)
- [ ] Multi-school / multi-branch support

See the [open issues](https://github.com/raiyanruhan/schoolbusmanagement/issues) for the full list.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LICENSE -->
## License

Proprietary — all rights reserved by Hylith. Not licensed for redistribution.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->
## Contact

Built by [Hylith](https://hylith.com)

<p>
  <a href="https://github.com/raiyanruhan">
    <img src="https://github.com/raiyanruhan.png" width="80" height="80" style="border-radius:50%" alt="Raiyan Bin Rashid" />
    <br />Raiyan Bin Rashid
  </a>
  &nbsp;&nbsp;&nbsp;
  <a href="https://github.com/jotirmoy69">
    <img src="https://github.com/jotirmoy69.png" width="80" height="80" style="border-radius:50%" alt="Jotirmoy Bhowmik" />
    <br />Jotirmoy Bhowmik
  </a>
</p>

Project Link: [https://github.com/raiyanruhan/schoolbusmanagement](https://github.com/raiyanruhan/schoolbusmanagement)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
[release-shield]: https://img.shields.io/github/v/release/raiyanruhan/schoolbusmanagement?style=for-the-badge
[release-url]: https://github.com/raiyanruhan/schoolbusmanagement/releases
[license-shield]: https://img.shields.io/badge/license-proprietary-lightgrey.svg?style=for-the-badge
[license-url]: #license
[platform-shield]: https://img.shields.io/badge/platform-windows-0078D6.svg?style=for-the-badge&logo=windows
[platform-url]: #getting-started
[Electron.js]: https://img.shields.io/badge/Electron-191970?style=for-the-badge&logo=electron&logoColor=white
[Electron-url]: https://www.electronjs.org/
[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/
[TypeScript.lang]: https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white
[TypeScript-url]: https://www.typescriptlang.org/
[Vite.js]: https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white
[Vite-url]: https://vitejs.dev/
[Tailwind.css]: https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white
[Tailwind-url]: https://tailwindcss.com/
[SQLite.db]: https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white
[SQLite-url]: https://www.sqlite.org/
[Drizzle.orm]: https://img.shields.io/badge/Drizzle_ORM-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black
[Drizzle-url]: https://orm.drizzle.team/
[Zustand.js]: https://img.shields.io/badge/Zustand-433E38?style=for-the-badge
[Zustand-url]: https://github.com/pmndrs/zustand
