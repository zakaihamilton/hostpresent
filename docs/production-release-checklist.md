# Production release checklist

Use this checklist for every Host Present promotion. The application is
stateless, so Vercel Firewall rate rules protect the public room endpoints and
Peerovo applies connectivity-service rate limits.

## Before promotion

- Configure the rules in [Vercel security setup](vercel-security.md) for both
  Preview and Production environments.
- Confirm `ROOM_TOKEN_SECRET`, `PEEROVO_API_URL`, `PEEROVO_PROJECT_ID`, and
  `PEEROVO_PROJECT_API_KEY` are set in the Host Present environment being
  promoted.
- Confirm the Host Present project in Peerovo allows the exact Preview and
  Production browser origins.
- Confirm the Peerovo service is healthy and ready, uses HTTPS/WSS externally,
  and runs a single replica while its peer registry and capacity leases are
  process-local.
- Confirm Peerovo's proxy redacts the PeerJS WebSocket `token` query parameter.
- Confirm coturn's REST secret is configured only in Peerovo and matches the
  coturn server.
- Run `npm run lint`, `npm run test:unit -- --runInBand`, `npm run build`,
  and `npm run test:e2e:smoke` from the release commit.

## Verify Preview firewall enforcement

Set `APP_URL` to the deployed Preview origin, then send one more request than
each configured limit. Each check must receive at least one `429` response.
These requests intentionally use invalid credentials, so they do not join or
change a real meeting.

```bash
APP_URL="$APP_URL" ./scripts/verify-vercel-firewall.sh
```

If the script fails, correct the matching Vercel Firewall rule before
promotion. Also verify Peerovo's ticket, ICE, and signaling limits against its
test deployment without using production credentials.

## After production promotion

- Repeat the same four checks against the Production origin from an approved
  test IP.
- Confirm the browser document returns the Content-Security-Policy,
  anti-framing, referrer, and permissions headers validated by the smoke test.
- Record the deployment URL, verification time, and the person who completed
  the checks in the release record.
