import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  description: "Engineering foundation status for The EduMall Career Intelligence Platform.",
  title: "EduMall Career Intelligence",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
