/**
 * 検索クエリのテーマ分類
 * ルールベースのキーワードマッチングでクエリをカテゴリ分け
 */

export interface ThemeRule {
  id: string;
  label: string;
  keywords: string[];
}

export const QUERY_THEMES: ThemeRule[] = [
  { id: "daini", label: "第二新卒", keywords: ["第二新卒"] },
  { id: "it_web", label: "IT/Web", keywords: ["IT", "Web", "SEO", "AIO", "SES", "エンジニア"] },
  { id: "agent", label: "エージェント", keywords: ["エージェント", "転職サイト", "doda", "マイナビ", "ワークポート", "ビズリーチ"] },
  { id: "quit", label: "退職・仕事の悩み", keywords: ["退職", "辞めたい", "評価", "昇進", "辞める"] },
  { id: "resume", label: "書類・面接", keywords: ["職務経歴書", "履歴書", "面接", "志望動機"] },
  { id: "other", label: "その他", keywords: [] },
];

export function classifyQuery(query: string): string {
  const q = query.toLowerCase();
  for (const theme of QUERY_THEMES) {
    if (theme.id === "other") continue;
    if (theme.keywords.some(kw => q.includes(kw.toLowerCase()))) return theme.id;
  }
  return "other";
}
