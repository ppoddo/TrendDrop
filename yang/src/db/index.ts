import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { config } from "../config.js";
import * as schema from "./schema.js";

const sqlite = new Database(config.dbPath);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });

// 활성 테이블(raw_items)만 생성한다. 옛 파이프라인 테이블은 스키마에서 제거됨(schema.ts 주석 참고).
export function ensureSchema() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS raw_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      unit TEXT NOT NULL,
      text TEXT NOT NULL,
      text_hash TEXT NOT NULL,
      meta TEXT,
      bucket_at TEXT NOT NULL,
      collected_at TEXT NOT NULL,
      UNIQUE(source, text_hash, bucket_at)
    );
  `);
}
