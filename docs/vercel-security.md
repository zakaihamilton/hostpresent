# Vercel security setup

HostPresent is stateless. Configure these Vercel Firewall rate rules before promoting a deployment to production:

| Route | Match | Limit | Window |
| --- | --- | --- | --- |
| Create room | `POST /api/rooms` | 10 requests per IP | 10 minutes |
| Resolve code | `POST /api/rooms/resolve` | 20 requests per IP | 1 minute |
| Token state | `GET /api/rooms/state` | 120 requests per IP | 1 minute |
| TURN config | `GET /api/media/ice-config` | 120 requests per IP | 1 minute |
| Diagnostics | `POST /api/diagnostics` | 20 requests per IP | 1 minute |

Apply the rules to Preview and Production. Verify that a request above each limit receives `429` with Vercel's standard rate-limit response. This five-rule policy requires a Vercel plan that allows at least five rate-limit rules. Vercel currently lists one rate-limit rule per Hobby project and 40 per Pro project. Counters are per region, so these limits are regional rather than strict global per-IP ceilings. [Vercel rate-limit limits and behavior](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting).

Every release must also complete the [production release checklist](production-release-checklist.md). The application intentionally does not provide an in-memory fallback limiter: that would be inconsistent across Vercel function instances and would create a false sense of protection.

The room state endpoint accepts its bearer token in the `Authorization` header, TURN config accepts its short-lived token in the `x-room-token` header, and room code resolution accepts the code in a JSON `POST` body. Keep these credentials out of query strings and access logs.

Rate-limit rules are configured in Vercel Firewall for each project and environment. When deploying the resolver change, update any existing rule from `GET /api/rooms/resolve` to `POST /api/rooms/resolve`, then run the firewall verification script against Preview and Production. Vercel documents rate limiting as a Firewall rule action, while `vercel.json` custom rule configuration supports only challenge and deny actions. [Custom WAF rules](https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules), [rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting).

Required environment variables:

- `ROOM_TOKEN_SECRET`: a unique, randomly generated secret with at least 32 bytes of entropy. It must not use a `NEXT_PUBLIC_` prefix.
- `SIGNALING_SERVER_URL`, `SIGNALING_SERVER_PATH`, and `SIGNALING_SERVER_PORT`: PeerJS connectivity.
- `INTERNAL_AUTH_SECRET`, `TURN_SECRET_KEY`, and `TURN_DOMAIN`: scoped TURN credentials.

To rotate room credentials, deploy a new `ROOM_TOKEN_SECRET`. This invalidates every existing host token, participant token, invite link, and locally saved room token; users must create or join rooms again.
