/**
 * 記事Markdownの組み立て。
 *
 * 既存37本のNARU記事と同じfrontmatter形式を保つことが唯一の目的。
 * 形式は content/articles/*.md を読んで決めており、
 * 勝手なキーの追加・削除は行わない。
 */

import type { ArticleDraft, ArticleFrontmatter, ResearchSource } from "./types";

/**
 * LLM が返却用の区切りタグまで本文へ含めた場合に、文書レベルの body
 * ラッパーだけを除去する。Markdown を <body> 内に置くと remark が全体を
 * HTML ブロックとして扱い、`##` が画面へ露出するため、保存直前にも正規化する。
 */
export function normalizeArticleBody(value: string): string {
  let body = value.replace(/\r\n/g, "\n").trim();
  const wrapped = body.match(/^<body(?:\s[^>]*)?>\s*([\s\S]*?)\s*<\/body>$/i);
  if (wrapped) body = wrapped[1].trim();
  return body;
}

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
  const body = normalizeArticleBody(draft.body);
  return `${serializeFrontmatter(draft.frontmatter)}\n\n${body}\n`;
}

const IMAGE_FALLBACK_HEADINGS = [
  "記事の要点を整理する",
  "比較・判断ポイントを整理する",
  "次に取る行動を整理する",
];

function imageHeadingScore(heading: string): number {
  const rules: [RegExp, number][] = [
    [/全体像|仕事内容|種類|仕組み|マップ/, 12],
    [/ロードマップ|手順|ステップ|流れ|スケジュール/, 11],
    [/チェック|見極め|選び方|注意|リスク|失敗/, 10],
    [/比較|違い|メリット|デメリット/, 9],
    [/準備|方法|対策|ポイント/, 7],
  ];
  return rules.reduce((score, [pattern, weight]) => score + (pattern.test(heading) ? weight : 0), 0);
}

