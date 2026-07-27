import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is not configured");
  process.exit(1);
}

const runCount = Math.max(1, Number(process.argv[2] ?? 1) || 1);
const RAW_SIGNAL_PREVIEW = 15;

const sql = postgres(databaseUrl, { prepare: false, max: 1 });

function formatDate(date) {
  return date ? new Date(date).toLocaleString("ko-KR") : "-";
}

try {
  const runs = await sql`
    select id, geo, started_at, finished_at, raw_signal_count, keyword_count
    from vhe_collection_runs
    order by started_at desc
    limit ${runCount}
  `;

  if (runs.length === 0) {
    console.log("수집 기록이 없습니다. 먼저 파이프라인(POST /api/admin/collect/pipeline-v-he)을 실행하세요.");
  }

  for (const run of runs) {
    console.log("=".repeat(78));
    console.log(
      `RUN #${run.id}  geo=${run.geo}  시작 ${formatDate(run.started_at)}  종료 ${formatDate(run.finished_at)}`
    );
    console.log(`원문 신호 ${run.raw_signal_count ?? "-"}건, 키워드 ${run.keyword_count ?? "-"}건`);
    console.log("=".repeat(78));

    const signals = await sql`
      select source, text
      from vhe_raw_signals
      where run_id = ${run.id}
      order by source, id
    `;

    const bySource = new Map();
    for (const signal of signals) {
      const list = bySource.get(signal.source) ?? [];
      list.push(signal);
      bySource.set(signal.source, list);
    }

    for (const [source, items] of bySource) {
      console.log(`\n[${source}] ${items.length}건`);
      for (const item of items.slice(0, RAW_SIGNAL_PREVIEW)) {
        console.log(`  · ${item.text.slice(0, 80)}`);
      }
      if (items.length > RAW_SIGNAL_PREVIEW) {
        console.log(`  ... 외 ${items.length - RAW_SIGNAL_PREVIEW}건`);
      }
    }

    const ranked = await sql`
      select k.term, s.rank, s.score, s.growth_rate, s.source_label, s.summary
      from vhe_trend_snapshots s
      join vhe_keywords k on k.id = s.keyword_id
      where s.run_id = ${run.id}
      order by s.rank asc nulls last, s.score desc
    `;

    console.log(`\n[최종 랭킹]`);
    for (const item of ranked) {
      console.log(`  ${item.rank ?? "-"}. ${item.term}  (점수 ${item.score}, ${item.growth_rate ?? ""}, ${item.source_label ?? ""})`);
      if (item.summary) console.log(`     └ ${item.summary}`);
    }
    console.log("");
  }
} catch (error) {
  console.error("리포트 조회 실패");
  console.error(error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
