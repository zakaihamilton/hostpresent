# Host Present

> Focused browser meetings for presenting live to a small audience.

[![Open the live app](https://img.shields.io/badge/live_app-hostpresent.com-2563eb?style=flat-square)](https://hostpresent.com)
[![CI](https://github.com/zakaihamilton/hostpresent/actions/workflows/ci.yml/badge.svg)](https://github.com/zakaihamilton/hostpresent/actions/workflows/ci.yml)

Open [Host Present](https://hostpresent.com), create a room, and invite participants with a short room code or a shareable link. The host stays at the center of the experience: presenting from a camera or screen share while keeping control of the room, participant media, and recording.

[![Host Present welcome screen](public/welcome-preview.png)](https://hostpresent.com)

## What it does

Host Present is a role-aware meeting room built around a single presenter. Participants can join quickly, while the host controls the stage and the flow of the session.

| Present clearly | Keep control | Stay connected |
| --- | --- | --- |
| Large presenter stage for camera or screen share | Mute one participant or everyone | WebRTC media and data channels |
| Optional participant gallery | Choose video or audio-only participants | Chat, private messages, and invite links |
| Screen and tab audio support | Available and listening-only modes | Diagnostics and reconnect tools |

## Features

- **Host and participant roles** — Create a room as a host or join with a 10-character code such as `ABCD-EFGH-JK`. Older 8-character invites have expired; hosts can create a new room to get a fresh code.
- **Presenter-first layout** — Keep the host feed prominent while showing an optional participant gallery.
- **Screen sharing** — Share a screen, window, or browser tab, with support for system or tab audio when the browser provides it.
- **Local recording** — Record in the browser, pause and resume, then save the meeting locally when finished.
- **Host controls** — Mute individual participants or the whole room and manage who publishes video.
- **Participant modes** — Let participants join as **Available** or **Listening only**.
- **Chat** — Send room messages or private messages and save the conversation locally.
- **Recent rooms** — Reopen rooms from local storage without a server-side meeting database.
- **Themes and PWA support** — Light/dark themes, system preference support, and an installable web app shell.
- **Diagnostics and recovery** — Inspect connection details, retry signaling, and send a lightweight diagnostic report when troubleshooting is needed.

## How it works

```text
Host and participants
        │
        ├── WebRTC media and authenticated data channels
        │
        └── PeerJS signaling for discovery and connection setup

Next.js application
        ├── Creates and resolves room credentials
        ├── Authenticates each room and chooses Host Present peer IDs
        └── Requests scoped Peerovo peer tickets

Peerovo
        ├── Authenticated PeerJS signaling
        ├── Project → Session → Peer tickets
        └── ICE servers and short-lived coturn credentials
```

- The browser connects participants over WebRTC directly when possible; TURN can relay media for networks that need it.
- Peerovo owns generic PeerJS signaling, session admission, ICE configuration, and short-lived coturn credentials.
- Host Present verifies its room token before asking Peerovo for a ticket. Host Present alone chooses the host and participant peer IDs.
- Peerovo tickets are bound to the `hostpresent` project, the room ID as session ID, and the exact peer ID.
- The Next.js API is stateless: it signs room credentials and requests connectivity tickets, but does not store live room state.
- Live controls and chat travel over authenticated WebRTC data channels.
- Routing uses URL hashes such as `#/welcome`, `#/meeting/...`, and `#/j/...`, so the app can run on hosting that does not provide server-side route rewrites.

## Getting started

### Requirements

- Node.js **20.9 or newer**
- npm
- A Peerovo service configured for Host Present, reachable from the app server and browser
- A modern browser with camera, microphone, and screen-sharing support

### Run locally

```bash
git clone https://github.com/zakaihamilton/hostpresent.git
cd hostpresent
npm install
```

Create `.env.local` with a room secret and the server-only Peerovo project credentials:

```dotenv
ROOM_TOKEN_SECRET=replace-with-a-long-random-secret
PEEROVO_API_URL=https://peerovo.example.com
PEEROVO_PROJECT_ID=hostpresent
PEEROVO_PROJECT_API_KEY=replace-with-a-32-character-project-key
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
```

For local WebRTC work, start the Peerovo service separately with its own local configuration. Add `http://127.0.0.1:3000` to the Host Present project's Peerovo `allowedOrigins`, and use the same project API key in both services. Then start Host Present:

```bash
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The welcome screen can load without Peerovo, but a real meeting requires a reachable Peerovo service and its project credentials. The room-signing secret remains private to Host Present.

### Environment variables

Set these variables in `.env.local` for development or in the deployment environment for production:

| Variable | Purpose |
| --- | --- |
| `ROOM_TOKEN_SECRET` | Required high-entropy HMAC secret for room tokens and room-ID derivation. Rotating it invalidates existing room links and saved rooms. |
| `PEEROVO_API_URL` | HTTPS base URL of the Peerovo API and signaling service. Local HTTP is accepted only for loopback addresses outside production. |
| `PEEROVO_PROJECT_ID` | Peerovo project ID assigned to Host Present, normally `hostpresent`. |
| `PEEROVO_PROJECT_API_KEY` | Server-only project key used to request Peerovo peer tickets. Never expose it through a `NEXT_PUBLIC_` variable. |
| `NEXT_PUBLIC_APP_URL` | Public app origin used to build participant invite links, for example `https://hostpresent.com`. |

There is no fallback room-token secret. If `ROOM_TOKEN_SECRET` is missing, room creation and code resolution fail closed. Never expose it through a `NEXT_PUBLIC_` variable.

## Production deployment

Room and media state are not persisted on the server. A Peerovo restart does not end an active peer-to-peer meeting, but connection waiting states, participant removals, and session admission leases are not persisted.

The app document is rendered per request so its Content Security Policy can use a fresh script nonce. Peerovo keeps its live PeerJS registry and capacity leases in process memory, so run the Peerovo service as one replica unless its shared-state design is changed.

For a Vercel deployment:

1. Deploy Peerovo as a WebSocket-capable service and configure its `hostpresent` project with the exact Preview and Production app origins.
2. Set `PEEROVO_API_URL`, `PEEROVO_PROJECT_ID`, and `PEEROVO_PROJECT_API_KEY` in Host Present's Preview and Production environments. Keep the project key server-only.
3. Keep Peerovo's signing secret, project keys, and coturn secret in the Peerovo service. Host Present does not need the coturn secret.
4. Configure the [Vercel Firewall rate rules](docs/vercel-security.md) before exposing room APIs.
5. Complete the [production release checklist](docs/production-release-checklist.md), including Peerovo health/readiness and rate-limit checks.
6. Rotate `ROOM_TOKEN_SECRET` deliberately when invalidating legacy room links and locally saved room tokens. This does not rotate Peerovo's independent signing keys.

Treat a room code as a bearer credential and share it only with the intended meeting audience. Codes have 10 characters. Older 8-character invites have expired; create a new room to issue a fresh code.

## Development commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Create a production build. |
| `npm run start` | Run the production server locally. |
| `npm run lint` | Run Biome checks. |
| `npm run format` | Format files with Biome. |
| `npm test` | Run the Jest unit and component suite. |
| `npm run test:e2e:smoke` | Run the Chromium welcome-flow smoke test. |
| `npm run test:e2e:webrtc` | Run the opt-in Chromium WebRTC flow with separate host and participant contexts. |

For the full meeting test matrix, including browser permissions and manual device checks, see [docs/testing-meetings.md](docs/testing-meetings.md).

## Project structure

```text
src/
  app/              Next.js App Router, metadata, and API routes
  components/       Welcome, meeting, media, chat, and shared UI
  hooks/            Room sessions, signaling, routing, and host controls
  lib/              Room security, WebRTC, settings, diagnostics, and utilities
public/              Icons, PWA assets, service worker, and recording runtime files
docs/                Deployment, security, release, and testing guides
tests/e2e/           Playwright smoke and WebRTC scenarios
```

## Tech stack

- [Next.js](https://nextjs.org/) 16 with the App Router
- [React](https://react.dev/) 19
- [WebRTC](https://webrtc.org/) for browser media and data channels
- [PeerJS](https://peerjs.com/) for signaling and peer discovery
- [Biome](https://biomejs.dev/) for linting and formatting
- [Jest](https://jestjs.io/) and [Testing Library](https://testing-library.com/) for unit and component tests
- [Playwright](https://playwright.dev/) for browser smoke and WebRTC tests

## License and project status

Host Present is open-source software in active development, with a hosted app available at [hostpresent.com](https://hostpresent.com). Host Present-authored code is licensed under the [MIT License](LICENSE).

`package.json` remains marked with `"private": true` to prevent accidental npm publication; this does not make the GitHub repository private. Third-party dependencies and bundled runtime assets, including the FFmpeg recording assets, retain their respective upstream licenses and are not relicensed by the Host Present MIT license.
