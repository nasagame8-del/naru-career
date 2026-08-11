import type { Metadata } from "next";
import "./shindan.css";

export const metadata: Metadata = {
  title: "RPG適職診断 | あなたの冒険者タイプは？",
  description:
    "10の質問に答えて、あなたにぴったりの適職タイプを16種類のRPGキャラクターから診断します。",
  openGraph: {
    title: "RPG適職診断 | あなたの冒険者タイプは？",
    description:
      "10の質問に答えて、あなたにぴったりの適職タイプを16種類のRPGキャラクターから診断します。",
    type: "website",
  },
};

export default function ShindanLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="shindan-wrapper">{children}</div>;
}
