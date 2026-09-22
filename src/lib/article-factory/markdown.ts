/**
 * 記事Markdownの組み立て。
 *
 * 既存37本のNARU記事と同じfrontmatter形式を保つことが唯一の目的。
 * 形式は content/articles/*.md を読んで決めており、
 * 勝手なキーの追加・削除は行わない。
 */

import type { ArticleDraft, ArticleFrontmatter, ResearchSource } from "./types";

/** YAMLのダブルクォート文字列として安全にエスケープする */
function yamlString(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
  return `"${escaped}"`;
}

/**
 * frontmatter を既存記事と同じ順序・形式でシリアライズする。
 *
 * キー順は content/articles/*.md の実物に合わせている:
 *   title → category → keyword → datePublished → dateModified
 *   → naruPoint(任意) → excerpt → summary → faq → cta_agents → note_published
 */
export function serializeFrontmatter(fm: ArticleFrontmatter): string {
  const lines: string[] = ["---"];

  lines.push(`title: ${yamlString(fm.title)}`);
  lines.push(`category: ${yamlString(fm.category)}`);
  lines.push(`keyword: ${yamlString(fm.keyword)}`);
  lines.push(`datePublished: ${yamlString(fm.datePublished)}`);
  lines.push(`dateModified: ${yamlString(fm.dateModified)}`);

  if (fm.naruPoint && fm.naruPoint.trim() !== "") {
    lines.push(`naruPoint: ${yamlString(fm.naruPoint)}`);
  }

  lines.push(`excerpt: ${yamlString(fm.excerpt)}`);

  lines.push("summary:");
  for (const s of fm.summary) lines.push(`  - ${yamlString(s)}`);

  lines.push("faq:");
  for (const f of fm.faq) {
    lines.push(`  - question: ${yamlString(f.question)}`);
    lines.push(`    answer: ${yamlString(f.answer)}`);
  }

  if (fm.cta_agents.length === 0) {
    lines.push("cta_agents: []");
  } else {
    lines.push("cta_agents:");
    for (const a of fm.cta_agents) lines.push(`  - ${a}`);
  }

  lines.push(`note_published: ${fm.note_published}`);
  lines.push("---");

  return lines.join("\n");
}

/** frontmatter + 本文を1つのMarkdownにする */
export function buildArticleMarkdown(draft: ArticleDraft): string {
  const body = draft.body.replace(/\s+$/, "");
  return `${serializeFrontmatter(draft.frontmatter)}\n\n${body}\n`;
}

/**
 * Drive互換の image-plan.md を生成する。
 *
 * 画像そのものは生成しない。
 * 「どこに・どんな画像が必要か」だけを書き出し、
 * 承認済みの既存画像を人間が割り当てるための資料にする。
 */
export function buildImagePlan(opts: {
  slug: string;
  title: string;
  articleId: number;
  headings: string[];
  sources: ResearchSource[];
}): string {
  const lines: string[] = [
    `# 画像プラン — ${opts.title}`,
    "",
    `- 記事ID: ${opts.articleId}`,
    `- slug: \`${opts.slug}\``,
    `- ソースファイル: \`content/articles/${opts.slug}.md\``,
    "",
    "## 運用ルール",
    "",
    "- この計画では画像を自動生成しない。",
    "- 実装してよいのは**承認済みの既存画像のみ**。",
    "- 既存画像を上書きしない。新しい画像が必要な場合は人間が用意する。",
    "",
    "## 必要な画像",
    "",
    "| 位置 | 用途 | 推奨サイズ | 状態 |",
    "|---|---|---|---|",
    `| アイキャッチ | 記事サムネイル | 1200x630 | 未割当 |`,
  ];

  for (const h of opts.headings.slice(0, 6)) {
    lines.push(`| ${h} | 節の補助図 | 1200x675 | 未割当 |`);
  }

  lines.push(
    "",
    "## 割り当て手順",
    "",
    "1. `public/images/articles/` に使える既存画像があるか確認する。",
    "2. 使えるものがあれば、その相対パスを「状態」欄に記入する。",
    "3. 無い場合は「要新規作成」と記入し、人間が作成・承認するまで実装しない。",
    ""
  );

  if (opts.sources.length > 0) {
    lines.push("## 図解の根拠に使える出典", "");
    for (const s of opts.sources) {
      lines.push(`- [${s.title}](${s.url})（取得日 ${s.retrievedAt}）`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
