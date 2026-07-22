"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PENDING_CATEGORY_KEY } from "@/app/command-palette";
import { getSeriesForKeyword, type SeriesPoint } from "@/lib/trend-timeline";

type Column = { clock: string; label: string; isLatest: boolean };
type KeywordOption = { keyword: string; category: string; rank: number };

type Props = {
  columns: Column[];
  categories: string[];
  matrix: number[][];
  keywords: KeywordOption[];
};

type Delta =
  | { kind: "up"; diff: number }
  | { kind: "down"; diff: number }
  | { kind: "new" }
  | { kind: "same" }
  | { kind: "out" };

const MAX_RANK = 20;
const CHART_W = 320;
const CHART_H = 190;
const PAD_X = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 26;

/** 최신 vs 직전 스냅샷 순위로 등락 계산 (시리즈만으로 self-contained). */
function seriesDelta(series: SeriesPoint[]): Delta {
  const current = series[series.length - 1]?.rank ?? null;
  const previous = series[series.length - 2]?.rank ?? null;
  if (current === null) return { kind: "out" };
  if (previous === null) return { kind: "new" };
  const diff = previous - current;
  if (diff > 0) return { kind: "up", diff };
  if (diff < 0) return { kind: "down", diff: -diff };
  return { kind: "same" };
}

function DeltaTag({ delta }: { delta: Delta }) {
  if (delta.kind === "new") return <span className="compare-delta is-new">NEW</span>;
  if (delta.kind === "out") return <span className="compare-delta is-same">이탈</span>;
  if (delta.kind === "up")
    return (
      <span className="compare-delta is-up">
        <span aria-hidden="true">▲</span>
        {delta.diff}
      </span>
    );
  if (delta.kind === "down")
    return (
      <span className="compare-delta is-down">
        <span aria-hidden="true">▼</span>
        {delta.diff}
      </span>
    );
  return (
    <span className="compare-delta is-same">
      <span aria-hidden="true">−</span>
    </span>
  );
}

function xFor(index: number, count: number): number {
  if (count <= 1) return PAD_X;
  return PAD_X + (index / (count - 1)) * (CHART_W - PAD_X * 2);
}

function yForRank(rank: number): number {
  // rank 1 = 위, rank MAX = 아래
  const ratio = (rank - 1) / (MAX_RANK - 1);
  return PAD_TOP + ratio * (CHART_H - PAD_TOP - PAD_BOTTOM);
}

/** rank=null 구간은 선을 끊는다 → 연속 구간(run)들의 배열로 분해. */
function runsOf(series: SeriesPoint[]): { i: number; rank: number }[][] {
  const runs: { i: number; rank: number }[][] = [];
  let current: { i: number; rank: number }[] = [];
  series.forEach((point, i) => {
    if (point.rank === null) {
      if (current.length) runs.push(current);
      current = [];
    } else {
      current.push({ i, rank: point.rank });
    }
  });
  if (current.length) runs.push(current);
  return runs;
}

function SeriesLine({
  series,
  className,
  count,
}: {
  series: SeriesPoint[];
  className: string;
  count: number;
}) {
  const runs = runsOf(series);
  const lastRun = runs[runs.length - 1];
  const endPoint = lastRun ? lastRun[lastRun.length - 1] : null;

  return (
    <g className={className}>
      {runs.map((run, ri) => {
        const d = run
          .map((p, k) => `${k === 0 ? "M" : "L"}${xFor(p.i, count).toFixed(1)},${yForRank(p.rank).toFixed(1)}`)
          .join(" ");
        const first = run[0];
        // 진입점: 시리즈 시작이 아닌 곳에서 처음 등장한 run의 첫 점
        const isEntry = first.i > 0;
        return (
          <g key={ri}>
            <path d={d} className="compare-path" />
            {isEntry && (
              <circle cx={xFor(first.i, count)} cy={yForRank(first.rank)} r={3.5} className="compare-entry" />
            )}
          </g>
        );
      })}
      {endPoint && (
        <circle cx={xFor(endPoint.i, count)} cy={yForRank(endPoint.rank)} r={4.5} className="compare-end" />
      )}
    </g>
  );
}

