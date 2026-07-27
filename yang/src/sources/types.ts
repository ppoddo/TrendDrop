/**
 * 6개 소스 어댑터의 공통 타입 + HTML/fetch 유틸.
 * 각 어댑터는 collect(): Promise<RawItem[]> 를 export 한다.
 */

export type SourceName =
  | "dcbest"
  | "theqoo"
  | "instiz"
  | "youtube"
  | "gtrends"
  | "natepann";
export type Unit = "title" | "comment";

export interface RawItem {
  source: SourceName;
  unit: Unit;
  text: string;
  meta?: Record<string, unknown>;
}

export interface SourceAdapter {
  name: SourceName;
  collect: () => Promise<RawItem[]>;
}

export const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** 최소 HTML 엔티티 디코딩. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** 태그 제거 + 엔티티 디코딩 + 공백 정리. */
export function clean(raw: string): string {
  return decodeEntities(raw.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** UA/Referer를 달아 텍스트를 받는다. 실패 시 예외. */
export async function fetchText(url: string, referer?: string): Promise<string> {
  const headers: Record<string, string> = { "User-Agent": BROWSER_UA };
  if (referer) headers["Referer"] = referer;
  const res = await fetch(url, { headers });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}\n${body.slice(0, 200)}`);
  }
  return body;
}
