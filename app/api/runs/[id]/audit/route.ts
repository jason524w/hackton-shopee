import { NextResponse } from "next/server";

export const runtime = "nodejs";

// GET /api/runs/:id/audit
// Stub for the skeleton. Real audit retrieval lands with the runtime audit sink (ROADMAP §9).
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  return NextResponse.json({ status: "not_implemented", audit_run_id: params.id });
}
