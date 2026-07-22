import Link from "next/link";
import { desc, eq } from "drizzle-orm";

import { getDb, isDbConfigured } from "@/db";
import { vheCollectionRuns, vheKeywords, vheTrendSnapshots } from "@/lib/pipeline-v-he/schema";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function CollectionLogVHePage() {
  const rows = isDbConfigured()
    ? await getDb()
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
        .limit(60)
    : [];

  const runs = isDbConfigured()
    ? await getDb()
        .select({
          id: vheCollectionRuns.id,
          geo: vheCollectionRuns.geo,
          startedAt: vheCollectionRuns.startedAt,
          finishedAt: vheCollectionRuns.finishedAt,
          rawSignalCount: vheCollectionRuns.rawSignalCount,
          keywordCount: vheCollectionRuns.keywordCount,
        })
        .from(vheCollectionRuns)
        .orderBy(desc(vheCollectionRuns.startedAt))
        .limit(8)
    : [];

  const latestRunId = runs[0]?.id;
  const latestRows = latestRunId ? rows.filter((row) => row.runId === latestRunId) : rows;
  const maxScore = Math.max(1, ...latestRows.map((row) => row.score ?? 0));

  return (
    <main className={styles.page}>
      <Link href="/" className={styles.back}>← 홈으로</Link>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>Pipeline V-HE · Collection Log</p>
          <h1 className={styles.title}>bottom-up 파이프라인 수집 기록</h1>
          <p className={styles.subtitle}>
            YouTube 인기영상(제목·태그·댓글)에서 후보를 발굴하고 Google Trends로 교차확인하는
            v-he 파이프라인의 실행 이력과 최신 랭킹입니다.
          </p>
        </div>
        <span className={styles.countBadge}>총 {rows.length}건 수집</span>
      </div>

      {isDbConfigured() && runs.length > 0 && (
        <>
          <div className={styles.runStrip}>
            {runs.map((run) => (
              <div key={run.id} className={`${styles.runCard} ${run.id === latestRunId ? styles.active : ""}`}>
                <div className={styles.runCardTitle}>
                  <span className={`${styles.runDot} ${!run.finishedAt ? styles.pending : ""}`} />
                  RUN #{run.id} · {run.geo}
                </div>
                <div className={styles.runMeta}>
                  {run.startedAt.toLocaleString("ko-KR")}
                  <br />
                  원문 신호 {run.rawSignalCount ?? "-"}건 · 키워드 {run.keywordCount ?? "-"}건
                  {!run.finishedAt && " · 진행 중"}
                </div>
              </div>
            ))}
          </div>
          <p className={styles.runHint}>
            원문 신호 상세는 <code>npm run report:v-he</code>로 확인할 수 있습니다.
          </p>
        </>
      )}

      {!isDbConfigured() ? (
        <div className={styles.empty}>DATABASE_URL을 설정하면 수집 기록이 표시됩니다.</div>
      ) : rows.length === 0 ? (
        <div className={styles.empty}>
          아직 수집된 키워드가 없습니다. <code>POST /api/admin/collect/pipeline-v-he</code>로 수집을 시작해 주세요.
        </div>
      ) : (
        <div className={styles.grid}>
          {latestRows.map((row, index) => {
            const score = row.score ?? 0;
            const fillWidth = Math.max(6, Math.round((score / maxScore) * 100));
            return (
              <div key={`${row.term}-${row.capturedAt.toISOString()}-${index}`} className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={`${styles.rankBadge} ${row.rank && row.rank <= 3 ? styles.top : ""}`}>
                    {row.rank ?? "-"}
                  </span>
                  <div>
                    <div className={styles.term}>{row.term}</div>
                    <span className={styles.category}>{row.category}</span>
                  </div>
                </div>
                <div className={styles.scoreRow}>
                  <span className={styles.scoreValue}>{score}</span>
                  <span className={styles.scoreLabel}>점 · {row.mentions ?? "-"}</span>
                </div>
                <div className={styles.scoreBar}>
                  <div className={styles.scoreBarFill} style={{ width: `${fillWidth}%` }} />
                </div>
                <span className={styles.sourcePill}>{row.source ?? "-"}</span>
                <p className={styles.summary}>{row.summary ?? "요약 없음"}</p>
                <span className={styles.capturedAt}>{row.capturedAt.toLocaleString("ko-KR")}</span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
