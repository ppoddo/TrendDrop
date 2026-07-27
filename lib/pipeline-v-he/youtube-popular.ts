import { getYoutubeApiKey } from "@/lib/env";

const YOUTUBE_BASE_URL = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_TIMEOUT_MS = 15_000;

export const trendCategories = [
  { id: "26", label: "뷰티/패션" },
  { id: "19", label: "여행" },
  { id: "28", label: "테크" },
  { id: "22", label: "라이프스타일" },
  { id: "24", label: "엔터테인먼트" },
] as const;

export type TrendVideo = {
  videoId: string;
  title: string;
  channelTitle: string;
  categoryLabel: string;
  tags: string[];
  viewCount: number;
  likeCount: number | null;
  hoursSincePublished: number;
  viewsPerHour: number;
};

export type VideoComment = {
  text: string;
  likeCount: number;
};

async function callYoutube<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const url = new URL(`${YOUTUBE_BASE_URL}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("key", getYoutubeApiKey());

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(YOUTUBE_TIMEOUT_MS),
  });

  if (!response.ok) {
    // 댓글이 비활성화된 영상은 403이 반환되므로 예외 대신 null로 조용히 스킵
    console.error(`YouTube API ${path} failed (${response.status})`);
    return null;
  }

  return (await response.json()) as T;
}

function toTrendVideo(item: any, categoryLabel: string): TrendVideo {
  const viewCount = Number(item.statistics?.viewCount ?? 0);
  const hoursSincePublished = Math.max(
    (Date.now() - new Date(item.snippet.publishedAt).getTime()) / 3_600_000,
    1
  );

  return {
    videoId: item.id,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    categoryLabel,
    tags: item.snippet.tags ?? [],
    viewCount,
    likeCount: item.statistics?.likeCount ? Number(item.statistics.likeCount) : null,
    hoursSincePublished,
    viewsPerHour: Math.round(viewCount / hoursSincePublished),
  };
}

export async function fetchMostPopular(
  categoryId?: string,
  categoryLabel = "전체"
): Promise<TrendVideo[]> {
  const params: Record<string, string> = {
    part: "snippet,statistics",
    chart: "mostPopular",
    regionCode: "KR",
    maxResults: "12",
  };

  if (categoryId) {
    params.videoCategoryId = categoryId;
  }

  const body = await callYoutube<{ items?: any[] }>("videos", params);

  return (body?.items ?? []).map((item) => toTrendVideo(item, categoryLabel));
}

export async function fetchTopComments(videoId: string): Promise<VideoComment[]> {
  const body = await callYoutube<{ items?: any[] }>("commentThreads", {
    part: "snippet",
    videoId,
    order: "relevance",
    textFormat: "plainText",
    maxResults: "50",
  });

  if (!body?.items) {
    return [];
  }

  return body.items.map((item) => {
    const snippet = item.snippet.topLevelComment.snippet;
    return {
      text: snippet.textOriginal ?? snippet.textDisplay ?? "",
      likeCount: Number(snippet.likeCount ?? 0),
    };
  });
}
