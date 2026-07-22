import type { Metadata } from "next";

import { categories } from "@/lib/trend-data";
import { getDocList } from "@/lib/docs";

import AppNav from "./app-nav";
import CommandPalette from "./command-palette";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrendDrop",
  description: "SNS 기반 트렌드 탐색 웹앱 프로토타입",
};

// 첫 페인트 전에 저장된 테마를 적용해 FOUC(테마 깜빡임)를 막는다.
const themeScript = `try{var t=localStorage.getItem('td-theme');if(t==='warm'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // filePath는 클라이언트로 내보내지 않는다.
  const paletteDocs = getDocList().map(({ slug, title, description }) => ({
    slug,
    title,
    description,
  }));

  return (
    <html lang="ko" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AppNav />
        {children}
        {/* getDocList()는 fs를 쓰는 서버 전용이라 여기서 호출해 props로 내려준다. */}
        <CommandPalette docs={paletteDocs} categories={categories} />
      </body>
    </html>
  );
}
