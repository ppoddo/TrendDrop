/**
 * 네이트판 오늘의 톡 랭킹 — HTML 스크래핑. (10~30대 여성 비중 높은 사연·이슈)
 * 랭킹 페이지 한 장에 글 제목(50) + 베플(베스트 댓글, 25)이 같이 옴.
 *  - 제목: <h2><a href="/talk/숫자" ...>제목</a></h2>
 *  - 베플: <a href="/talk/숫자/reply/숫자" ...>댓글(랭킹 페이지에선 말줄임)</a>  → 구어체 신호
 * UTF-8 페이지라 표준 fetch 디코딩으로 충분(별도 인코딩 처리 불필요).
 */
import { clean, fetchText, type RawItem, type SourceAdapter } from "./types.js";

const URL = "https://pann.nate.com/talk/ranking";
const TITLE_RE = /<h2><a href="\/talk\/\d+"[^>]*>([^<]+)<\/a><\/h2>/g;
const REPLY_RE = /<a href="\/talk\/\d+\/reply\/\d+"[^>]*>([^<]+)<\/a>/g;

async function collect(): Promise<RawItem[]> {
  const html = await fetchText(URL, "https://pann.nate.com/");
  const out: RawItem[] = [];

  let m: RegExpExecArray | null;
  while ((m = TITLE_RE.exec(html)) !== null) {
    const text = clean(m[1]);
    if (text) out.push({ source: "natepann", unit: "title", text });
  }
  while ((m = REPLY_RE.exec(html)) !== null) {
    const text = clean(m[1]);
    if (text) out.push({ source: "natepann", unit: "comment", text });
  }
  return out;
}

export const natepann: SourceAdapter = { name: "natepann", collect };
