import path from "node:path";
import type { NextConfig } from "next";

// Live product images are served by the API app from /generated/*. In the
// recommended same-origin nginx deploy (DEPLOY.md §3) those are relative paths and
// need no allow-listing. Only when NEXT_PUBLIC_API_BASE_URL points at a different
// origin (split-port / cross-origin) do we hand next/image an absolute URL, which
// must be allow-listed here. We derive the pattern from the build-time base URL.
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [];
if (apiBaseUrl) {
  try {
    const { protocol, hostname, port } = new URL(apiBaseUrl);
    remotePatterns.push({
      protocol: protocol.replace(":", "") as "http" | "https",
      hostname,
      port: port || undefined,
      pathname: "/generated/**",
    });
  } catch {
    // Invalid URL → leave remotePatterns empty (same-origin assumed).
  }
}

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Self-contained server bundle for Docker.
  output: "standalone",
  // The app imports types/fixtures from ../contract — trace from the repo root
  // so the standalone bundle includes them.
  outputFileTracingRoot: path.join(__dirname, ".."),
  images: {
    remotePatterns,
  },
};

export default nextConfig;
