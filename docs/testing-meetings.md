# Meeting Testing

HostPresent meeting behavior should be tested at three levels: Jest for local
media logic, Playwright for real browser flows, and manual QA for OS/browser
device picker behavior that fake media cannot prove.

## Automated Unit And Component Tests

Run the fast suite with:

~~~bash
npm test
~~~

The media hook tests cover camera switching, microphone switching, screen-share
start/stop, browser-ended screen capture, and outbound media sync. The
participants sidebar tests cover roster rendering and media status changes.

## WebRTC E2E

Install browser dependencies once:

~~~bash
npx playwright install chromium
~~~

Start Peerovo from its repository with a local .env. Configure the
hostpresent project with the same project key HostPresent will use and the
exact local app origin:

~~~dotenv
PORT=9000
PEEROVO_HOST=127.0.0.1
PEEROVO_PUBLIC_HOST=127.0.0.1
PEEROVO_PUBLIC_PORT=9000
PEEROVO_PUBLIC_SECURE=false
PEEROVO_SIGNING_SECRET=local-peerovo-signing-secret-with-32-bytes
PEEROVO_PROJECT_HOSTPRESENT_API_KEY=local-peerovo-project-key-with-32-bytes
PEEROVO_PROJECT_HOSTPRESENT_ALLOWED_ORIGINS='["http://127.0.0.1:3000"]'
PEEROVO_MAX_PEERS_PER_SESSION=30
TURN_DOMAIN=127.0.0.1
TURN_SECRET_KEY=local-turn-secret-with-at-least-32-bytes
~~~

Start Peerovo with npm run dev. In HostPresent's .env.local, use the same
project API key. Generate `ROOM_TOKEN_SECRET` with `openssl rand -base64 32`:

~~~dotenv
ROOM_TOKEN_SECRET=
PEEROVO_API_URL=http://127.0.0.1:9000
PEEROVO_PROJECT_ID=hostpresent
PEEROVO_PROJECT_API_KEY=the-same-local-project-key
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
~~~

Start HostPresent in a second terminal with npm run dev, then run:

~~~bash
RUN_WEBRTC_E2E=1 npm run test:e2e:webrtc
~~~

The E2E spec uses `@peerovo/test` to launch isolated browser clients for the host and two
participants with fake camera/microphone permissions. Each client has a separate
Playwright browser context, so browser storage and session state cannot leak between roles. It creates a host room,
joins two participants by code, checks roster propagation, sends a chat message,
requests speaking, waits for host approval, toggles participant camera state, and verifies participant leave state.

