/** 더쿠 핫게시판 제목. HTML 스크래핑. (여초 팬덤) */
import { clean, fetchText, type RawItem, type SourceAdapter } from "./types.js";

const URL = "https://theqoo.net/hot";
// '모든 공지 확인하기' 이후가 실제 글 목록. 그 앞은 공지/이벤트라 스킵.
const NOTICE_DIVIDER = "모든 공지 확인하기";
const ITEM_RE = /<td class="title">\s*<a href="\/hot\/\d+">([^<]+)<\/a>/g;

async function collect(): Promise<RawItem[]> {
  const html = await fetchText(URL, "https://theqoo.net/");
  const idx = html.indexOf(NOTICE_DIVIDER);
  const body = idx >= 0 ? html.slice(idx + NOTICE_DIVIDER.length) : html;

  const out: RawItem[] = [];
  let m: RegExpExecArray | null;
  while ((m = ITEM_RE.exec(body)) !== null) {
    const text = clean(m[1]);
    if (text) out.push({ source: "theqoo", unit: "title", text });
  }
  return out;
}

export const theqoo: SourceAdapter = { name: "theqoo", collect };
