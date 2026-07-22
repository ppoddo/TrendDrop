import { createHash } from "node:crypto";

import type { TrendVideo, VideoComment } from "./youtube-popular";

export type RefineSourceType = "trending_search" | "video_title" | "video_tag" | "comment";

export type TrendingSearchInput = {
  term: string;
  traffic: number | null;
  sample?: string | null;
};

export type RawSignal = {
  source: RefineSourceType;
  text: string;
  textHash: string;
  videoId: string | null;
  weight: number;
  sample: string;
  categoryHint: string | null;
};

export type RankedKeyword = {
  term: string;
  score: number;
  mentions: number;
  sourceTypes: RefineSourceType[];
  sample: string | null;
  categoryHint: string | null;
};

// 댓글/제목에서 자주 나오지만 트렌드 정보가 없는 일반어
const STOPWORDS = new Set([
  "진짜", "너무", "정말", "완전", "그냥", "근데", "그리고", "하지만", "그래서",
  "저는", "제가", "내가", "나는", "우리", "저도", "나도", "당신", "여러분",
  "오늘", "지금", "요즘", "이제", "아직", "계속", "다시", "매일", "항상",
  "이거", "그거", "저거", "이런", "그런", "저런", "이게", "그게", "뭔가",
  "좋아요", "좋다", "좋아", "좋은", "최고", "대박", "사랑", "감사", "감사합니다",
  "응원", "화이팅", "파이팅", "축하", "행복", "귀엽다", "귀여워", "예쁘다", "예뻐",
  "있는", "없는", "하는", "되는", "같아요", "같은", "같다", "합니다", "했다",
  "때문", "정도", "느낌", "생각", "사람", "얘기", "이야기", "모습", "마음",
  "영상", "채널", "구독", "댓글", "알고리즘", "유튜브", "쇼츠", "보고", "보는",
  "봤는데", "봤어요", "나온", "나왔다", "올려", "올린", "처음", "마지막",
  "다들", "역시", "약간", "많이", "조금", "너무나", "엄청", "되게", "무슨",
  "왜케", "왜이렇게", "어떻게", "어떤", "언제", "어디", "누가", "무엇",
  // 팬덤 댓글에 흔한 영어 불용어 — 한국어 불용어만으론 걸러지지 않아 별도 보강
  "the", "is", "was", "are", "this", "that", "and", "for", "with", "you",
  "your", "just", "so", "to", "of", "in", "on", "it", "my", "me", "we",
]);

const PARTICLE_SUFFIXES = [
  "에서는", "에서도", "입니다", "습니다", "네요", "세요", "해요", "예요",
  "이에요", "에서", "에게", "한테", "께서", "으로", "이랑", "까지", "부터",
  "처럼", "보다", "마다", "조차", "마저", "은", "는", "이", "가", "을", "를",
  "도", "만", "에", "의", "와", "과", "로", "랑",
];

function stripParticle(token: string) {
  for (const suffix of PARTICLE_SUFFIXES) {
    if (token.endsWith(suffix) && token.length - suffix.length >= 2) {
      return token.slice(0, token.length - suffix.length);
    }
  }
  return token;
}

export function tokenize(text: string): string[] {
  return text
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, " ")
    .replace(/[ㅋㅎㅠㅜ]{2,}/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((token) => stripParticle(token.trim()))
    .filter(
      (token) =>
        token.length >= 2 &&
        token.length <= 20 &&
        !/^\d+$/.test(token) &&
        !/^[ㄱ-ㅣ]+$/.test(token) &&
        !STOPWORDS.has(token)
    );
}

function textHash(text: string) {
  return createHash("sha1").update(text.trim().toLowerCase()).digest("hex");
}

// 반응이 큰 영상의 키워드일수록 가중 — 로그 스케일이라 1~3.5배 범위에 머문다
function videoBoost(video: TrendVideo) {
  const velocityBoost = Math.min(Math.log10(video.viewsPerHour + 1), 5) / 2;
  const likeBoost = video.likeCount ? Math.min(video.likeCount / 100_000, 0.5) : 0;
  return 1 + velocityBoost + likeBoost;
}

/**
 * 원문 신호를 소스별로 모으고 (run, source, text) 단위로 중복 제거한다.
 * 같은 실행 안에서 반복되는 댓글/제목이 점수를 부풀리지 않게 막는 동시에,
 * DB에 저장할 raw log(원문 확인용)로도 그대로 쓸 수 있는 형태다.
 */
