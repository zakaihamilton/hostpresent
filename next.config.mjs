/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  env: {
    NEXT_PUBLIC_SIGNALING_SERVER_PATH:
      process.env.NEXT_PUBLIC_SIGNALING_SERVER_PATH ?? "/myapp",
  },
};

export default nextConfig;
