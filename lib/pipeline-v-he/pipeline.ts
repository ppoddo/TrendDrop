import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { hasYoutubeApiKey } from "@/lib/env";
import { fetchGoogleTrendingKeywords } from "@/lib/google-trends";
import { searchGoogleNewsRss } from "@/lib/google-news-rss";

import { ensureVHeTables } from "./db-setup";
import {
  vheCollectionRuns,
  vheKeywords,
  vheRawSignals,
  vheSources,
  vheTrendContents,
  vheTrendSnapshots,
} from "./schema";
import { buildRawSignals, rankKeywords, type RankedKeyword } from "./trend-refine";
import {
  fetchMostPopular,
  fetchTopComments,
  trendCategories,
  type TrendVideo,
  type VideoComment,
} from "./youtube-popular";

function categoryFor(term: string, hint: string | null) {
  if (hint) return hint;
  if (/ai|앱|테크|스마트폰|챗gpt/i.test(term)) return "테크";
  if (/축구|야구|월드컵|선수|경기/i.test(term)) return "스포츠";
  if (/패션|뷰티|화장|메이크업|신발/i.test(term)) return "패션·뷰티";
  if (/맛집|음식|카페|레시피/i.test(term)) return "푸드";
  return "사회·문화";
}

function sourceLabelFor(item: RankedKeyword) {
  if (item.sourceTypes.includes("trending_search") && item.sourceTypes.length > 1) {
    return `Google Trends + YouTube(${item.sourceTypes.filter((s) => s !== "trending_search").join("·")}) 교차확인`;
  }
  if (item.sourceTypes.includes("trending_search")) {
    return "Google Trends";
  }
  return `YouTube · ${item.sourceTypes.join(", ")}`;
}

// YouTube mostPopular(전체 + 카테고리 5종)을 모아 videoId 기준으로 합치고,
// 확산 속도 상위 10개 영상의 댓글을 가져온다 (bottom-up 후보 발굴용 원문 소스).
async function collectYoutubeSignals() {
  const merged = new Map<string, TrendVideo>();

  const whole = await fetchMostPopular(undefined, "전체").catch(() => []);
  for (const video of whole) merged.set(video.videoId, video);

  for (const category of trendCategories) {
    const videos = await fetchMostPopular(category.id, category.label).catch(() => []);
    for (const video of videos) {
      const existing = merged.get(video.videoId);
      merged.set(video.videoId, existing ? { ...existing, categoryLabel: category.label } : video);
    }
  }

  const videos = [...merged.values()];
  const commentsByVideo = new Map<string, VideoComment[]>();
  const topByVelocity = [...videos].sort((a, b) => b.viewsPerHour - a.viewsPerHour).slice(0, 10);

  for (const video of topByVelocity) {
    commentsByVideo.set(video.videoId, await fetchTopComments(video.videoId).catch(() => []));
  }

  return { videos, commentsByVideo };
}

export async function collectTrendPipelineVHe({ geo = "KR", limit = 15 } = {}) {
  await ensureVHeTables();
  const db = getDb();

  const [run] = await db.insert(vheCollectionRuns).values({ geo }).returning();

  const [trendSource] = await db
    .insert(vheSources)
    .values({ name: "Google Trends", kind: "google-trends" })
    .onConflictDoUpdate({ target: vheSources.name, set: { kind: "google-trends" } })
    .returning();
  const [youtubeSource] = await db
    .insert(vheSources)
    .values({ name: "YouTube Data API", kind: "youtube" })
    .onConflictDoUpdate({ target: vheSources.name, set: { kind: "youtube" } })
    .returning();
  await db
    .insert(vheSources)
    .values({ name: "Google News RSS", kind: "google-news" })
    .onConflictDoUpdate({ target: vheSources.name, set: { kind: "google-news" } });

  const trends = await fetchGoogleTrendingKeywords({ geo, limit: 20 }).catch(() => []);
  const trendingSearches = trends.map((trend) => ({
    term: trend.term,
    traffic: trend.traffic,
    sample: trend.relatedQueries[0] ?? null,
  }));

  const { videos, commentsByVideo } = hasYoutubeApiKey()
    ? await collectYoutubeSignals()
    : { videos: [] as TrendVideo[], commentsByVideo: new Map<string, VideoComment[]>() };

  const signals = buildRawSignals({ videos, commentsByVideo, trendingSearches });

  if (signals.length) {
    await db
      .insert(vheRawSignals)
      .values(
        signals.map((signal) => ({
          runId: run.id,
          source: signal.source,
          text: signal.text,
          textHash: signal.textHash,
          videoId: signal.videoId,
          meta: signal.categoryHint ? { categoryHint: signal.categoryHint } : null,
        }))
      )
      .onConflictDoNothing();
  }

  const ranked = rankKeywords(signals, { limit });
  const results = [];

  for (const [index, item] of ranked.entries()) {
    const category = categoryFor(item.term, item.categoryHint);
    const sourceId = item.sourceTypes.includes("trending_search") ? trendSource.id : youtubeSource.id;

    const [keyword] = await db
      .insert(vheKeywords)
      .values({ term: item.term, category, sourceId })
      .onConflictDoUpdate({ target: vheKeywords.term, set: { category, sourceId } })
      .returning();

    const news = await searchGoogleNewsRss(item.term).catch(() => []);

    await db.insert(vheTrendSnapshots).values({
      keywordId: keyword.id,
      runId: run.id,
      rank: index + 1,
      score: item.score,
      growthRate: `${item.mentions}회 언급`,
      velocity: `${Math.min(10, item.score / 20).toFixed(1)}/10`,
      summary: news[0]?.title ?? item.sample ?? `${item.term} 관련 반응이 늘고 있습니다.`,
      reason: `${item.sourceTypes.join(", ")}에서 총 ${item.mentions}회 확인된 후보 키워드입니다.`,
      sourceLabel: sourceLabelFor(item),
      externalRef: `run:${run.id}:${item.term}`,
      sourceUrl: news[0]?.link ?? null,
    });

    for (const newsItem of news.slice(0, 3)) {
      await db.insert(vheTrendContents).values({
        keywordId: keyword.id,
        kind: "news",
        title: newsItem.title,
        url: newsItem.link,
        source: newsItem.source,
        publishedAt: newsItem.publishedAt ? new Date(newsItem.publishedAt) : null,
      });
    }

    results.push({ term: item.term, score: item.score, mentions: item.mentions, sources: item.sourceTypes });
  }

  await db
    .update(vheCollectionRuns)
    .set({ finishedAt: new Date(), rawSignalCount: signals.length, keywordCount: ranked.length })
    .where(eq(vheCollectionRuns.id, run.id));

  return { geo, runId: run.id, rawSignals: signals.length, selected: ranked.length, items: results };
}
