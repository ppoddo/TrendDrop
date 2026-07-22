import { sql } from "drizzle-orm";

import { getDb, isDbConfigured } from "@/db";

// vhe_ 접두사 테이블만 다룬다 — 기존 sources/keywords/trend_snapshots/trend_contents는 건드리지 않는다.
export async function ensureVHeTables() {
  if (!isDbConfigured()) {
    throw new Error("DATABASE_URL is not configured");
  }

  const db = getDb();

  await db.execute(sql`
    create table if not exists vhe_sources (
      id integer generated always as identity primary key,
      name varchar(80) not null unique,
      kind varchar(40) not null,
      created_at timestamptz not null default now()
    );
  `);

  await db.execute(sql`
    create table if not exists vhe_keywords (
      id integer generated always as identity primary key,
      term varchar(160) not null unique,
      category varchar(80) not null,
      source_id integer references vhe_sources(id),
      created_at timestamptz not null default now()
    );
  `);

  await db.execute(sql`
    create table if not exists vhe_collection_runs (
      id integer generated always as identity primary key,
      geo varchar(8) not null,
      started_at timestamptz not null default now(),
      finished_at timestamptz,
      raw_signal_count integer,
      keyword_count integer
    );
  `);

  await db.execute(sql`alter table vhe_collection_runs add column if not exists api_call_log jsonb;`);

  await db.execute(sql`
    create table if not exists vhe_raw_signals (
      id integer generated always as identity primary key,
      run_id integer not null references vhe_collection_runs(id),
      source varchar(40) not null,
      text text not null,
      text_hash varchar(64) not null,
      video_id varchar(32),
      meta jsonb,
      captured_at timestamptz not null default now()
    );
  `);

  await db.execute(sql`
    create unique index if not exists vhe_raw_signals_dedup_idx on vhe_raw_signals(run_id, source, text_hash);
  `);

  await db.execute(sql`
    create table if not exists vhe_trend_snapshots (
      id integer generated always as identity primary key,
      keyword_id integer not null references vhe_keywords(id),
      run_id integer not null references vhe_collection_runs(id),
      rank integer,
      score integer,
      growth_rate varchar(32),
      velocity varchar(32),
      summary text,
      reason text,
      source_label varchar(200),
      external_ref varchar(120),
      source_url text,
      captured_at timestamptz not null default now()
    );
  `);

  await db.execute(sql`
    create table if not exists vhe_trend_contents (
      id integer generated always as identity primary key,
      keyword_id integer not null references vhe_keywords(id),
      kind varchar(32) not null,
      title text not null,
      url text not null,
      source varchar(160),
      rank integer,
      published_at timestamptz,
      created_at timestamptz not null default now()
    );
  `);

  return { ok: true };
}