export default function ExploreView({ columns, categories, matrix, keywords }: Props) {
  const router = useRouter();

  const [keyA, setKeyA] = useState(keywords[0]?.keyword ?? "");
  const [keyB, setKeyB] = useState(keywords[1]?.keyword ?? keywords[0]?.keyword ?? "");

  const seriesA = useMemo(() => getSeriesForKeyword(keyA), [keyA]);
  const seriesB = useMemo(() => getSeriesForKeyword(keyB), [keyB]);
  const deltaA = useMemo(() => seriesDelta(seriesA), [seriesA]);
  const deltaB = useMemo(() => seriesDelta(seriesB), [seriesB]);

  const rankA = seriesA[seriesA.length - 1]?.rank ?? null;
  const rankB = seriesB[seriesB.length - 1]?.rank ?? null;

  const goToCategory = (category: string) => {
    // RankingBoard가 마운트 시 읽는 기존 메커니즘 재사용 (새 메커니즘 만들지 않음).
    try {
      sessionStorage.setItem(PENDING_CATEGORY_KEY, category);
    } catch {
      // 저장 불가 시 필터 없이 랭킹으로만 이동
    }
    router.push("/");
  };

  const yGuides = [1, 10, MAX_RANK];
  const clockTicks = columns.map((column, index) => ({ index, ...column }));

  return (
    <section className="explore" aria-labelledby="explore-title">
      <header className="explore-header">
        <h1 id="explore-title" className="explore-title">
          탐색
        </h1>
        <p className="explore-sub">카테고리 열기 흐름과 키워드 비교</p>
      </header>

      {/* --- 카테고리 × 시간 히트맵 --- */}
      <div className="explore-panel">
        <div className="explore-panel-head">
          <p className="explore-eyebrow">카테고리 히트맵</p>
          <p className="explore-hint">셀이 진할수록 그 시점에 뜨거운 카테고리 · 행을 누르면 랭킹에서 필터</p>
        </div>

        <div className="heat-scroll">
          <table className="heat-table">
            <thead>
              <tr>
                <th className="heat-corner" scope="col">
                  <span className="sr-only">카테고리</span>
                </th>
                {columns.map((column, index) => (
                  <th
                    key={index}
                    scope="col"
                    className={`heat-colhead${column.isLatest ? " is-now" : ""}`}
                  >
                    {column.isLatest ? "지금" : column.clock}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((category, r) => (
                <tr key={category}>
                  <th scope="row" className="heat-rowhead">
                    <button
                      type="button"
                      className="heat-cat"
                      onClick={() => goToCategory(category)}
                      title={`${category} 랭킹 보기`}
                    >
                      {category}
                    </button>
                  </th>
                  {columns.map((column, c) => {
                    const heat = matrix[r][c];
                    return (
                      <td
                        key={c}
                        className="heat-cell"
                        title={`${category} · ${column.isLatest ? "지금" : column.clock} · heat ${heat}`}
                        aria-label={`${category} ${column.clock} 열기 ${heat}`}
                      >
                        <span className="heat-fill" style={{ opacity: heat / 100 }} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- A/B 키워드 비교 --- */}
      <div className="explore-panel">
        <div className="explore-panel-head">
          <p className="explore-eyebrow">키워드 A/B 비교</p>
          <p className="explore-hint">최근 12시간 순위 궤적 (위로 갈수록 상위)</p>
        </div>

        <div className="compare-picks">
          <label className="compare-pick is-a">
            <span className="compare-pick-tag">A</span>
            <select
              className="compare-select"
              value={keyA}
              onChange={(event) => setKeyA(event.target.value)}
              aria-label="비교 키워드 A"
            >
              {keywords.map((option) => (
                <option key={option.keyword} value={option.keyword}>
                  {option.rank}. {option.keyword}
                </option>
              ))}
            </select>
          </label>

          <label className="compare-pick is-b">
            <span className="compare-pick-tag">B</span>
            <select
              className="compare-select"
              value={keyB}
              onChange={(event) => setKeyB(event.target.value)}
              aria-label="비교 키워드 B"
            >
              {keywords.map((option) => (
                <option key={option.keyword} value={option.keyword}>
                  {option.rank}. {option.keyword}
                </option>
              ))}
            </select>
          </label>
        </div>

        <svg
          className="compare-chart"
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          role="img"
          aria-label={`${keyA} 대 ${keyB} 순위 궤적 비교`}
        >
          {yGuides.map((rank) => (
            <g key={rank}>
              <line
                x1={PAD_X}
                x2={CHART_W - PAD_X}
                y1={yForRank(rank)}
                y2={yForRank(rank)}
                className="compare-grid"
              />
              <text x={2} y={yForRank(rank) + 3} className="compare-axis">
                {rank}
              </text>
            </g>
          ))}

          {clockTicks
            .filter((tick) => tick.index === 0 || tick.index === 6 || tick.isLatest)
            .map((tick) => (
              <text
                key={tick.index}
                x={xFor(tick.index, columns.length)}
                y={CHART_H - 8}
                className="compare-axis is-x"
                textAnchor="middle"
              >
                {tick.isLatest ? "지금" : tick.clock}
              </text>
            ))}

          <SeriesLine series={seriesB} className="compare-series-b" count={columns.length} />
          <SeriesLine series={seriesA} className="compare-series-a" count={columns.length} />
        </svg>

        <ul className="compare-legend">
          <li className="compare-legend-item is-a">
            <span className="compare-swatch" aria-hidden="true" />
            <span className="compare-legend-name">{keyA}</span>
            <span className="compare-legend-rank">{rankA === null ? "권외" : `${rankA}위`}</span>
            <DeltaTag delta={deltaA} />
          </li>
          <li className="compare-legend-item is-b">
            <span className="compare-swatch" aria-hidden="true" />
            <span className="compare-legend-name">{keyB}</span>
            <span className="compare-legend-rank">{rankB === null ? "권외" : `${rankB}위`}</span>
            <DeltaTag delta={deltaB} />
          </li>
        </ul>
      </div>
    </section>
  );
}