The CI WebRTC job is opt-in and uses a dedicated Peerovo test deployment. Set
the repository variables PEEROVO_E2E_API_URL and PEEROVO_E2E_PROJECT_ID plus
the secret PEEROVO_E2E_PROJECT_API_KEY. Configure that Peerovo project to
allow the exact CI app origin, [http://127.0.0.1:3000](http://127.0.0.1:3000).

## Manual QA Matrix

| Area | Scenario | Expected result |
| --- | --- | --- |
| Camera | Switch between two real cameras if available | Old camera stops, new camera appears locally and remotely |
| Microphone | Switch microphones while muted and unmuted | Selected mic changes without losing mute state |
| Screen share | Share without audio | Screen is sent and the app warns if requested audio is missing |
| Screen share | Share tab/system audio | Screen audio is audible to peers without local echo |
| Screen share | Stop from app button | Camera feed returns and peers see share stop |
| Screen share | Stop from browser sharing control | App clears sharing state and peers see share stop |
| Recording | Record while toggling screen share | Downloaded file follows screen share and returns to camera when sharing stops |
| Recording | Record while focused on a participant who shares screen | Recording switches to the participant's screen feed |
| Recording | Stop and save recording | Browser downloads a video (.mp4) and separate audio (.m4a) file |
| Participants | Join 3-5 participants | Host roster count, names, mute state, and video state remain stable |
| Publishing | Guest requests speaking, host approves, then revokes | No capture before approval; microphone, camera and screen tracks stop on revocation |
| Host controls | Mute one participant, then mute all | Only the targeted participant changes first; all change after bulk action |
| Recovery | Deny camera/mic or screen permissions | App shows the relevant error and remains usable |
| Recovery | Participant joins before host is present | Participant sees waiting/retry state and connects once host joins |
| Recovery | Leave and rejoin | Roster removes the old entry and shows the returning participant |
| Recovery | Host leaves and rejoins without full page refresh | Host may briefly show E007 while reclaiming PeerJS id, then connects; Diagnostics Reconnect also restarts the peer |
| Recovery | Guest camera/mic granted after PeerJS already connected | Outbound media sync/renegotiate runs so host sees guest video without mute toggle |
| Recovery | Guest joins while host PeerJS peer is still reconnecting | Host banner shows connection error; guest waits until host peer is live |
| Join before host | Guest resolves join code before host clicks Start meeting | Guest enters the meeting and sees the waiting/retry state until the host opens the room |
| Capacity | Sixth guest tries to join | Guest sees Meeting is full after receiving room_full; the five connected guests remain in the room |

## 20-person capacity validation

The application supports 19 attendees by default. The host always enforces three guest
publisher slots. Peerovo's default session capacity is 30; any override must
permit at least 20 peers and the project must have enough aggregate capacity.

Run the audience browser checks on a correctly configured test deployment:

~~~bash
RUN_WEBRTC_E2E=1 RUN_AUDIENCE_CAPACITY_E2E=1 npm run test:e2e:audience
~~~

The audience checks cover listeners without capture, speaker approval and
revocation, three-slot enforcement, host epoch/grant resets, parent departure,
separate-feed playback, 20-member admission, and rejection of the 21st person.
The existing meeting tests cover screen sharing, focus, chat, and recordings
validated with ffprobe. These local checks do not prove distributed capacity.

Run 20 browsers on separate machines or
independent constrained network endpoints for **45 minutes**. Use a dedicated
Peerovo project with its current `PEEROVO_PROJECT_HOSTPRESENT_API_KEY` and
`PEEROVO_PROJECT_HOSTPRESENT_ALLOWED_ORIGINS` JSON array settings. The API key
must match HostPresent's server-only `PEEROVO_PROJECT_API_KEY`; a 403 is an
authorization/configuration failure, not a room routing failure.

Record the deployment/commit, operating systems, browser versions, machines,
network limits, TURN candidate evidence, and all measurements. Include:

- Four feeds with the host and three approved guests; all 19 attendees receive
  every other publisher and hear no copy of their own publication.
- Focus changes throughout each tree, camera/screen replacements, tab audio,
  and a local recording that follows focus with intact video and audio files.
- Foreground/background changes, join/leave, parent closure, failed forwarding,
  grant revocation, and a host reconnection that resets the epoch and grants.
- Forced TURN (`iceTransportPolicy: "relay"`) and constrained publisher/relay
  upload using OS/router traffic shaping. HTTP throttling alone does not limit
  WebRTC UDP media. Record actual upload and the sender bitrate limits.
- Separate feeds during direct fallback. Verify aggregate host media sending
  stays at or below 12 Mbps; keep audio and the focused feed ahead of thumbnail
  video. Initial bitrate caps are operating limits, not device guarantees.
- Recovery within ten seconds, media latency, CPU on every machine, upload,
  frame rate/drops, jitter, and recording integrity. Preserve the measurements
  and ffprobe results as release artifacts.

Normal steady routing uses at most 76 media edges (four sources × 19 receivers),
with source fanout three, forwarding fanout two, and four hops. Replacement
calls may temporarily overlap old calls during repair. Direct-host fallback
keeps separate feeds and can concentrate upload/CPU work on the host.

Require passing lint, unit tests, a production build, smoke tests, Peerovo-backed
meeting tests, and this distributed test before raising the advertised limit.
Participant removal and bans are not implemented; revoking publishing removes
media rights while retaining room membership and chat.
