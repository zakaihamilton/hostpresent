import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const mediabunnyBrowserEntry = fileURLToPath(
  new URL(
    "./node_modules/mediabunny/dist/modules/src/index.js",
    import.meta.url,
  ),
);

const scriptSecurityPolicy = [
  "'self'",
  "'unsafe-inline'",
  "'wasm-unsafe-eval'",
  ...(process.env.NODE_ENV === "development" ? ["'unsafe-eval'"] : []),
].join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js and the early theme bootstrap both emit inline code. A nonce-based
  // policy would make this statically rendered app dynamic, so keep this
  // compatibility policy narrowly focused on trusted origins and capabilities.
  `script-src ${scriptSecurityPolicy}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  // PeerJS and TURN endpoints are deployment-configured, so permit secure
  // HTTPS/WebSocket origins without baking a particular signaling host in.
  "connect-src 'self' https: wss:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), display-capture=(self)",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: projectRoot,
  reactCompiler: true,
  async headers() {
    return [
      {
        source: "/recording/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  turbopack: {
    root: projectRoot,
    resolveAlias: {
      // Turbopack resolves aliases relative to the project root; absolute
      // aliases are interpreted as unsupported server-relative imports.
      mediabunny: "./node_modules/mediabunny/dist/modules/src/index.js",
    },
  },
  webpack: (config) => {
    config.resolve.alias.mediabunny = mediabunnyBrowserEntry;
    return config;
  },
};

export default nextConfig;
