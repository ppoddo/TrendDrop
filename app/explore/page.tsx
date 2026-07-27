import ExploreView from "@/app/explore-view";
import { getCategoryHeat, latestSnapshot, snapshots } from "@/lib/trend-timeline";

export default function ExplorePage() {
  // 열 = 12개 스냅샷(오래된 → 지금)
  const columns = snapshots.map((snapshot) => ({
    clock: snapshot.clock,
    label: snapshot.label,
    isLatest: snapshot.id === latestSnapshot.id,
  }));

  // 각 스냅샷의 카테고리별 heat 조회 결과를 맵으로
  const heatByColumn = snapshots.map(
    (snapshot) => new Map(getCategoryHeat(snapshot.id).map((row) => [row.category, row.heat])),
  );

  // 행 순서 = 최신 스냅샷 heat 내림차순 (getCategoryHeat가 이미 desc 정렬)
  const categories = getCategoryHeat(latestSnapshot.id).map((row) => row.category);

  // 매트릭스[행][열] = heat(0~100), 없으면 0
  const matrix = categories.map((category) =>
    heatByColumn.map((column) => column.get(category) ?? 0),
  );

  // A/B 옵션 = 최신 20개 키워드
  const keywords = latestSnapshot.items.map((item) => ({
    keyword: item.keyword,
    category: item.category,
    rank: item.rank,
  }));

  return (
    <div className="page-shell">
      <main className="app-main">
        <ExploreView
          columns={columns}
          categories={categories}
          matrix={matrix}
          keywords={keywords}
        />
      </main>
    </div>
  );
}
