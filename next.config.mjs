import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const mediabunnyBrowserEntry = fileURLToPath(
  new URL(
    "./node_modules/mediabunny/dist/modules/src/index.js",
    import.meta.url,
  ),
);

const securityHeaders = [
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
            // These assets use stable, un-hashed URLs. Revalidate them so a
            // new worker/core pair is picked up after a deployment.
            value: "public, max-age=0, must-revalidate",
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
