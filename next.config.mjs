import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const mediabunnyBrowserEntry = fileURLToPath(
  new URL("./node_modules/mediabunny/dist/modules/src/index.js", import.meta.url),
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: projectRoot,
  reactCompiler: true,
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
