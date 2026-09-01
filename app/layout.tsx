import type { Metadata } from "next";
import "./globals.css";
import "./quick-filter.css";

export const metadata: Metadata = {
  title: "Entertainment Performance Dashboard",
  description: "Executive dashboard for daily cross-platform content performance, engagement and TV ratings.",
  openGraph: { title: "Entertainment Performance Dashboard", description: "Cross-platform views, engagement and TV rating intelligence.", images: ["/og.png"] },
  twitter: { card: "summary_large_image", title: "Entertainment Performance Dashboard", description: "Cross-platform views, engagement and TV rating intelligence.", images: ["/og.png"] },
  other: { "codex-preview": "development" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
