import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb, isDbConfigured } from "@/db";
import { collectTrendPipelineVHe } from "@/lib/pipeline-v-he/pipeline";
import { vheCollectionRuns, vheKeywords, vheTrendSnapshots } from "@/lib/pipeline-v-he/schema";

// launchd 같은 스케줄러가 매시간 이 엔드포인트를 호출해 수집을 실행한다.
// CRON_SECRET이 설정돼 있으면 그 값과 일치하는 Authorization 헤더가 있어야 실행된다.
function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DATABASE_URL is not configured" }, { status: 400 });
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

// 페이지(프론트)가 이 GET을 호출해 최신 수집 결과를 백엔드에서 가져온다.
export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ configured: false, runs: [], latestRunId: null, keywords: [] });
  }

  const db = getDb();

  const runs = await db
    .select({
      id: vheCollectionRuns.id,
      geo: vheCollectionRuns.geo,
      startedAt: vheCollectionRuns.startedAt,
      finishedAt: vheCollectionRuns.finishedAt,
      rawSignalCount: vheCollectionRuns.rawSignalCount,
      keywordCount: vheCollectionRuns.keywordCount,
      apiCallLog: vheCollectionRuns.apiCallLog,
    })
    .from(vheCollectionRuns)
    .orderBy(desc(vheCollectionRuns.startedAt))
    .limit(8);

  const keywords = await db
    .select({
      term: vheKeywords.term,
      category: vheKeywords.category,
      score: vheTrendSnapshots.score,
      mentions: vheTrendSnapshots.growthRate,
      source: vheTrendSnapshots.sourceLabel,
      rank: vheTrendSnapshots.rank,
      runId: vheTrendSnapshots.runId,
      capturedAt: vheTrendSnapshots.capturedAt,
      summary: vheTrendSnapshots.summary,
    })
    .from(vheTrendSnapshots)
    .innerJoin(vheKeywords, eq(vheTrendSnapshots.keywordId, vheKeywords.id))
    .orderBy(desc(vheTrendSnapshots.capturedAt), desc(vheTrendSnapshots.score))
    .limit(60);

  return NextResponse.json({
    configured: true,
    runs,
    latestRunId: runs[0]?.id ?? null,
    keywords,
  });
}
