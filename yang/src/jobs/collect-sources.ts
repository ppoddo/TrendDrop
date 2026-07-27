/**
 * 6개 소스(디시·더쿠·인스티즈·유튜브·Google Trends·네이트판) 원문을 1시간 버킷으로 raw_items에 축적.
 * 같은 버킷 재실행은 UNIQUE로 무시(중복 방지).
 *
 * 실행: npm run sources
 * 로그: logs/sources.log — 동일 버킷에서 소스별로 무슨 키워드/제목이 나왔는지 그룹 기록.
 */
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { db, ensureSchema } from "../db/index.js";
import { rawItems } from "../db/schema.js";
import { hourBucket } from "../util/time.js";
import type { RawItem, SourceAdapter } from "../sources/types.js";
import { dcbest } from "../sources/dcbest.js";
import { theqoo } from "../sources/theqoo.js";
import { instiz } from "../sources/instiz.js";
import { youtube } from "../sources/youtube.js";
import { gtrends } from "../sources/gtrends.js";
import { natepann } from "../sources/natepann.js";

const ADAPTERS: SourceAdapter[] = [dcbest, theqoo, instiz, youtube, gtrends, natepann];
const LOG_PATH = "./logs/sources.log";

function sha1(s: string): string {
  return createHash("sha1").update(s).digest("hex");
}

interface SourceResult {
  name: string;
  items: RawItem[];
  error?: string;
}

/** 어댑터 하나 실행 — 실패해도 나머지에 영향 없게 결과 객체로 감싼다. */
async function runAdapter(a: SourceAdapter): Promise<SourceResult> {
  try {
    const items = await a.collect();
    return { name: a.name, items };
  } catch (err) {
    return { name: a.name, items: [], error: (err as Error).message };
  }
}

/** raw_items에 저장. 반환: 새로 저장된 수(중복 제외). */
function save(items: RawItem[], bucket: string, collectedAt: string): number {
  if (items.length === 0) return 0;
  let saved = 0;
  db.transaction((tx) => {
    for (const it of items) {
      const res = tx
        .insert(rawItems)
        .values({
          source: it.source,
          unit: it.unit,
          text: it.text,
          textHash: sha1(it.text),
          meta: it.meta ? JSON.stringify(it.meta) : null,
          bucketAt: bucket,
          collectedAt,
        })
        .onConflictDoNothing()
        .run();
      saved += res.changes;
    }
  });
  return saved;
}

/** 동일 버킷에서 소스별로 무슨 항목이 나왔는지 로그 파일에 그룹 기록. */
function writeLog(results: SourceResult[], bucket: string, kstStamp: string): void {
  const lines: string[] = [];
  lines.push("=".repeat(78));
  lines.push(`버킷 ${bucket}  (수집 ${kstStamp} KST)`);
  lines.push("=".repeat(78));
  for (const r of results) {
    if (r.error) {
      lines.push(`\n[${r.name}] ⚠️ 실패: ${r.error}`);
      continue;
    }
    const titles = r.items.filter((i) => i.unit === "title");
    const comments = r.items.filter((i) => i.unit === "comment");
    const parts = [`제목 ${titles.length}`];
    if (comments.length) parts.push(`댓글 ${comments.length}`);
    lines.push(`\n[${r.name}] ${parts.join(", ")}`);
    for (const it of r.items) {
      const tag = it.unit === "comment" ? "  💬 " : "  · ";
      lines.push(tag + it.text.slice(0, 90));
    }
  }
  lines.push("");
  mkdirSync(dirname(LOG_PATH), { recursive: true });
  appendFileSync(LOG_PATH, lines.join("\n") + "\n");
}

async function main() {
  ensureSchema();
  const now = new Date();
  const bucket = hourBucket(now);
  const collectedAt = now.toISOString();
  const kstStamp = now.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

  console.log(`\n🗂  ${ADAPTERS.length}소스 수집 — 버킷 ${bucket} (${kstStamp} KST)\n`);

  const results = await Promise.all(ADAPTERS.map(runAdapter));

  // 콘솔 요약 + DB 저장
  console.log("소스        수집   저장(신규)");
  console.log("─".repeat(34));
  let totalSaved = 0;
  for (const r of results) {
    if (r.error) {
      console.log(`${r.name.padEnd(10)}  ⚠️ ${r.error.slice(0, 40)}`);
      continue;
    }
    const saved = save(r.items, bucket, collectedAt);
    totalSaved += saved;
    console.log(`${r.name.padEnd(10)}  ${String(r.items.length).padStart(4)}   ${String(saved).padStart(4)}`);
  }
  console.log("─".repeat(34));
  console.log(`총 신규 저장: ${totalSaved}건`);

  writeLog(results, bucket, kstStamp);
  console.log(`\n📝 소스별 상세 로그: ${LOG_PATH}\n`);
}

main().catch((err) => {
  console.error("[collect-sources] 실행 오류:", err);
  process.exit(1);
});
