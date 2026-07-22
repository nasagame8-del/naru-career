import type { Metadata } from "next";
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
    <section id="result-screen" className="screen" style={{ position: "fixed" }}>
      <ResultContent typeId={id} typeInfo={typeInfo} />
    </section>
  );
}
