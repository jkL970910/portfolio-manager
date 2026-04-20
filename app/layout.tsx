import type { Metadata } from "next";
import { Nunito_Sans } from "next/font/google";
import { buildMetadataCopy } from "@/lib/i18n/ui";
import { getRequestDisplayLanguage } from "@/lib/i18n/server";
import "./globals.css";

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-nunito-sans",
  weight: ["300", "400", "500", "600", "700", "800"]
});

export async function generateMetadata(): Promise<Metadata> {
  const language = await getRequestDisplayLanguage();
  const copy = buildMetadataCopy(language);
  return {
    title: copy.title,
    description: copy.description
  };
}

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const language = await getRequestDisplayLanguage();

  return (
    <html lang={language === "zh" ? "zh-CN" : "en"}>
      <body className={`${nunitoSans.variable} font-[family:var(--font-nunito-sans)] antialiased`}>
        {children}
      </body>
    </html>
  );
}
