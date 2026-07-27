# trend-collector

## 프로젝트 목적 (최종 목표)

**"지금 어느 연령대에서 무엇이 유행인지"를 보여주는 웹앱.**

네이버 실시간 검색어처럼, **아는 사람만 아는 트렌드 단어("슬랑이" 같은 신조어·은어)**를 잡아서
- 연령대별로 필터링해 보여주고
- 그게 무슨 뜻인지 **설명까지** 제공한다.

이 저장소(`trend-collector`)는 그 앱의 **데이터 수집 파이프라인** 부분이다.
(화면/웹앱은 별도. 참고로 `~/TrendDrop`은 같은 목표의 Next.js 앱 프로토타입.)

**발굴 타깃**: 10대·20대 유행어 (`찐찐막`, `마운자로`, `대신쉬었음` 류). 뉴스·방송이 아니라 커뮤니티·댓글에서 자라는 말.
> 주의: "10·20 유행어를 노린다"는 **발굴 텍스처**(어떤 결의 단어를 찾나)일 뿐, 단어마다 연령대를 붙여 필터링하는 **기능은 아직 없다**(축 2, 아래).

## 목표를 3개 축으로 분해

1. **무엇이 유행인가 (발굴)** — 트렌드 키워드를 찾아낸다. ← **현재 목표(1차). 여기만 함.**
2. **어느 연령대인가 (필터)** — 단어별 연령대 분류·필터. ← **현재 범위에 없음.** 1차(발굴)가 안정화된 뒤에 "어떻게 필터링할지"를 설계한다. 소스 자체(인스티즈=10·20 여성 등)·디시 `[XX갤]` 태그가 나중에 프록시 힌트가 될 수 있음.
3. **그게 뭔지 (설명)** — 키워드 의미 설명. ← 나중 (LLM 생성 예정).

## 현재 아키텍처

**6개 소스의 원문(제목·댓글)을 1시간 버킷으로 `raw_items` 테이블에 축적**하는 단계.
launchd로 **매시간 자동 실행 중**. 추출(LLM)·트렌드 판정(z-score)·편집은 데이터가 며칠 쌓인 뒤 착수.

| 소스 | 방식 | 결 |
|---|---|---|
| 디시 실베 (`dcbest`) | HTML 스크래핑 | 남초 20~40 |
| 더쿠 핫 (`theqoo`) | HTML 스크래핑 | 여초 팬덤 20~30 |
| 인스티즈 pt (`instiz`) | HTML 스크래핑 | 10~20 여성 |
| 네이트판 톡 (`natepann`) | HTML 스크래핑 | 사연·이슈, 10~30 여성 비중 (제목+베플) |
| 유튜브 (`youtube`) | **YouTube Data API v3** | 일반인 전연령 (안정 기둥) |
| Google Trends (`gtrends`) | **공식 RSS** | 뉴스·대중화 신호 (안정 기둥) |

→ 스크래핑 4 + 공식 소스 2. 소스별 수집 상세는 **`COLLECTION.md`** 참고.

### 기술 스택
- **런타임**: Node 22 (nvm) + TypeScript, `tsx` 실행. ESM (`type: module`).
- **DB**: SQLite (`trend.db`, WAL) + Drizzle ORM. 스키마 `src/db/schema.ts`, 생성 `src/db/index.ts`의 `ensureSchema()`.
- **HTTP**: 표준 `fetch` (브라우저 UA + Referer). 외부 스크래핑 라이브러리 없음, 정규식 파싱.

### 실행 명령
```bash
npm run sources    # ★ 6소스 수집 → raw_items 축적 + logs/sources.log 기록 (launchd가 매시간 자동 호출)
npm run report     # 버킷별·소스별 수집 내역 조회 (npm run report -- 3 = 최근 3버킷)
npm run db:generate / db:push   # drizzle 스키마
```

### 자동 실행 (launchd)
- **`~/Library/LaunchAgents/com.trendcollector.sources.plist`** — 매시간 정각(:00) `scripts/run-sources.sh` 호출. 로드 시 즉시 1회도 실행(`RunAtLoad`).
- **`scripts/run-sources.sh`** — nvm node 경로(`v22.12.0`) PATH 주입 후 `npm run sources`. node 버전 올리면 이 경로도 갱신.
- 로그: 실행 내역 `logs/cron.log`, launchd 자체 stdout/stderr `logs/launchd.{out,err}.log`.
- 제어: `launchctl bootstrap gui/$(id -u) <plist>` 로드 / `launchctl bootout gui/$(id -u)/com.trendcollector.sources` 해제 / `launchctl list | grep trend` 확인.
- 한계: launchd는 **맥이 켜져 있을 때만** 실행. 진짜 24시간 수집엔 클라우드 필요(나중).

### 코드 구조
```
src/
  config.ts              # env (YOUTUBE_API_KEY 등)
  db/{schema,index}.ts   # raw_items 정의 + ensureSchema
  util/time.ts           # hourBucket (1시간 floor)
  sources/               # 소스 어댑터 6개 + 공통 types.ts
    {dcbest,theqoo,instiz,natepann,youtube,gtrends}.ts
  jobs/
    collect-sources.ts   # npm run sources
    report.ts            # npm run report
scripts/
  run-sources.sh         # launchd가 매시간 호출하는 래퍼
```

### 라이브 테이블
- **`raw_items`** ★ — 유일한 활성 테이블. 6소스 원문 스냅샷 (`source, unit, text, text_hash, meta(JSON), bucket_at, collected_at`). `(source, text_hash, bucket_at)` UNIQUE.
- 옛 파이프라인 테이블(`videos`, `comments`, `keyword_mentions`, `trends`, `trend_terms`, `channel_lead`)은 **스키마 코드에서 제거됨**(`schema.ts`/`ensureSchema`가 더는 정의·생성 안 함). 기존 `trend.db` 파일엔 아직 물리적으로 남아있음 → 지우려면 별도 DROP 마이그레이션.

## 작업 규칙
- 감으로 판단하지 말고 **실제 데이터/코드로 검증**한다 (이 프로젝트에서 반복적으로 유효했던 방식).
- 설계 변경 시 "왜 이 소스인가 / 이 소스가 무엇을 못 잡는가"를 먼저 따진다.
- **데이터가 지지하는 만큼만 주장한다** (예: "실시간" 아님 → "시간별 트렌드").

## 문서 지도
- **CLAUDE.md** (이 파일) — 목적·기술·아키텍처 요약. "무엇을 만드는가."
- **HANDOFF.md** — 변천사·설계 결정·다음 할 일. "어떻게 여기까지 왔고 뭘 할 차례인가."
- **COLLECTION.md** — 소스별 수집 방식·데이터 형식·전체 flow. "데이터가 어떻게 들어오는가."
