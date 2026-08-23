import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  description:
    "Career assessment and Career Intelligence for school students, college learners, professionals and skilled workers, with structured CareerFit insights and counsellor-guided direction.",
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
