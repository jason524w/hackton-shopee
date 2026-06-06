import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

async function readMockResult(): Promise<NextResponse> {
  const raw = await readFile(join(process.cwd(), "contract", "mock-result.json"), "utf8");

  return new NextResponse(raw, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

// GET /api/run?mock=1
// Demo convenience route so the browser can show the full mock contract.
export async function GET(): Promise<NextResponse> {
  return readMockResult();
}

// POST /api/run
//   ?mock=1         -> return contract/mock-result.json.
//   DEMO_MOCK_ONLY  -> force mock regardless of query.
//   live pipeline   -> not wired in the skeleton; returns 501 until the runtime lands.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const mock = req.nextUrl.searchParams.get("mock") === "1";
  const demoMockOnly = process.env.DEMO_MOCK_ONLY === "true";

  if (mock || demoMockOnly) {
    return readMockResult();
  }

  return NextResponse.json(
    {
      status: "not_implemented",
      message: "Live pipeline is not wired yet in the skeleton. Use POST /api/run?mock=1.",
    },
    { status: 501 },
  );
}
