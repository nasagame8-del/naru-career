import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TYPES16, TYPE_COLORS, SLUG_TO_ID, ALL_SLUGS } from "../../_lib/data";
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
  const accentColor = TYPE_COLORS[id] || "#b06a1c";

  return (
    <div className="result-framed" style={{ "--accent": accentColor } as React.CSSProperties}>
      <div className="result-frame-card">
        {/* Frame decoration image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="result-frame-card-img"
          src={`/shindan/frames/${slug}.png`}
          alt=""
          aria-hidden="true"
        />

        {/* Character card — fixed in upper portion, does NOT scroll */}
        <div className="result-frame-char">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/shindan/types/type${id}.png`}
            alt={typeInfo.name}
          />
        </div>

        {/* Scrollable text content — below character */}
        <div className="result-frame-card-content">
          <ResultContent typeId={id} typeInfo={typeInfo} />
        </div>
      </div>
    </div>
  );
}
