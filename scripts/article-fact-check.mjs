#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const ROOT = process.cwd();
const ARTICLES_DIR = path.join(ROOT, "content", "articles");

const BLOCKER_PATTERNS = [
  { name: "EXPERIENCE placeholder", re: /\[EXPERIENCE:[^\]]*\]/gi },
  { name: "FACTCHECK placeholder", re: /\[FACTCHECK:[^\]]*\]/gi },
  { name: "SOURCE placeholder", re: /\[SOURCE:[^\]]*\]/gi },
  { name: "TODO placeholder", re: /\[(?:TODO|TBD|要確認)[^\]]*\]/gi },
];

const REVIEW_PATTERNS = [
  {
    name: "数字・割合・金額・年次",
    re: /(?:\b(?:19|20)\d{2}\b|[0-9０-９][0-9０-９,，.．]*\s*(?:%|％|円|万円|億円|人|社|件|倍|割|年|ヶ月|か月|カ月))/g,
  },
  {
    name: "法制度・規制",
    re: /(?:法律|法令|改正|施行|義務|禁止|違法|合法|厚生労働省|経済産業省|公正取引委員会|制度|規程|手数料)/g,
  },
  {
    name: "時系列・トレンド",
    re: /(?:増えている|増加|急増|拡大|高まっている|減少|最多|最大級|業界最大|圧倒的|一般的|多くの企業|ほとんど|主流|普及している)/g,
  },
  {
    name: "断定・推奨",
    re: /(?:必ず|絶対|一切|全員|誰でも|正解|ベスト|最も|おすすめ|使うべき|必須|問題ありません|間違いありません)/g,
  },
  {
    name: "転職サービス・採用条件",
    re: /(?:求人数|未経験可|年収|無料|サポート|内定|採用率|書類通過|面接通過|非公開求人)/g,
  },
];

function lineNumberAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

function collectMatches(text, patterns) {
  const out = [];
  for (const p of patterns) {
    p.re.lastIndex = 0;
    let m;
    while ((m = p.re.exec(text)) !== null) {
      out.push({
        type: p.name,
        match: m[0],
        line: lineNumberAt(text, m.index),
      });
      if (m.index === p.re.lastIndex) p.re.lastIndex++;
    }
  }
  return out;
}

function surfaceText(parsed) {
  const fm = parsed.data ?? {};
  const blocks = [
    ["title", fm.title],
    ["excerpt", fm.excerpt],
    ["summary", Array.isArray(fm.summary) ? fm.summary.join("\n") : fm.summary],
    ["faq", Array.isArray(fm.faq) ? fm.faq.map((x) => `${x?.question ?? ""}\n${x?.answer ?? ""}`).join("\n") : ""],
    ["naruPoint", fm.naruPoint],
    ["body", parsed.content],
  ];
  return blocks
    .filter(([, v]) => typeof v === "string" && v.trim())
    .map(([name, v]) => `## ${name}\n${v}`)
    .join("\n");
}

export function scanFactCheckTargets(raw) {
  const parsed = matter(raw);
  const text = surfaceText(parsed);
  return {
    blockers: collectMatches(text, BLOCKER_PATTERNS),
    reviewTargets: collectMatches(text, REVIEW_PATTERNS),
  };
}

function parseArgs(argv) {
  const out = { slug: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--slug") out.slug = argv[++i] ?? null;
    else if (a.startsWith("--slug=")) out.slug = a.slice("--slug=".length);
    else if (a === "--json") out.json = true;
  }
  return out;
}

async function main() {
  const { slug, json } = parseArgs(process.argv.slice(2));
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    console.error("使い方: npm run article:fact-check -- --slug <slug> [--json]");
    process.exit(1);
  }

  const file = path.join(ARTICLES_DIR, `${slug}.md`);
  const raw = await fs.readFile(file, "utf8");
  const result = scanFactCheckTargets(raw);

  if (json) {
    console.log(JSON.stringify({ slug, ...result }, null, 2));
  } else {
    console.log(`Fact Check Gate scan: ${slug}`);
    console.log(`blockers: ${result.blockers.length}`);
    for (const x of result.blockers) {
      console.log(`  BLOCK line ${x.line}: [${x.type}] ${x.match}`);
    }
    console.log(`manual review targets: ${result.reviewTargets.length}`);
    for (const x of result.reviewTargets.slice(0, 80)) {
      console.log(`  REVIEW line ${x.line}: [${x.type}] ${x.match}`);
    }
    if (result.reviewTargets.length > 80) {
      console.log(`  ...and ${result.reviewTargets.length - 80} more`);
    }
    console.log("");
    console.log("REVIEW は自動的に真偽判定しません。一次情報または著者実体験で人間が確認してください。");
    console.log("対象: title / excerpt / summary / FAQ / 本文 / 数値 / 法制度 / 時系列 / サービス情報 / 画像内テキスト / alt");
  }

  process.exit(result.blockers.length > 0 ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
