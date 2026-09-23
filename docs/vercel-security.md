# Vercel security setup

Room and media state are not stored on the application server. Configure these Vercel Firewall rate rules before promoting a deployment to production:

| Route | Match | Limit | Window |
| --- | --- | --- | --- |
| Create room | `POST /api/rooms` | 10 requests per IP | 10 minutes |
| Resolve code | `POST /api/rooms/resolve` | 20 requests per IP | 1 minute |
| Token state | `GET /api/rooms/state` | 120 requests per IP | 1 minute |
| TURN config | `GET /api/media/ice-config` | 120 requests per IP | 1 minute |
| Diagnostics | `POST /api/diagnostics` | 20 requests per IP | 1 minute |

Apply the rules to Preview and Production. Verify that a request above each limit receives `429` with Vercel's standard rate-limit response. This five-rule policy requires a Vercel plan that allows at least five rate-limit rules. Vercel currently lists one rate-limit rule per Hobby project and 40 per Pro project. Counters are per region, so these limits are regional rather than strict global per-IP ceilings. [Vercel rate-limit limits and behavior](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting).

Every release must also complete the [production release checklist](production-release-checklist.md). The application intentionally does not provide an in-memory fallback limiter: that would be inconsistent across Vercel function instances and would create a false sense of protection.

The room state endpoint accepts its bearer token in the `Authorization` header, TURN config accepts its short-lived token in the `x-room-token` header, and room code resolution accepts the code in a JSON `POST` body. Keep those credentials out of query strings and access logs. PeerJS requires a room-scoped signaling ticket in its WebSocket `token` query parameter; configure the signaling host and any reverse proxy to redact that parameter from access logs.

Rate-limit rules are configured in Vercel Firewall for each project and environment. When deploying the resolver change, update any existing rule from `GET /api/rooms/resolve` to `POST /api/rooms/resolve`, then run the firewall verification script against Preview and Production. Vercel documents rate limiting as a Firewall rule action, while `vercel.json` custom rule configuration supports only challenge and deny actions. [Custom WAF rules](https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules), [rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting).

Required environment variables:

- `ROOM_TOKEN_SECRET`: a unique, randomly generated secret with at least 32 bytes of entropy. It must not use a `NEXT_PUBLIC_` prefix.
- `SIGNALING_SERVER_URL`, `SIGNALING_SERVER_PATH`, `SIGNALING_SERVER_PORT`, and `SIGNALING_SERVER_KEY`: Host Present authenticated PeerJS connectivity. The app and signaling service must share the path and key. Set the app's port to the browser-facing TLS/WebSocket proxy port; the service listens on its platform `PORT` or `SIGNALING_SERVER_PORT`.
- `SIGNALING_AUTH_MODE=room-token-v1`: enables the authenticated signaling protocol in the app.
- `INTERNAL_AUTH_SECRET`, `TURN_SECRET_KEY`, and `TURN_DOMAIN`: scoped TURN credentials.

Run `npm run signaling` as a separate WebSocket-capable service. It must use the same `ROOM_TOKEN_SECRET`, signaling path, and key as the app. Keep the Railway service at one replica: PeerJS's live peer registry and participant-capacity leases are process-local, and [Railway does not provide sticky sessions across replicas](https://docs.railway.com/deployments/optimize-performance). Expose the service through a TLS-enabled WebSocket proxy, and do not place it behind a proxy that logs WebSocket request query strings without redacting `token`.

To rotate room credentials, deploy a new `ROOM_TOKEN_SECRET`. This invalidates every existing host token, participant token, invite link, and locally saved room token; users must create or join rooms again.
