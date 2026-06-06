import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

// POST /api/run
//   ?mock=1         → return contract/mock-result.json (铁律 3 安全网,永不可移除)
//   DEMO_MOCK_ONLY  → force mock regardless of query (demo 兜底)
//   live pipeline   → not wired in the skeleton; returns 501 until the 7-agent runtime lands.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const mock = req.nextUrl.searchParams.get("mock") === "1";
  const demoMockOnly = process.env.DEMO_MOCK_ONLY === "true";

  if (mock || demoMockOnly) {
    const raw = await readFile(join(process.cwd(), "contract", "mock-result.json"), "utf8");
    return new NextResponse(raw, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  return NextResponse.json(
    {
      status: "not_implemented",
      message: "Live pipeline is not wired yet in the skeleton. Use POST /api/run?mock=1.",
    },
    { status: 501 },
  );
}
