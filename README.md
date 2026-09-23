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
        ├── Issues signed, short-lived access tokens
        └── Provides room APIs and TURN configuration
```

- The browser connects participants over WebRTC directly when possible; TURN can relay media for networks that need it.
- PeerJS is used for signaling through the separately hosted authenticated server in `signaling-server/`. It validates signed room-scoped tickets and only allows host tokens to claim host peer IDs.
- The signaling process uses short-lived in-memory leases to enforce the participant limit during PeerJS connections.
- The Next.js API is stateless: it signs room credentials and provides connection configuration, but does not store live room state.
- Live controls and chat travel over authenticated WebRTC data channels.
- Routing uses URL hashes such as `#/welcome`, `#/meeting/...`, and `#/j/...`, so the app can run on hosting that does not provide server-side route rewrites.

## Getting started

### Requirements

- Node.js **20.9 or newer**
- npm
- The Host Present authenticated PeerJS signaling server, reachable from the browser
- A modern browser with camera, microphone, and screen-sharing support

### Run locally

```bash
git clone https://github.com/zakaihamilton/hostpresent.git
cd hostpresent
npm install
```

Create `.env.local` with a local room secret and the connection details for your signaling server:

```dotenv
ROOM_TOKEN_SECRET=replace-with-a-long-random-secret
SIGNALING_SERVER_URL=localhost
SIGNALING_SERVER_PATH=/
SIGNALING_SERVER_PORT=9000
SIGNALING_SERVER_KEY=peerjs
SIGNALING_AUTH_MODE=room-token-v1
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Start the PeerJS signaling server in one terminal and the Next.js app in another:

```bash
npm run signaling
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The welcome screen can load without signaling configuration, but a real meeting requires the authenticated signaling server, valid media connectivity, and the same `ROOM_TOKEN_SECRET` in both the Next.js app and signaling server.

### Environment variables

Set these variables in `.env.local` for development or in the deployment environment for production:

| Variable | Purpose |
| --- | --- |
| `ROOM_TOKEN_SECRET` | Required high-entropy HMAC secret for room tokens and room-ID derivation. Rotating it invalidates existing room links and saved rooms. |
| `SIGNALING_SERVER_URL` | PeerJS hostname only—do not include `https://`. Required for WebRTC. |
| `SIGNALING_SERVER_PATH` | PeerJS path prefix; defaults to `/`. |
| `SIGNALING_SERVER_PORT` | PeerJS port; defaults to `9000` for localhost and `443` for other hosts. |
| `SIGNALING_SERVER_KEY` | PeerJS API key shared by the app and authenticated signaling server; defaults to `peerjs`. |
| `SIGNALING_AUTH_MODE` | Set to `room-token-v1` to enable the role-checked signaling protocol. The signaling server validates room-scoped tickets before registering peer IDs. |
| `SIGNALING_SECURE` | Optional `true`/`false` override for the PeerJS connection transport. It defaults to insecure for localhost and secure for other hosts. |
| `NEXT_PUBLIC_APP_URL` | Public app origin used to build participant invite links, for example `https://hostpresent.com`. |
| `INTERNAL_AUTH_SECRET` | HMAC secret for short-lived ICE configuration room tokens. Required when using the ICE configuration API. |
| `TURN_SECRET_KEY` | Shared secret used to mint ephemeral CoTURN credentials. |
| `TURN_DOMAIN` | TURN/TURNS hostname; defaults to `hostpresent.duckdns.org`. |

There is no fallback room-token secret. If `ROOM_TOKEN_SECRET` is missing, room creation and code resolution fail closed. Never expose it through a `NEXT_PUBLIC_` variable.

## Production deployment

Room and media state are not persisted on the server. A signaling restart does not end an active peer-to-peer meeting, but connection waiting states, participant removals, and token renewal are not persisted.

The app document is rendered per request so its Content Security Policy can use a fresh script nonce. PeerJS keeps its live registry and participant-capacity leases in process memory, so keep the Railway signaling service at one replica. Railway deploys one replica by default; [multiple replicas are not supported by PeerJS's process-local registry, and Railway does not provide sticky sessions](https://docs.railway.com/deployments/optimize-performance).

For a Vercel deployment, run the authenticated signaling server as a separate WebSocket-capable service:

1. Configure all required environment variables for Preview and Production.
2. Deploy `npm run signaling` from this repository on a WebSocket-capable host. Set the same `ROOM_TOKEN_SECRET`, `SIGNALING_SERVER_PATH`, and `SIGNALING_SERVER_KEY` on the signaling service and app. Keep the Railway signaling service at one replica. The service listens on the platform's `PORT` or `SIGNALING_SERVER_PORT`; set the app's `SIGNALING_SERVER_PORT` to the browser-facing port exposed by the TLS/WebSocket proxy (usually `443`).
3. Set `SIGNALING_AUTH_MODE=room-token-v1` in the app and point `SIGNALING_SERVER_URL` at the authenticated server.
4. Configure the [Vercel Firewall rate rules](docs/vercel-security.md) before exposing room and media endpoints.
5. Complete the [production release checklist](docs/production-release-checklist.md), including verification that each rule returns `429` after its limit is exceeded.
6. Rotate `ROOM_TOKEN_SECRET` deliberately when invalidating legacy room links and locally saved room tokens, and update both services together.

Treat a room code as a bearer credential and share it only with the intended meeting audience. Codes have 10 characters. Older 8-character invites have expired; create a new room to issue a fresh code.

## Development commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run signaling` | Start the authenticated PeerJS signaling server. |
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
