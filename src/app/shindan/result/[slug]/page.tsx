import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TYPES16, SLUG_TO_ID, ALL_SLUGS } from "../../_lib/data";
import ResultContent from "../../_components/ResultContent";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return ALL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const id = SLUG_TO_ID[slug];
  if (id === undefined) return {};
  const t = TYPES16[id];

  return {
    title: `${t.name} | RPG適職診断`,
    description: t.desc,
    // 診断直後に見せるUX専用ページ。検索向けの正規ページは /types/{slug}
    robots: { index: false, follow: true },
    alternates: {
      canonical: `/shindan/result/${slug}`,
    },
    openGraph: {
      title: `${t.name} | RPG適職診断`,
      description: t.desc,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${t.name} | RPG適職診断`,
      description: t.desc,
    },
  };
}

export default async function ResultPage({ params }: Props) {
  const { slug } = await params;
  const id = SLUG_TO_ID[slug];
  if (id === undefined) notFound();
  const typeInfo = TYPES16[id];

  return (
    <section id="result-screen" className="screen rpg-direct-result">
      <Image className="rpg-backdrop" src="/shindan/rpg/world.webp" alt="" fill sizes="100vw" preload unoptimized />
      <header className="rpg-header"><Link href="/" className="rpg-brand">NARU</Link><Link href="/shindan">診断トップ</Link></header>
      <ResultContent typeId={id} typeInfo={typeInfo} />
    </section>
  );
}
