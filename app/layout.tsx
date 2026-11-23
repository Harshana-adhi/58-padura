import type { Metadata } from "next";
import { Inter, Noto_Sans_Sinhala } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const notoSansSinhala = Noto_Sans_Sinhala({
  variable: "--font-sinhala",
  subsets: ["sinhala"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "58 පැදුර",
  description: "58 පැදුර — live event programme",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="si"
      className={`${inter.variable} ${notoSansSinhala.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-stage text-stage-foreground">{children}</body>
    </html>
  );
}
