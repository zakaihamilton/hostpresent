# Production release checklist

Use this checklist for every HostPresent promotion. The application is stateless,
so Vercel Firewall rate rules are the enforcement point for public room and media
endpoints.

## Before promotion

- Configure the rules in [Vercel security setup](vercel-security.md) for both
  the Preview and Production environments.
- Confirm `ROOM_TOKEN_SECRET`, `INTERNAL_AUTH_SECRET`, `TURN_SECRET_KEY`, and
  the signaling/TURN variables are set in the environment being promoted.
- Run `npm run lint`, `npm run test:unit -- --runInBand`, `npm run build`, and
  `npm run test:e2e:smoke` from the release commit.

## Verify Preview firewall enforcement

Set `APP_URL` to the deployed Preview origin, then send one more request than
each configured limit. The final response for each command must be `429`.
These requests intentionally use invalid credentials, so they do not join or
change a real meeting.

```bash
for _ in $(seq 1 11); do curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Content-Type: application/json' "$APP_URL/api/rooms"; done
for _ in $(seq 1 21); do curl -s -o /dev/null -w '%{http_code}\n' "$APP_URL/api/rooms/resolve?code=ABCDEFGH"; done
for _ in $(seq 1 121); do curl -s -o /dev/null -w '%{http_code}\n' "$APP_URL/api/rooms/state?token=invalid"; done
for _ in $(seq 1 121); do curl -s -o /dev/null -w '%{http_code}\n' "$APP_URL/api/media/ice-config?roomToken=invalid"; done
```

If a command does not return `429`, correct the matching Vercel Firewall rule
before promotion. Wait for each rule window to reset before repeating a command.

## After production promotion

- Repeat the same four checks against the Production origin from an approved
  test IP.
- Confirm the browser document returns the Content-Security-Policy,
  anti-framing, referrer, and permissions headers validated by the smoke test.
- Record the deployment URL, verification time, and the person who completed
  the checks in the release record.
