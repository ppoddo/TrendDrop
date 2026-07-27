/** 디시인사이드 실시간 베스트(실베) 제목. HTML 스크래핑. */
import { clean, fetchText, type RawItem, type SourceAdapter } from "./types.js";

const URL = "https://gall.dcinside.com/board/lists/?id=dcbest";
// 실제 글 앵커: <a href="/board/view/?id=dcbest&no=..." view-msg ="">제목</a>
const ITEM_RE =
  /<a\s+href="\/board\/view\/\?id=dcbest[^"]*"\s+view-msg\s*=""[^>]*>([\s\S]*?)<\/a>/g;

/** 제목 앞의 [XX갤] 출처 태그를 뽑아 meta로. (관심사/연령 프록시) */
function galleryTag(title: string): string | undefined {
  const m = title.match(/^\s*\[([^\]]+)\]/);
  return m ? m[1] : undefined;
}

async function collect(): Promise<RawItem[]> {
  const html = await fetchText(URL, "https://www.dcinside.com/");
  const out: RawItem[] = [];
  let m: RegExpExecArray | null;
  while ((m = ITEM_RE.exec(html)) !== null) {
    const text = clean(m[1]);
    if (!text || /^\d+$/.test(text)) continue;
    if (text.includes("갤러리 이용 안내")) continue; // 공지 스킵
    const gallery = galleryTag(text);
    out.push({ source: "dcbest", unit: "title", text, meta: gallery ? { gallery } : undefined });
  }
  return out;
}

export const dcbest: SourceAdapter = { name: "dcbest", collect };
