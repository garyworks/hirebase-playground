import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Hirebase｜功能測試",
  description:
    "以繁體中文操作職位搜尋、公司資料、市場趨勢、薪酬及招聘歷程功能。",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
