import type { FAQ, ArticleMeta } from "@/lib/articles";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://naru-career.com";

const authorPerson = {
  "@type": "Person",
  name: "磯貝アルト",
  alternateName: "アルト",
  url: `${baseUrl}/about`,
  image: `${baseUrl}/images/author-avatar.webp`,
  jobTitle: "AIO対策企業・営業職 / 転職メディア運営",
  description:
    "第二新卒で飲食業界からIT/Web業界へ転職。AIO対策企業で人材紹介・人材派遣会社を中心にSEO・AIO領域の法人営業を担当。転職メディア「NARU」を個人運営。",
  sameAs: [
    "https://x.com/AIAlto2026",
    "https://note.com/altogenerative20",
  ],
};

export function ArticleJsonLd({ article }: { article: ArticleMeta }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    datePublished: article.datePublished,
    dateModified: article.dateModified || article.datePublished,
    author: authorPerson,
    publisher: {
      "@type": "Organization",
      name: "NARU",
      url: baseUrl,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${baseUrl}/articles/${article.slug}`,
    },
    description: article.excerpt,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function FAQJsonLd({ faqs }: { faqs: FAQ[] }) {
  if (faqs.length === 0) return null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; href: string }[];
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${baseUrl}${item.href}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function PersonJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    ...authorPerson,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function WebSiteJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "NARU",
    url: baseUrl,
    description:
      "第二新卒のIT/Web転職ガイド。著者・磯貝アルトの実体験をベースに、転職エージェント比較・業界解説・体験談を掲載。",
    author: authorPerson,
    publisher: {
      "@type": "Organization",
      name: "NARU",
      url: baseUrl,
      founder: authorPerson,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
