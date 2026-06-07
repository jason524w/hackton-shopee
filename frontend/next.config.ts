import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Self-contained server bundle for Docker.
  output: "standalone",
  // The app imports types/fixtures from ../contract — trace from the repo root
  // so the standalone bundle includes them.
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;
