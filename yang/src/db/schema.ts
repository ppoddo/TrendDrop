import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

// 커뮤니티/유튜브 원문 스냅샷 (제목·댓글). 추출·z-score 전 단계의 raw 축적.
// 유일한 활성 테이블. 같은 (source, text_hash, bucket_at)은 UNIQUE — 같은 버킷 내 재실행은 무시(중복 방지).
export const rawItems = sqliteTable(
  "raw_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    source: text("source", {
      enum: ["dcbest", "theqoo", "instiz", "youtube", "gtrends", "natepann"],
    }).notNull(),
    unit: text("unit", { enum: ["title", "comment"] }).notNull(),
    text: text("text").notNull(), // 원문 (제목/댓글)
    textHash: text("text_hash").notNull(), // sha1(text) — 중복 판정용
    meta: text("meta"), // JSON: 디시=갤태그, 유튜브=videoId 등
    bucketAt: text("bucket_at").notNull(), // 1시간 단위 floor, ISO string
    collectedAt: text("collected_at").notNull(),
  },
  (table) => ({
    uniqueItem: uniqueIndex("raw_items_unique").on(
      table.source,
      table.textHash,
      table.bucketAt
    ),
  })
);

// NOTE: 옛 파이프라인(v0/v1) 테이블 videos·comments·keyword_mentions·trends·trend_terms·channel_lead 은
// 스키마 정의에서 제거됨(새 코드가 안 씀). 기존 trend.db 안엔 아직 남아있으며,
// 물리 삭제가 필요하면 별도 DROP 마이그레이션으로 처리한다.
