# Vercel security setup

Host Present keeps room authorization in its stateless app API. Peerovo handles
signaling upgrades, session capacity, ICE configuration, and coturn credential
issuance. Configure these Vercel Firewall rate rules before promoting a
deployment to production:

| Route | Match | Limit | Window |
| --- | --- | --- | --- |
| Create room | `POST /api/rooms` | 10 requests per IP | 10 minutes |
| Resolve code | `POST /api/rooms/resolve` | 20 requests per IP | 1 minute |
| Room state and Peerovo ticket | `GET /api/rooms/state` | 120 requests per IP | 1 minute |
| Diagnostics | `POST /api/diagnostics` | 20 requests per IP | 1 minute |

Apply the rules to Preview and Production. Verify that a request above each
limit receives `429` with Vercel's standard rate-limit response. The app
intentionally does not provide an in-memory fallback limiter. Vercel Firewall
is the enforcement point for public Host Present routes.

Room state accepts the Host Present bearer token only in the `Authorization`
header. Room code resolution accepts the code in a JSON `POST` body. Keep both
credentials out of query strings and access logs. PeerJS requires the Peerovo
peer ticket in its WebSocket `token` query parameter; Peerovo and its reverse
proxy must redact that parameter from access logs. Peerovo HTTP ticket and ICE
tokens use authorization headers and are never accepted from query parameters.

The Host Present project in Peerovo must list each exact browser origin that is
allowed to request ICE configuration, including every Preview origin that will
be used. Peerovo also applies its own project ticket, ICE, and signaling limits;
configure edge rate limits on the Peerovo service as described in its deployment
guide.

Required Host Present environment variables:

- `ROOM_TOKEN_SECRET`: a unique, randomly generated secret with at least 32
  bytes of entropy. It must not use a `NEXT_PUBLIC_` prefix.
- `PEEROVO_API_URL`: HTTPS base URL of the Peerovo service.
- `PEEROVO_PROJECT_ID`: the configured project ID, normally `hostpresent`.
- `PEEROVO_PROJECT_API_KEY`: a server-only project key with at least 32 bytes.
  Never expose it through a `NEXT_PUBLIC_` variable.

Keep Peerovo's signing secret, project API key, and `TURN_SECRET_KEY` in the
Peerovo deployment. Host Present does not mint TURN credentials and must not
receive the coturn secret.
