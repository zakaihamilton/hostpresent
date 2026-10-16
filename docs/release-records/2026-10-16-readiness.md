# Readiness verification — 2026-10-16

Completed by Codex in the local workspace. The Preview and Production firewall
checks ran against the current Vercel project deployments; the Preview source
branch was `codex/migrate-to-pnpm`, not this uncommitted worktree.

## Firewall checks

Verified at `2026-10-16 12:23 UTC` with `scripts/verify-vercel-firewall.sh`.
Each entry is the number of `429` responses observed for that probe.

| Environment | URL | Create room | Resolve | Room state | Diagnostics |
| --- | --- | ---: | ---: | ---: | ---: |
| Preview | `https://hostpresent-104dcoxlg-zakai-hamiltons-projects.vercel.app` | 11 | 1 | 121 | 1 |
| Production | `https://hostpresent.com` | 1 | 21 | 1 | 21 |

The protected Preview was accessed with a temporary Vercel share link. The link
was not retained. The probes use invalid bodies or credentials and do not create
or join rooms.

## Local verification

- `pnpm run typecheck` — passed, including public script configurations.
- `pnpm run lint` — passed; Biome still reports existing `any` warnings.
- `pnpm run test:automated` — passed: 79 unit suites / 385 tests, production
  build, and 5 smoke tests.
- `pnpm run test:e2e:webrtc` — passed: 4 WebRTC, media, and recording tests
  against an isolated local Peerovo service.
- 20-member admission test — passed: host plus 19 attendees were admitted, and
  the 21st person was rejected. This used local browser contexts on one machine.

The test environment ran Node `24.15.0`; the package declares `>=24.22.0 <25`,
so pnpm emitted an engine warning despite the passing checks. The root
TypeScript configuration remains `strict: false`; enabling strict mode still
requires resolving existing diagnostics across the production sources.

## Distributed acceptance

The 45-minute distributed acceptance test was not run. It requires 20 browsers
on separate machines or independently constrained network endpoints. TURN
relay, constrained upload, ten-second recovery, latency/CPU/upload measurements,
and long-run recording integrity remain unverified. Do not claim validated
20-person capacity until that test passes.
