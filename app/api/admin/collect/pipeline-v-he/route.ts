import { NextResponse } from "next/server";

import { isDbConfigured } from "@/db";
import { collectTrendPipelineVHe } from "@/lib/pipeline-v-he/pipeline";

export async function POST(request: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DATABASE_URL is not configured" }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  try {
    return NextResponse.json({ ok: true, ...(await collectTrendPipelineVHe({ geo: body.geo ?? "KR", limit: body.limit ?? 15 })) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Trend pipeline vhe failed", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
