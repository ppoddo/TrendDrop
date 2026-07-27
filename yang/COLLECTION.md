# COLLECTION — 데이터 수집 flow

_최종 업데이트: 2026-07-22_

> 어떤 소스에서 / 무슨 데이터를 / 어떻게 긁어서 / 무슨 형식으로 저장하는지.
> 목적·결정 배경은 `CLAUDE.md`·`HANDOFF.md` 참고. 이 문서는 **메커니즘**만 다룬다.

## 전체 flow (한 장)

```
npm run sources                 (src/jobs/collect-sources.ts)
        │
        ├─ ensureSchema()       raw_items 테이블 보장
        │
        ├─ Promise.all([ 6개 어댑터 동시 실행 ])   ← 하나 실패해도 나머지 진행
        │     dcbest  theqoo  instiz  natepann  youtube  gtrends
        │        │       │       │        │        │        │
        │        └───────┴───────┴────────┴────────┴────────┘
        │                 각 어댑터 → RawItem[]
        │
        ├─ 각 RawItem 을 raw_items 에 INSERT
        │     - bucket_at = 이번 시각의 1시간 floor
        │     - text_hash = sha1(text)
        │     - onConflictDoNothing  ← 같은 (source, text_hash, bucket_at) 중복 무시
        │
        ├─ 콘솔: 소스별 수집/신규저장 요약
        └─ logs/sources.log: 버킷별·소스별 그룹 로그 append

npm run report [n]              (src/jobs/report.ts)
        └─ 최근 n개 버킷을 소스별로 나란히 출력 (기본 1)
```

- **수집 단위**: 1시간 버킷(`bucket_at`, UTC 정각 floor). 같은 버킷 안에서 여러 번 실행해도 중복은 안 쌓임.
- **저장 대상**: 지금은 **원문(제목·댓글)만**. 키워드 추출·z-score·점수화는 **아직 없음**(데이터 축적 후 별도 단계).

## RawItem — 공통 데이터 형식

모든 어댑터는 `RawItem[]`를 반환한다 (`src/sources/types.ts`).

```ts
interface RawItem {
  source: "dcbest" | "theqoo" | "instiz" | "youtube" | "gtrends" | "natepann";
  unit:   "title" | "comment";        // 제목인가 댓글인가
  text:   string;                     // 원문
  meta?:  Record<string, unknown>;    // 소스별 부가정보 (JSON으로 저장)
}
```

## raw_items 테이블 (저장 형식)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | INTEGER PK | 자동 증가 |
| `source` | TEXT | `dcbest`\|`theqoo`\|`instiz`\|`natepann`\|`youtube`\|`gtrends` |
| `unit` | TEXT | `title`\|`comment` |
| `text` | TEXT | 원문 (제목/댓글) |
| `text_hash` | TEXT | `sha1(text)` — 중복 판정용 |
| `meta` | TEXT | JSON 문자열 (소스별, 아래) |
| `bucket_at` | TEXT | 1시간 floor ISO (예: `2026-07-22T14:00:00.000Z`) |
| `collected_at` | TEXT | 실제 수집 시각 ISO |

- **UNIQUE(`source`, `text_hash`, `bucket_at`)** — 같은 버킷 내 동일 원문은 한 번만. 버킷이 바뀌면(다음 시간) 같은 글도 다시 저장됨 → "그 글이 몇 시간째 살아있나"를 시계열로 관찰 가능.

## 소스별 수집 상세

### 1. 디시 실베 (`dcbest`) — HTML 스크래핑
- **URL**: `https://gall.dcinside.com/board/lists/?id=dcbest` (실시간 베스트)
- **요청**: 브라우저 UA + `Referer: https://www.dcinside.com/`
- **파싱**: `<a href="/board/view/?id=dcbest&no=...">제목</a>` 앵커에서 제목 추출. 정규식.
- **필터**: "갤러리 이용 안내" 공지 스킵, 순수 숫자 스킵.
- **unit**: `title`. **meta**: `{ gallery }` — 제목 앞 `[XX갤]` 태그(관심사 프록시). 예: `[싱갤]`.
- **양**: ~50건/실행.
- **취약점**: 마크업 변경 시 정규식 깨짐. 봇 차단 강화 시 403 가능.

### 2. 더쿠 핫 (`theqoo`) — HTML 스크래핑
- **URL**: `https://theqoo.net/hot`
- **요청**: 브라우저 UA + `Referer: https://theqoo.net/`
- **파싱**: HTML을 `"모든 공지 확인하기"` 기준으로 자른 뒤, **그 이후**에서 `<td class="title"><a href="/hot/숫자">제목</a>` 추출. (앞부분은 공지/이벤트라 버림)
- **unit**: `title`. **meta**: 없음.
- **양**: ~20건/실행.
- **취약점**: 공지 구분자 문구·클래스명 변경 시 깨짐.

### 3. 인스티즈 pt (`instiz`) — HTML 스크래핑
- **URL**: `https://www.instiz.net/pt` (실시간 인기)
- **요청**: 브라우저 UA + `Referer: https://www.instiz.net/`
- **파싱**: `class="post_title">제목` 추출.
- **필터**: pt 페이지엔 JS 템플릿 조각(`' + item.subject + '` 등)이 섞여 옴 → `item.`/`goutdata`/`subject`/`+`/`-`/빈 문자열 제거.
- **unit**: `title`. **meta**: 없음.
- **양**: ~40건/실행.
- **취약점**: JS 렌더링 방식 바뀌면 필터·셀렉터 재조정 필요.

