import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TapTask",
  description: "Mobile-first coding prompt launcher."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
