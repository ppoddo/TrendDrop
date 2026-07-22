// 이 파이프라인은 기존 master의 sources/keywords/trendSnapshots/trendContents와
// 완전히 분리된 별도 테이블(vhe_ 접두사)을 쓴다. 결과 비교 후 채택되지 않으면
// 이 디렉토리와 vhe_ 테이블만 지우면 되고, 기존 파이프라인엔 영향이 없다.
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const vheSources = pgTable(
  "vhe_sources",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar("name", { length: 80 }).notNull(),
    kind: varchar("kind", { length: 40 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    vheSourceNameIdx: uniqueIndex("vhe_sources_name_idx").on(table.name),
  })
);

export const vheKeywords = pgTable(
  "vhe_keywords",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    term: varchar("term", { length: 160 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    sourceId: integer("source_id").references(() => vheSources.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    vheKeywordTermIdx: uniqueIndex("vhe_keywords_term_idx").on(table.term),
  })
);

export const vheCollectionRuns = pgTable("vhe_collection_runs", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  geo: varchar("geo", { length: 8 }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  rawSignalCount: integer("raw_signal_count"),
  keywordCount: integer("keyword_count"),
  // 임시 로그: 이 실행 동안 외부 트렌드 API를 몇 시에 호출했는지 [{ api, calledAt }] 형태로 기록
  apiCallLog: jsonb("api_call_log"),
});

export const vheRawSignals = pgTable(
  "vhe_raw_signals",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    runId: integer("run_id").notNull().references(() => vheCollectionRuns.id),
    source: varchar("source", { length: 40 }).notNull(),
    text: text("text").notNull(),
    textHash: varchar("text_hash", { length: 64 }).notNull(),
    videoId: varchar("video_id", { length: 32 }),
    meta: jsonb("meta"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    vheRawSignalDedupIdx: uniqueIndex("vhe_raw_signals_dedup_idx").on(table.runId, table.source, table.textHash),
  })
);

export const vheTrendSnapshots = pgTable("vhe_trend_snapshots", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  keywordId: integer("keyword_id").notNull().references(() => vheKeywords.id),
  runId: integer("run_id").notNull().references(() => vheCollectionRuns.id),
  rank: integer("rank"),
  score: integer("score"),
  growthRate: varchar("growth_rate", { length: 32 }),
  velocity: varchar("velocity", { length: 32 }),
  summary: text("summary"),
  reason: text("reason"),
  sourceLabel: varchar("source_label", { length: 200 }),
  externalRef: varchar("external_ref", { length: 120 }),
  sourceUrl: text("source_url"),
  capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
});

export const vheTrendContents = pgTable("vhe_trend_contents", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  keywordId: integer("keyword_id").notNull().references(() => vheKeywords.id),
  kind: varchar("kind", { length: 32 }).notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  source: varchar("source", { length: 160 }),
  rank: integer("rank"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