### 4. 네이트판 (`natepann`) — HTML 스크래핑
- **URL**: `https://pann.nate.com/talk/ranking` (오늘의 톡 랭킹)
- **요청**: 브라우저 UA + `Referer: https://pann.nate.com/`. 페이지 **UTF-8** → 표준 fetch 디코딩으로 충분(별도 인코딩 처리 없음).
- **파싱**: 한 페이지에서 두 종류를 뽑음.
  - **제목**: `<h2><a href="/talk/숫자" ...>제목</a></h2>` → **unit** `title`. (~50건)
  - **베플(베스트 댓글)**: `<a href="/talk/숫자/reply/숫자" ...>댓글</a>` → **unit** `comment`. (~25건, 랭킹 페이지라 텍스트가 말줄임될 수 있음)
- **meta**: 없음.
- **양**: ~75건/실행 (제목 50 + 베플 25).
- **역할**: 사연·이슈 텍스처. 베플은 유튜브 댓글처럼 구어체 신호. (커버리지가 더쿠와 일부 겹치나 사연글 결이 달라 추가)
- **취약점**: 마크업 변경 시 정규식 깨짐. 봇 차단 가능.

### 5. 유튜브 (`youtube`) — 공식 YouTube Data API v3
- **키**: `.env`의 `YOUTUBE_API_KEY`.
- **① 인기 급상승 영상 제목**:
  `videos.list?part=snippet&chart=mostPopular&regionCode=KR&maxResults=20`
  → 각 영상 제목. **unit**: `title`, **meta**: `{ videoId, kind: "video_title" }`.
- **② 상위 영상 인기 댓글**:
  상위 8개 영상에 대해 `commentThreads.list?part=snippet&videoId=...&order=relevance&maxResults=15`
  → 최상위 댓글 텍스트. **unit**: `comment`, **meta**: `{ videoId }`.
  - 댓글 비활성 영상(MV 등)은 조용히 스킵.
- **양**: ~140건/실행 (제목 20 + 댓글 ~120).
- **쿼터**: videos.list 1 + commentThreads 8 ≈ **9 units/실행** (일 10,000 한도 → 여유 큼).
- **취약점**: 거의 없음(공식 API). 신조어 수율은 커뮤니티보다 낮고 "일반인 언어"(`찐찐막·실환가`)를 담당.

### 6. Google Trends (`gtrends`) — 공식 RSS
- **URL**: `https://trends.google.com/trending/rss?geo=KR`
- **파싱**: RSS `<item>`의 `<title>`(키워드), `<ht:approx_traffic>`, `<ht:news_item_title>`(왜 떴나).
- **unit**: `title`. **meta**: `{ rank, approxTraffic, newsTitles[] }`.
- **양**: ~10건/실행.
- **역할**: 후보 소스 겸 **뉴스/대중화 신호**. 텍스처는 뉴스라 커뮤니티와 다름(의도된 것).
- **취약점**: 거의 없음(공식 RSS).

## 로그 & 조회

- **`logs/sources.log`** — 매 실행마다 append. 버킷 헤더 + 소스별 블록(제목/댓글 목록). "동일 시간대에 각 소스가 뭘 뱉었나"를 사람이 바로 읽는 용도.
- **`npm run report`** — DB에서 최근 버킷을 소스별로 나란히 출력. `npm run report -- 3` = 최근 3버킷.
- **직접 쿼리**:
  ```bash
  sqlite3 trend.db "SELECT source, unit, count(*) FROM raw_items GROUP BY source, unit ORDER BY source;"
  sqlite3 trend.db "SELECT bucket_at, count(*) FROM raw_items GROUP BY bucket_at ORDER BY bucket_at DESC LIMIT 5;"
  ```

## 실패 처리
- 어댑터는 각자 try/catch로 감싸 실행(`runAdapter`) → **한 소스가 죽어도 나머지는 정상 수집**.
- 실패한 소스는 콘솔·`logs/sources.log`에 `⚠️ 실패: <메시지>`로 남음 → 스크래핑 붕괴를 바로 감지.

## 아직 안 하는 것 (수집 이후 단계)
- 키워드 **추출**(LLM) — 제목·댓글에서 신조어 후보 + 추정 의미 뽑기.
- **z-score** — 소스별 baseline 대비 급증 판정 (데이터 며칠 필요).
- **교차출현 가산** → 후보 30개 → **LLM 편집 패스** → 카드 10장.
## 자동 실행 (launchd, 매시간)
- **`~/Library/LaunchAgents/com.trendcollector.sources.plist`** → 매시간 정각 `scripts/run-sources.sh` → `npm run sources`.
- `run-sources.sh`는 nvm node 경로를 PATH에 주입(launchd 최소 PATH 대응). 실행 로그 `logs/cron.log`.
- 로드: `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.trendcollector.sources.plist` / 확인: `launchctl list | grep trend`.
- 맥이 켜져 있을 때만 실행되는 한계 있음(진짜 24시간은 클라우드, 나중).
