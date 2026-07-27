/** 인스티즈 실시간 인기(pt) 제목. HTML 스크래핑. (10~20대 여성) */
import { clean, fetchText, type RawItem, type SourceAdapter } from "./types.js";

const URL = "https://www.instiz.net/pt";
const ITEM_RE = /class="post_title"[^>]*>([^<]+)</g;

/** pt 페이지엔 JS 템플릿 조각(' + item.subject + ')이 섞여 들어옴 → 제거. */
function isJunk(t: string): boolean {
  return (
    t.includes("item.") ||
    t.includes("goutdata") ||
    t.includes("subject") ||
    t.includes("+") ||
    t === "-" ||
    t === ""
  );
}

async function collect(): Promise<RawItem[]> {
  const html = await fetchText(URL, "https://www.instiz.net/");
  const out: RawItem[] = [];
  let m: RegExpExecArray | null;
  while ((m = ITEM_RE.exec(html)) !== null) {
    const text = clean(m[1]);
    if (isJunk(text)) continue;
    out.push({ source: "instiz", unit: "title", text });
  }
  return out;
}

export const instiz: SourceAdapter = { name: "instiz", collect };
