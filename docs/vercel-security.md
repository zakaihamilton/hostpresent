# Vercel security setup

HostPresent is stateless. Configure these Vercel Firewall rate rules before promoting a deployment to production:

| Route | Match | Limit | Window |
| --- | --- | --- | --- |
| Create room | `POST /api/rooms` | 10 requests per IP | 10 minutes |
| Resolve code | `GET /api/rooms/resolve` | 20 requests per IP | 1 minute |
| Token state | `GET /api/rooms/state` | 120 requests per IP | 1 minute |
| TURN config | `GET /api/media/ice-config` | 120 requests per IP | 1 minute |

Apply the rules to Preview and Production. Verify that a request above each limit receives `429` with Vercel's standard rate-limit response.

Every release must also complete the [production release checklist](production-release-checklist.md). The application intentionally does not provide an in-memory fallback limiter: that would be inconsistent across Vercel function instances and would create a false sense of protection.

Required environment variables:

- `ROOM_TOKEN_SECRET`: a unique, randomly generated secret with at least 32 bytes of entropy. It must not use a `NEXT_PUBLIC_` prefix.
- `SIGNALING_SERVER_URL`, `SIGNALING_SERVER_PATH`, and `SIGNALING_SERVER_PORT`: PeerJS connectivity.
- `INTERNAL_AUTH_SECRET`, `TURN_SECRET_KEY`, and `TURN_DOMAIN`: scoped TURN credentials.

To rotate room credentials, deploy a new `ROOM_TOKEN_SECRET`. This invalidates every existing host token, participant token, invite link, and locally saved room token; users must create or join rooms again.
