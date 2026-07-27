/**
 * 유튜브 인기 급상승 — 영상 제목 + 상위 댓글. 공식 Data API.
 * 커뮤니티가 못 잡는 "일반인 언어"(찐찐막·실환가 등)를 잡는 안정 기둥.
 */
import { config } from "../config.js";
import type { RawItem, SourceAdapter } from "./types.js";

const API = "https://www.googleapis.com/youtube/v3";
const VIDEO_COUNT = 20; // mostPopular 상위 N 영상
const COMMENT_VIDEOS = 8; // 댓글을 긁을 영상 수 (쿼터 절약)
const COMMENTS_PER_VIDEO = 15;

async function getJson(url: string): Promise<any> {
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) {
    throw new Error(`YouTube API: ${json.error.errors?.[0]?.reason ?? json.error.message}`);
  }
  return json;
}

async function collect(): Promise<RawItem[]> {
  const key = config.youtubeApiKey;
  const out: RawItem[] = [];

  // 1) 인기 급상승 영상 제목
  const vids = await getJson(
    `${API}/videos?part=snippet&chart=mostPopular&regionCode=${config.regionCode}` +
      `&maxResults=${VIDEO_COUNT}&key=${key}`
  );
  const items: any[] = vids.items ?? [];
  for (const it of items) {
    out.push({
      source: "youtube",
      unit: "title",
      text: it.snippet.title,
      meta: { videoId: it.id, kind: "video_title" },
    });
  }

  // 2) 상위 영상들의 인기 댓글 (댓글 꺼진 영상은 건너뜀)
  for (const it of items.slice(0, COMMENT_VIDEOS)) {
    try {
      const cj = await getJson(
        `${API}/commentThreads?part=snippet&videoId=${it.id}&order=relevance` +
          `&maxResults=${COMMENTS_PER_VIDEO}&key=${key}`
      );
      for (const c of cj.items ?? []) {
        const text: string = c.snippet.topLevelComment.snippet.textOriginal
          .replace(/\s+/g, " ")
          .trim();
        if (text) {
          out.push({ source: "youtube", unit: "comment", text, meta: { videoId: it.id } });
        }
      }
    } catch {
      // 댓글 비활성/오류 영상은 조용히 스킵
    }
  }

  return out;
}

export const youtube: SourceAdapter = { name: "youtube", collect };