/** 図解に向くH2を3件選び、足りない場合も記事全体用の題材で4枚構成を保つ。 */
export function selectImageHeadings(headings: string[]): string[] {
  const seen = new Set<string>();
  const candidates = headings
    .map((heading) => heading.trim())
    .filter(Boolean)
    .filter((heading) => !/^(結論|まとめ|よくある質問|FAQ|はじめに)/i.test(heading))
    .filter((heading) => {
      if (seen.has(heading)) return false;
      seen.add(heading);
      return true;
    })
    .map((heading, index) => ({ heading, index, score: imageHeadingScore(heading) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3)
    .sort((a, b) => a.index - b.index)
    .map(({ heading }) => heading);

  for (const fallback of IMAGE_FALLBACK_HEADINGS) {
    if (candidates.length >= 3) break;
    if (!candidates.includes(fallback)) candidates.push(fallback);
  }
  return candidates;
}

function imageComposition(heading: string): string {
  if (/全体像|仕事内容|種類|仕組み|マップ/.test(heading)) {
    return "中央の主題から関連項目へ広がる、シンプルな全体像マップ";
  }
  if (/ロードマップ|手順|ステップ|流れ|スケジュール/.test(heading)) {
    return "左から右へ進む、3〜5段階のロードマップまたはタイムライン";
  }
  if (/チェック|見極め|選び方|注意|リスク|失敗/.test(heading)) {
    return "確認項目を縦に整理したチェックリストまたは判断フロー";
  }
  if (/比較|違い|メリット|デメリット/.test(heading)) {
    return "左右2列で違いが分かる比較図。優劣を断定せず特徴を整理する";
  }
  return "要点を3〜5項目に分けた、カード型の解説図";
}

function pushPrompt(lines: string[], promptLines: string[]): void {
  lines.push("```text", ...promptLines, "```", "");
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
  const selectedHeadings = selectImageHeadings(opts.headings);
  const lines: string[] = [
    `# 画像プラン — ${opts.title}`,
    "",
    `- 記事ID: ${opts.articleId}`,
    `- slug: \`${opts.slug}\``,
    `- ソースファイル: \`content/articles/${opts.slug}.md\``,
    "",
    "## 運用ルール",
    "",
    "- 1記事につき**アイキャッチ1枚 + 本文画像3枚 = 計4枚**。",
    "- OpenAI Images APIなどの画像生成APIは呼ばない。",
    "- ユーザーはDriveの記事フォルダに保存された下記プロンプトで4枚を生成し、同フォルダのimages/へ置く。変換・PR反映・公開確認は担当エージェントが行う。",
    "- 日本語の誤字、見切れ、崩れ、実在ロゴ、本文にない数値があれば採用しない。",
    "- 承認前の画像は記事へ実装しない。既存画像も上書きしない。",
    "",
    "## 必要な画像",
    "",
    "| 位置 | 用途 | 推奨サイズ | 状態 |",
    "|---|---|---|---|",
    `| 記事一覧・記事上部 | \`${opts.slug}-card.webp\` | 1200x630 | 未生成 |`,
  ];

  for (const [index, heading] of selectedHeadings.entries()) {
    lines.push(
      `| H2「${heading}」の直後 | \`${opts.slug}-0${index + 1}.webp\` | 1200x675 | 未生成 |`
    );
  }

  lines.push(
    "",
    "## 画像1 — アイキャッチ",
    "",
    `- 保存名: \`${opts.slug}-card.webp\``,
    "- 配置: 記事一覧・記事上部・OG画像",
    ""
  );
  pushPrompt(lines, [
    "1200×630pxの横長。日本のキャリア系オウンドメディア「NARU」の記事アイキャッチ。",
    "",
    `記事テーマ：「${opts.title}」`,
    "",
    "記事テーマを一目で理解できる短い日本語の主コピーと、補助的な短いサブコピーを作る。記事タイトル全文を小さく詰め込まない。",
    "20代の第二新卒読者を想定した、編集記事らしいミニマルで上質なフラットイラスト。人物を描く場合は日本人男性1人、胸から上の自然なバストショット。",
    "メインカラーはティーングリーン #1F6F66 とアンバー #B5691B。背景は明るいクリーム。補助色はネイビーと淡いベージュ。",
    "人物は右、コピーは左を基本にする。重要要素は上下中央30%の帯へ集め、上端20%・下端20%と左右10%以上を安全マージンにする。",
    "小さく表示しても読める文字量と太さにする。日本語は正確に表示する。",
    "実在企業のロゴ、商標、社名、サービス名、細かいUI、透かし、本文にない数値は入れない。",
  ]);

  for (const [index, heading] of selectedHeadings.entries()) {
    lines.push(
      `## 画像${index + 2} — 本文図解${index + 1}`,
      "",
      `- 保存名: \`${opts.slug}-0${index + 1}.webp\``,
      `- 配置: H2「${heading}」の説明直後`,
      ""
    );
    pushPrompt(lines, [
      "1200×675px、16:9横長。日本のキャリア系オウンドメディア「NARU」の記事内図解。",
      "",
      `記事全体のテーマ：「${opts.title}」`,
      `今回図解するテーマ：「${heading}」`,
      "",
      `構成は「${imageComposition(heading)}」。`,
      "図だけで概要を理解できるよう、表示する日本語は短い見出しと要点に限定する。最大5項目程度。長文を入れない。",
      "編集記事向けのミニマルなフラット図解。背景は明るいクリーム。ティーングリーン #1F6F66を基本色、アンバー #B5691Bを強調色にする。",
      "アイキャッチとは異なる構図にし、3枚の本文画像も互いに同じ構図を繰り返さない。余白を広く取り、スマートフォンでも読める文字サイズにする。",
      "日本語は正確に表示する。実在企業のロゴ、商標、社名、サービス名、透かし、読めない文字は入れない。",
      "本文にない統計、金額、順位、制度、体験談を追加しない。比較の場合も一方を根拠なく優位・危険と断定しない。",
    ]);
  }

  lines.push(
    "## 生成後の実装手順",
    "",
    "1. 担当側がこのファイルをDriveの記事フォルダへimage-prompts.mdとして保存し、images/フォルダを用意してURLを通知する。ユーザーは上記4プロンプトで別々に生成した画像をimages/へ置く（ユーザー側はここまで）。",
    "2. 担当エージェントが文字・見切れ・ロゴ・透かし・事実関係を目視確認する。問題があれば公開を止め、理由を伝える。",
    `3. 担当エージェントが元画像を一時フォルダへ置き、\`npm run image:prepare:all -- ${opts.slug} <card画像> <01画像> <02画像> <03画像>\` で4枚を一括WebP化する。`,
    "4. コマンドがEXIF・XMP・ICCなどの埋め込みメタデータを削除し、`public/images/articles/` へ指定名で保存したことを確認する。元画像はGitへ追加しない。",
    "5. 本文画像3枚を指定H2の説明直後へ挿入し、内容を説明するaltを付ける。",
    "6. 記事単位のDriveフォルダへMarkdownと画像4枚を保存し、build・表示・モバイル・OG画像を確認してからPRを更新する。",
    "7. 新しいPR headのCI・Vercel Previewを確認し、公開時にもう一度ゲートを確認する。詳細はdocs/article-factory-two-touch.mdを参照。",
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
