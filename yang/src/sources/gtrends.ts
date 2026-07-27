/**
 * Google Trends 한국 급상승 검색어 — 공식 RSS.
 * 5번째 후보 소스이자, 뉴스/대중화 신호. RSS라 스크래핑 붕괴에서 자유로운 안정 기둥.
 * (기존 jobs/trending.ts 와 같은 피드. 여기선 raw_items 형식으로 통합 수집.)
 */
import { clean, fetchText, type RawItem, type SourceAdapter } from "./types.js";

const RSS_URL = "https://trends.google.com/trending/rss?geo=KR";

function extractTag(block: string, tag: string): string | undefined {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? clean(m[1]) : undefined;
}

function extractAll(block: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    const t = clean(m[1]);
    if (t) out.push(t);
  }
  return out;
}

async function collect(): Promise<RawItem[]> {
  const xml = await fetchText(RSS_URL);
  const out: RawItem[] = [];
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  let rank = 0;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const keyword = extractTag(block, "title");
    if (!keyword) continue;
    rank += 1;
    out.push({
      source: "gtrends",
      unit: "title",
      text: keyword,
      meta: {
        rank,
        approxTraffic: extractTag(block, "ht:approx_traffic") ?? "-",
        newsTitles: extractAll(block, "ht:news_item_title"),
      },
    });
  }
  return out;
}

export const gtrends: SourceAdapter = { name: "gtrends", collect };
