import fs from "node:fs/promises";
import path from "node:path";

export type DocEntry = {
  slug: string;
  title: string;
  description: string;
  filePath: string;
};

export const docs: DocEntry[] = [
  {
    slug: "ui-feature-roadmap",
    title: "UI/UX 기능 로드맵",
    description: "다크 애널리틱스 확정 이후 완료된 작업과 남은 TODO, 바이럴/공유 플랜을 정리한 문서",
    filePath: "ui-feature-roadmap.md",
  },
  {
    slug: "trend-services-research",
    title: "트렌드 서비스 조사",
    description: "해외/국내 사례, 차별점, MVP 우선순위를 정리한 리서치 문서",
    filePath: "trend-services-research.md",
  },
  {
    slug: "google-api-research",
    title: "Google API 조사",
    description: "TrendDrop에 맞는 Google 계열 API 후보, 쿼터, 트래픽, 리스크를 정리한 문서",
    filePath: "google-api-research.md",
  },
  {
    slug: "tiktok-api-research",
    title: "TikTok API 조사",
    description: "TikTok 공식/서드파티 API의 접근 가능성, 트렌드 데이터 경로, 비용과 리스크를 정리한 문서",
    filePath: "tiktok-api-research.md",
  },
  {
    slug: "prior-research-review",
    title: "사전조사 리뷰",
    description: "이전 작업자의 조사 방식에 대한 리뷰 — 잘한 점, 공백, 다음 조사 우선순위 제안",
    filePath: "prior-research-review.md",
  },
  {
    slug: "naver-api-research",
    title: "Naver API 조사",
    description: "네이버 데이터랩/검색광고/검색 API의 트렌드 활용 가능성, 쿼터, 약관 리스크를 정리한 문서",
    filePath: "naver-api-research.md",
  },
  {
    slug: "kakao-bigkinds-research",
    title: "Kakao/BigKinds 조사",
    description: "카카오 계열 데이터 소스와 빅카인즈 Open API의 접근 가능성, 뉴스 맥락 대안을 정리한 문서",
    filePath: "kakao-bigkinds-research.md",
  },
];

const docsDir = path.join(process.cwd(), "docs");

export function getDocList() {
  return docs;
}

export function getDocBySlug(slug: string) {
  return docs.find((entry) => entry.slug === slug) ?? null;
}

export async function readDocContent(slug: string) {
  const doc = getDocBySlug(slug);

  if (!doc) {
    return null;
  }

  const fullPath = path.join(docsDir, doc.filePath);
  const content = await fs.readFile(fullPath, "utf8");

  return {
    ...doc,
    content,
  };
}

