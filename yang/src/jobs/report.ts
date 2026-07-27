/**
 * 특정 버킷의 raw_items를 소스별로 나란히 보여준다.
 * "동일 시간대에 각 소스에서 뭐가 나왔나"를 나중에 조회하는 용도.
 *
 * 실행: npm run report            # 가장 최근 버킷
 *      npm run report -- 3        # 최근 3개 버킷
 */
import { sql } from "drizzle-orm";
import { db, ensureSchema } from "../db/index.js";

const SOURCES = ["dcbest", "theqoo", "instiz", "youtube", "gtrends"] as const;

function main() {
  ensureSchema();
  const nBuckets = Number(process.argv[2] ?? 1) || 1;

  const buckets = db.all<{ bucket_at: string }>(
    sql`SELECT DISTINCT bucket_at FROM raw_items ORDER BY bucket_at DESC LIMIT ${nBuckets}`
  );
  if (buckets.length === 0) {
    console.log("raw_items가 비어있습니다. 먼저 `npm run sources` 실행하세요.");
    return;
  }

  for (const { bucket_at } of buckets) {
    const kst = new Date(bucket_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
    console.log("\n" + "═".repeat(72));
    console.log(`버킷 ${bucket_at}  (${kst} KST)`);
    console.log("═".repeat(72));

    for (const source of SOURCES) {
      const rows = db.all<{ unit: string; text: string }>(
        sql`SELECT unit, text FROM raw_items
            WHERE bucket_at = ${bucket_at} AND source = ${source}
            ORDER BY unit DESC, id ASC`
      );
      const titles = rows.filter((r) => r.unit === "title").length;
      const comments = rows.filter((r) => r.unit === "comment").length;
      const meta = comments ? `제목 ${titles}, 댓글 ${comments}` : `제목 ${titles}`;
      console.log(`\n── ${source} (${meta}) ${"─".repeat(Math.max(0, 40 - source.length))}`);
      if (rows.length === 0) {
        console.log("   (없음)");
        continue;
      }
      for (const r of rows.slice(0, 20)) {
        const tag = r.unit === "comment" ? "💬 " : " · ";
        console.log("  " + tag + r.text.slice(0, 80));
      }
      if (rows.length > 20) console.log(`   … 외 ${rows.length - 20}건`);
    }
  }
  console.log("");
}

main();
