import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  description:
    "The EduMall Career Intelligence Platform for assessment administration, delivery and reporting.",
  title: {
    default: "The EduMall Career Intelligence",
    template: "%s | The EduMall Career Intelligence",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