export function buildRawSignals({
  videos,
  commentsByVideo,
  trendingSearches,
}: {
  videos: TrendVideo[];
  commentsByVideo: Map<string, VideoComment[]>;
  trendingSearches: TrendingSearchInput[];
}): RawSignal[] {
  const seen = new Map<string, RawSignal>();

  const push = (
    source: RefineSourceType,
    text: string,
    videoId: string | null,
    weight: number,
    sample: string,
    categoryHint: string | null
  ) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const hash = textHash(trimmed);
    const key = `${source}:${hash}`;
    if (seen.has(key)) return;
    seen.set(key, { source, text: trimmed, textHash: hash, videoId, weight, sample, categoryHint });
  };

  for (const search of trendingSearches) {
    if (!search.term) continue;
    const trafficBoost = 1 + Math.log10((search.traffic ?? 100) + 1) / 4;
    push("trending_search", search.term, null, 40 * trafficBoost, search.sample ?? search.term, null);
  }

  for (const video of videos) {
    const boost = videoBoost(video);
    push("video_title", video.title, video.videoId, 3 * boost, video.title, video.categoryLabel);
    for (const tag of video.tags) {
      push("video_tag", tag, video.videoId, 6 * boost, video.title, video.categoryLabel);
    }
  }

  for (const [videoId, comments] of commentsByVideo) {
    const video = videos.find((item) => item.videoId === videoId);
    const boost = video ? videoBoost(video) : 1;
    for (const comment of comments) {
      const likeWeight = Math.min(comment.likeCount / 50, 4);
      push(
        "comment",
        comment.text,
        videoId,
        (1 + likeWeight) * boost,
        video?.title ?? comment.text,
        video?.categoryLabel ?? null
      );
    }
  }

  return [...seen.values()];
}

type Accumulator = Map<
  string,
  {
    score: number;
    mentions: number;
    sourceTypes: Set<RefineSourceType>;
    sample: string | null;
    categoryVotes: Map<string, number>;
  }
>;

function addToken(
  acc: Accumulator,
  term: string,
  weight: number,
  source: RefineSourceType,
  sample: string,
  categoryHint: string | null
) {
  const key = term.toLowerCase();
  const entry = acc.get(key) ?? {
    score: 0,
    mentions: 0,
    sourceTypes: new Set<RefineSourceType>(),
    sample: null,
    categoryVotes: new Map<string, number>(),
  };
  entry.score += weight;
  entry.mentions += 1;
  entry.sourceTypes.add(source);
  entry.sample = entry.sample ?? sample;
  if (categoryHint) {
    entry.categoryVotes.set(categoryHint, (entry.categoryVotes.get(categoryHint) ?? 0) + 1);
  }
  acc.set(key, entry);
}

function topCategory(votes: Map<string, number>): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [category, count] of votes) {
    if (count > bestCount) {
      best = category;
      bestCount = count;
    }
  }
  return best;
}

/**
 * dedup된 원문 신호를 토큰화해 후보 키워드 랭킹을 만든다.
 * 서로 다른 소스 타입(급등검색어/태그/제목/댓글)에 걸쳐 등장하는 후보에는
 * 교차 출처 가산점을 준다 — 한 소스에서만 우연히 반복된 표현과 구분하기 위함.
 */
export function rankKeywords(signals: RawSignal[], { limit = 30 } = {}): RankedKeyword[] {
  const acc: Accumulator = new Map();

  for (const signal of signals) {
    for (const token of new Set(tokenize(signal.text))) {
      addToken(acc, token, signal.weight, signal.source, signal.sample, signal.categoryHint);
    }
  }

  return [...acc.entries()]
    .map(([term, entry]) => {
      const crossSourceBonus = entry.sourceTypes.size >= 2 ? 1.25 : 1;
      return {
        term,
        score: Math.round(entry.score * crossSourceBonus),
        mentions: entry.mentions,
        sourceTypes: [...entry.sourceTypes],
        sample: entry.sample,
        categoryHint: topCategory(entry.categoryVotes),
      };
    })
    .filter((keyword) => keyword.mentions >= 2 || keyword.sourceTypes.includes("trending_search"))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
