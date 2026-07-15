# Host Present

Browser-based meetings built around a single presenter. A **host** runs the session—camera, microphone, and screen share—while **participants** join with an 8-character room code or invite link. Media and live meeting controls flow peer-to-peer over WebRTC (PeerJS); the Next.js app issues stateless, signed credentials and serves the meeting UI.

## Features

- **Host and participant roles** — Create a room as host or join with a formatted room ID (`#/j/XXXX-XXXX`).
- **Primary presenter view** — Large stage for the host feed (camera or screen share) with optional participant gallery.
- **Screen sharing** — Share the screen with optional system/tab audio.
- **Recording** — Record the meeting locally in the browser; pause, resume, and download when finished.
- **Host controls** — Mute individual participants or everyone; manage who appears on video vs. audio-only during the live session.
- **Participant modes** — *Available* (can send media) or *Listening only* (observe without publishing).
- **Participants sidebar** — Roster with mute/video status and host actions.
- **Recent rooms** — Hosts can reopen rooms from local storage; participants can save rooms they have joined.
- **Themes** — Light/dark mode with system preference support.
- **PWA** — Installable web app with offline shell caching via a service worker.

## How it works

1. **Host** opens the app, sets a display name, and creates a room. They receive an 8-character join code and participant invite link.
2. **Participants** enter the room code or follow the invite link. The code is a durable bearer credential and is converted into a participant token that expires after seven days. Anyone with a saved code can request a new participant token; hosts create a new room after their host token expires.
3. **Signaling** uses a separate [PeerJS](https://peerjs.com/) server (`SIGNALING_SERVER_URL`) so browsers can discover each other and negotiate WebRTC.
4. **Room API** (`/api/rooms`) issues signed host/participant tokens and TURN configuration without retaining room state. Live control messages stay on authenticated WebRTC data channels.

Routing is hash-based (`#/welcome`, `#/meeting/...`, `#/j/...`) so the SPA can run on static hosting without server-side path rules.

## Requirements

- Node.js 18+ (for local development and builds)
- A running **PeerJS signaling server** reachable from browsers (required for real meetings)
- Optional: `NEXT_PUBLIC_APP_URL` for correct invite links when the app is served from a fixed origin

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without `SIGNALING_SERVER_URL`, the welcome screen shows a configuration notice and WebRTC will not connect.

### Environment variables

Create `.env.local` for local development (or set the same keys in your host’s environment):

| Variable | Description |
|----------|-------------|
| `ROOM_TOKEN_SECRET` | Required private, high-entropy HMAC secret for room tokens and room-ID derivation. Rotate it to invalidate all existing room links and saved rooms. |
| `SIGNALING_SERVER_URL` | PeerJS hostname only—no `https://` (e.g. `peer.example.com`). Required for WebRTC. |
| `SIGNALING_SERVER_PATH` | PeerJS path prefix (default: `/myapp`). |
| `SIGNALING_SERVER_PORT` | PeerJS port (default: `443`). |
| `NEXT_PUBLIC_APP_URL` | Public app origin for participant invite links (e.g. `https://present.example.com`). |
| `INTERNAL_AUTH_SECRET` | HMAC secret for short-lived ICE config room tokens (required for `/api/media/ice-config`). |
| `TURN_SECRET_KEY` | Shared secret for CoTurn ephemeral credentials. |
| `TURN_DOMAIN` | TURN/TURNS hostname (default: `hostpresent.duckdns.org`). |

There is no fallback room-token secret. Missing `ROOM_TOKEN_SECRET` causes room creation and code resolution to fail closed. Never expose it as a `NEXT_PUBLIC_` variable.

## Production deployment

HostPresent deliberately has no database, Redis instance, or server-persistent room state. A restart does not end an active peer-to-peer meeting, but it also cannot preserve server-side waiting rooms, participant removals, or host-token renewal. An eight-character join code remains a durable bearer credential, so do not share it beyond the intended meeting audience.

Before deploying on Vercel, configure the Firewall rate rules documented in [Vercel security setup](docs/vercel-security.md). These rules are required because the app has no in-process rate limiter. Rotate `ROOM_TOKEN_SECRET` during this rollout; that intentionally invalidates legacy room links and locally saved room tokens.

Use the [production release checklist](docs/production-release-checklist.md) for Preview and Production verification, including confirmation that each Firewall rule returns `429` once its limit is exceeded.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production server |
| `npm test` | Run Jest tests |
| `npm run lint` | Biome check |
| `npm run format` | Biome format (write) |

## Project layout

```
src/
  app/              Next.js app router, API routes, layout
  components/       UI (meeting, welcome, toolbar, video, etc.)
  hooks/            Room session, signaling, routing, host controls
  lib/              Room tokens, WebRTC helpers, settings, signaling messages
public/             Static assets, service worker
```

## Tech stack

- [Next.js](https://nextjs.org) 16 (App Router)
- [React](https://react.dev) 19
- [PeerJS](https://peerjs.com/) for WebRTC signaling and peer connections
- [Biome](https://biomejs.dev/) for lint/format
- [Jest](https://jestjs.io/) and Testing Library for unit tests

## License

Private project (`package.json` marks `"private": true`). Add a license file if you intend to open-source or redistribute.
