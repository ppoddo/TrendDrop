import Link from "next/link";

import "./trend.css";

type Reason = {
  source: string;
  text: string;
};

type RelatedItem = {
  platform: string;
  title: string;
  metric: string;
  kind: string;
};

type TrendDetail = {
  rank: number;
  keyword: string;
  category: string;
  growth: string;
  velocity: string;
  score: number;
  detectedAgo: string;
  updatedAgo: string;
  summary: string;
  reasons: Reason[];
  series: number[];
  days: string[];
  related: RelatedItem[];
  keywords: string[];
  channels: string[];
};

const trend: TrendDetail = {
  rank: 1,
  keyword: "제로슈가 아이스티",
  category: "푸드",
  growth: "+182%",
  velocity: "9.1",
  score: 88,
  detectedAgo: "2시간 전",
  updatedAgo: "2시간 전",
  summary:
    "운동 루틴과 다이어트 브이로그에서 반복 노출되며 저장과 공유가 빠르게 늘고 있습니다. 짧은 레시피 영상과 체형관리 콘텐츠가 함께 묶이며 확산되는 흐름입니다.",
  reasons: [
    { source: "Instagram Reels", text: '"10초 홈카페" 포맷 레시피 릴스가 저장 수 상위권에 반복 진입' },
    { source: "Facebook Groups", text: "다이어트·헬스 커뮤니티에서 제품 비교·후기 댓글이 급증" },
    { source: "YouTube Shorts", text: "체형관리 브이로그에 자연스럽게 삽입되며 연관 검색 동반 상승" },
  ],
  series: [22, 26, 24, 41, 58, 74, 100],
  days: ["월", "화", "수", "목", "금", "토", "일"],
  related: [
    { platform: "Instagram", title: "제로슈가 홈카페 3종 레시피", metric: "저장 12.4K", kind: "릴스" },
    { platform: "YouTube", title: "다이어트 중 음료 뭐 마셔?", metric: "조회 84만", kind: "쇼츠" },
    { platform: "Facebook", title: "제로 아이스티 실측 후기 모음", metric: "댓글 2.1K", kind: "그룹" },
  ],
  keywords: ["#다이어트음료", "#홈카페", "#저칼로리", "#제로슈가", "#여름음료", "#헬스간식"],
  channels: ["Instagram Reels", "Facebook Groups", "YouTube Shorts"],
};

function platformGlyph(platform: string): string {
  switch (platform) {
    case "Instagram":
      return "IG";
    case "YouTube":
      return "▶";
    case "Facebook":
      return "f";
    default:
      return platform.slice(0, 2).toUpperCase();
  }
}

function platformClass(platform: string): string {
  return `td-thumb-${platform.toLowerCase()}`;
}

function Spark({ series, days }: { series: number[]; days: string[] }) {
  const width = 320;
  const height = 120;
  const padX = 10;
  const padY = 14;
  const max = 100;
  const min = 0;
  const stepX = series.length > 1 ? (width - padX * 2) / (series.length - 1) : 0;

  const yFor = (value: number) => padY + (height - padY * 2) * (1 - (value - min) / (max - min));

  const points = series.map((value, index) => ({
    x: padX + index * stepX,
    y: yFor(value),
  }));

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");

  const floor = (height - padY).toFixed(1);
  const areaPath =
    points.length > 0
      ? `${linePath} L${points[points.length - 1].x.toFixed(1)},${floor} L${points[0].x.toFixed(1)},${floor} Z`
      : "";

  const gridValues = [75, 50, 25];
  const axisValues = [100, 50, 0];
  const last = points[points.length - 1] as { x: number; y: number } | undefined;

  return (
    <div className="td-spark">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="td-spark-svg"
        role="img"
        aria-label="최근 7일 관심 지표 추이 차트"
      >
        {gridValues.map((value) => (
          <line
            key={value}
            x1={padX}
            x2={width - padX}
            y1={yFor(value)}
            y2={yFor(value)}
            className="td-spark-grid"
          />
        ))}
        {axisValues.map((value) => (
          <text key={value} x={width - padX} y={yFor(value) - 3} className="td-spark-axis" textAnchor="end">
            {value}
          </text>
        ))}
        {areaPath && <path d={areaPath} className="td-spark-area" />}
        <path d={linePath} className="td-spark-line" />
        {last && <circle cx={last.x} cy={last.y} r={4} className="td-spark-dot" />}
      </svg>
      <div className="td-spark-days">
        {days.map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>
    </div>
  );
}

export default function TrendDetailPage() {
  return (
    <div className="td">
      <div className="td-content">
        <div className="td-topbar">
          <Link href="/" className="td-back">
            ← 트렌드 목록
          </Link>
          <span className="td-rank">#{trend.rank}</span>
          <span className="td-tag">{trend.category}</span>
        </div>

        <section className="td-hero">
          <p className="td-kicker">{trend.category} · 분석</p>
          <h1 className="td-title">{trend.keyword}</h1>
          <p className="td-byline">분석 · {trend.detectedAgo}</p>
        </section>

        <section className="td-metrics" aria-label="핵심 지표">
          <div className="td-stat">
            <span className="td-stat-value td-up">{trend.growth}</span>
            <span className="td-stat-label">검색 상승률</span>
          </div>
          <div className="td-stat">
            <span className="td-stat-value">
              {trend.velocity}
              <em>/10</em>
            </span>
            <span className="td-stat-label">확산 속도</span>
          </div>
          <div className="td-stat">
            <span className="td-stat-value">
              {trend.score}
              <em>/100</em>
            </span>
            <span className="td-stat-label">트렌드 점수</span>
          </div>
          <div className="td-stat">
            <span className="td-stat-value">{trend.detectedAgo}</span>
            <span className="td-stat-label">감지 시점</span>
          </div>
        </section>

        <section className="td-panel">
          <h2 className="td-h2">상승 추이</h2>
          <Spark series={trend.series} days={trend.days} />
        </section>

        <section className="td-panel">
          <p className="td-eyebrow">AI 요약 · 왜 뜨나</p>
          <p className="td-summary">{trend.summary}</p>
          <ol className="td-reasons">
            {trend.reasons.map((reason) => (
              <li key={reason.source}>
                <span className="td-reason-source">{reason.source}</span>
                <p>{reason.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="td-panel">
          <h2 className="td-h2">관련 콘텐츠</h2>
          <div className="td-related-grid">
            {trend.related.map((item) => (
              <article className="td-related-card" key={item.title}>
                <div className={`td-thumb ${platformClass(item.platform)}`}>
                  <span>{platformGlyph(item.platform)}</span>
                </div>
                <div className="td-related-body">
                  <p className="td-related-platform">
                    {item.platform} · {item.kind}
                  </p>
                  <p className="td-related-title">{item.title}</p>
                  <p className="td-related-metric">{item.metric}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="td-panel">
          <h2 className="td-h2">연관 키워드</h2>
          <div className="td-chips">
            {trend.keywords.map((keyword) => (
              <span className="td-chip" key={keyword}>
                {keyword}
              </span>
            ))}
          </div>
        </section>

        <section className="td-panel">
          <h2 className="td-h2">감지 채널</h2>
          <ul className="td-channel-list">
            {trend.channels.map((channel) => (
              <li key={channel}>
                <span className="td-live-dot" aria-hidden="true" />
                {channel}
              </li>
            ))}
          </ul>
        </section>

        <footer className="td-footer">마지막 갱신 {trend.updatedAgo} · 데이터는 예시(mock)입니다</footer>
      </div>
    </div>
  );
}
