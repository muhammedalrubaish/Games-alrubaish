import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false
};

export const metadata: Metadata = {
  title: "لعبة الجاسوس | Spyfall بالعربي",
  description: "النسخة العربية الأصلية من لعبة التخمين والتحقيق الشهيرة سباي فول (Spyfall) بأماكن وأدوار عربية ممتعة",
  keywords: ["Spyfall", "الجاسوس", "لعبة جماعية", "ألعاب ذكاء", "ألعاب عربية"],
  authors: [{ name: "فريق تطوير الجاسوس" }]
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
