import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-ibm-plex-sans",
  weight: ["300", "400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: "Portfolio Manager",
  description: "Portfolio decision support platform with spending and recommendation workflows."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${ibmPlexSans.variable} font-[family:var(--font-ibm-plex-sans)] antialiased`}>
        {children}
      </body>
    </html>
  );
}
