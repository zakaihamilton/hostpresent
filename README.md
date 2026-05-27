# Host Present

Browser-based meetings built around a single presenter. A **host** runs the session—camera, microphone, and screen share—while **participants** join with a room ID or invite link. Media flows peer-to-peer over WebRTC (PeerJS); the Next.js app handles rooms, signed tokens, and meeting UI.

## Features

- **Host and participant roles** — Create a room as host or join with a formatted room ID (`#/j/XXXX-XXXX`).
- **Primary presenter view** — Large stage for the host feed (camera or screen share) with optional participant gallery.
- **Screen sharing** — Share the screen with optional system/tab audio.
- **Recording** — Record the meeting locally in the browser; pause, resume, and download when finished.
- **Host controls** — Mute individual participants or everyone; manage who appears on video vs. audio-only.
- **Participant modes** — *Available* (can send media) or *Listening only* (observe without publishing).
- **Participants sidebar** — Roster with mute/video status and host actions.
- **Recent rooms** — Hosts can reopen rooms from local storage; participants can save rooms they have joined.
- **Themes** — Light/dark mode with system preference support.
- **PWA** — Installable web app with offline shell caching via a service worker.

## How it works

1. **Host** opens the app, sets a display name, and creates or resumes a room. They receive a join code and participant invite link.
2. **Participants** enter the room ID or follow the invite link, then join the meeting once the host is present.
3. **Signaling** uses a separate [PeerJS](https://peerjs.com/) server (`SIGNALING_SERVER_URL`) so browsers can discover each other and negotiate WebRTC.
4. **Room API** (`/api/rooms`) creates rooms, issues signed host/participant tokens, and streams lightweight room state. Message payloads on the data channel are authenticated when room signing is enabled.

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
| `SIGNALING_SERVER_URL` | PeerJS hostname only—no `https://` (e.g. `peer.example.com`). Required for WebRTC and production-grade room token signing. |
| `SIGNALING_SERVER_PATH` | PeerJS path prefix (default: `/myapp`). |
| `SIGNALING_SERVER_PORT` | PeerJS port (default: `443`). |
| `NEXT_PUBLIC_APP_URL` | Public app origin for participant invite links (e.g. `https://present.example.com`). |

When `SIGNALING_SERVER_URL` is unset, room tokens use a development fallback secret. Set the signaling URL before deploying to production.

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
