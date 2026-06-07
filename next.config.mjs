/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server bundle for Docker (node .next/standalone/server.js).
  output: "standalone",
};

export default nextConfig;
