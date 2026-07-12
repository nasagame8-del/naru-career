export const CATEGORIES = {
  taiken: {
    name: "体験談" as const,
    label: "体験談",
    description:
      "24歳・転職1回の実体験をベースにした、第二新卒のIT/Web転職の体験談記事一覧。転職を決意した理由から内定獲得までのリアルな記録を掲載。",
  },
  "agent-comparison": {
    name: "エージェント比較" as const,
    label: "エージェント比較",
    description:
      "doda・ワークポート等の転職エージェントを第二新卒が実際に利用した比較記事一覧。各サービスの良い点・注意点をリアルに解説。",
  },
  "industry-guide": {
    name: "業界解説" as const,
    label: "業界解説",
    description:
      "IT/Web業界・AIO対策業界の仕組みや職種を、未経験者向けにわかりやすく解説する記事一覧。",
  },
} as const;

export type CategorySlug = keyof typeof CATEGORIES;

export function isValidCategorySlug(slug: string): slug is CategorySlug {
  return slug in CATEGORIES;
}
