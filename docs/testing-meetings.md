# Meeting Testing

HostPresent meeting behavior should be tested at three levels: Jest for local
media logic, Playwright for real browser flows, and manual QA for OS/browser
device picker behavior that fake media cannot prove.

## Automated Unit And Component Tests

Run the fast suite with:

```bash
npm test
```

The media hook tests cover camera switching, microphone switching, screen-share
start/stop, browser-ended screen capture, and outbound media sync. The
participants sidebar tests cover roster rendering and media status changes.

## WebRTC E2E

Install browser dependencies once:

```bash
npx playwright install chromium
```

Start or configure a PeerJS signaling server that matches the app environment.
For local runs, the app expects these values unless overridden:

```bash
SIGNALING_SERVER_URL=localhost
SIGNALING_SERVER_PORT=9000
SIGNALING_SERVER_PATH=/myapp
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Then run:

```bash
RUN_WEBRTC_E2E=1 npm run test:e2e:webrtc
```

The E2E spec launches separate browser contexts for the host and two
participants with fake camera/microphone permissions. It creates a host room,
joins two participants by code, checks roster propagation, sends a chat message,
toggles participant camera state, and verifies participant leave state.

## Manual QA Matrix

Use real browsers and devices for these checks:

| Area | Scenario | Expected result |
| --- | --- | --- |
| Camera | Switch between two real cameras if available | Old camera stops, new camera appears locally and remotely |
| Microphone | Switch microphones while muted and unmuted | Selected mic changes without losing mute state |
| Screen share | Share without audio | Screen is sent and the app warns if requested audio is missing |
| Screen share | Share tab/system audio | Screen audio is audible to peers without local echo |
| Screen share | Stop from app button | Camera feed returns and peers see share stop |
| Screen share | Stop from browser sharing control | App clears sharing state and peers see share stop |
| Participants | Join 3-5 participants | Host roster count, names, mute state, and video state remain stable |
| Participants | Listening-only participant switches to Available | Roster mode updates and media publishing starts |
| Host controls | Mute one participant, then mute all | Only the targeted participant changes first; all change after bulk action |
| Recovery | Deny camera/mic or screen permissions | App shows the relevant error and remains usable |
| Recovery | Participant joins before host is present | Participant sees waiting/retry state and connects once host joins |
| Recovery | Leave and rejoin | Roster removes the old entry and shows the returning participant |
