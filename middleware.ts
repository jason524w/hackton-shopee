import { NextResponse, type NextRequest } from "next/server";

// CORS for the /api/* surface so the (optionally cross-origin) frontend can POST JSON.
// A JSON POST always triggers a browser preflight (OPTIONS), which the App Router route
// handlers don't answer on their own — without this, split-port / cross-origin deploys
// (DEPLOY.md §2, docker-compose) get blocked by the browser before the request lands.
//
// Permissive-but-scoped: origin comes from ALLOWED_ORIGIN (default "*" for the demo).
// Set ALLOWED_ORIGIN to your frontend origin in any real deployment.

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "*";

function applyCorsHeaders(headers: Headers): void {
  headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Max-Age", "86400");
  // When echoing a specific origin (not "*"), Vary so caches don't cross-pollinate.
  if (ALLOWED_ORIGIN !== "*") {
    headers.set("Vary", "Origin");
  }
}

export function middleware(req: NextRequest): NextResponse {
  // Preflight: answer immediately with the CORS headers, no body.
  if (req.method === "OPTIONS") {
    const res = new NextResponse(null, { status: 204 });
    applyCorsHeaders(res.headers);
    return res;
  }

  const res = NextResponse.next();
  applyCorsHeaders(res.headers);
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
