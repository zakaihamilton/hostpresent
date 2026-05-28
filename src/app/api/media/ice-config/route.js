import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET() {
    // Pull keys securely from Vercel's Environment Variables at runtime
    const turnSecret = process.env.TURN_SECRET_KEY;
    const domain = process.env.TURN_DOMAIN || 'hostpresent.duckdns.org';

    // Fallback check to prevent silent failures if environment variables are missing
    if (!turnSecret) {
        console.error("CRITICAL: TURN_SECRET_KEY is not defined in Vercel environment variables.");
        return NextResponse.json(
            { error: "Media server configuration mismatch." },
            { status: 500 }
        );
    }

    // 1. Generate an ephemeral username locked to a 24-hour expiration window
    // CoTurn expects the format: UNIX_TIMESTAMP:ANY_STRING
    const unixTimestamp = Math.floor(Date.now() / 1000) + 86400;
    const username = `${unixTimestamp}:anonymous_user`;

    // 2. Sign the username using your shared secret key via SHA-1 HMAC
    // CoTurn expects this signature to be returned as a Base64 encoded string
    const credential = crypto
        .createHmac('sha1', turnSecret)
        .update(username)
        .digest('base64');

    // 3. Return the exact structural ICE candidate list PeerJS / WebRTC needs
    return NextResponse.json({
        iceServers: [
            // Always include Google's free STUN server to try standard, direct P2P first
            { urls: 'stun:stun.l.google.com:19302' },

            // Fallback 1: Blazing fast UDP stream routing over Port 443
            {
                urls: `turn:${domain}:443?transport=udp`,
                username: username,
                credential: credential
            },

            // Fallback 2: Full TCP/TLS corporate firewall bypass over Port 443 (TURNS)
            {
                urls: `turns:${domain}:443?transport=tcp`,
                username: username,
                credential: credential
            }
        ]
    });
}