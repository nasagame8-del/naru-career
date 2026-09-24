#!/usr/bin/env node

/**
 * 記事の公開前QAをローカルPCだけで実行する。
 *
 * OpenAI API・外部APIを一切呼ばない。
 * 使うのは Node + 既存依存（sharp / gray-matter）と、
 * 同じリポジトリ内の npm スクリプト（test / tsc / build）だけ。
 *
 *   npm run article:local-qa -- --slug <slug>
 *
 * 全チェックの結果を PASS / FAIL で一覧表示し、
 * FAIL が1件でもあれば exit code 1 を返す。
 *
 * 重い工程（test / tsc / build）は --skip-heavy で省略できる。
 * 画像だけ確認したいときに便利だが、既定では実行する。
 */

import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import matter from "gray-matter";

import { IMAGE_SLOTS, articleImageName } from "./prepare-article-images.mjs";

const ROOT = process.cwd();
const ARTICLES_DIR = path.join(ROOT, "content", "articles");
const IMAGES_DIR = path.join(ROOT, "public", "images", "articles");

/** 記事本文に埋め込む3枚（cardはOG用で本文には出さない） */
const BODY_SLOTS = ["01", "02", "03"];

/** frontmatter の必須キー（既存記事37本すべてが持つもの） */
const REQUIRED_FRONTMATTER = [
  "title",
  "category",
  "keyword",
  "datePublished",
  "dateModified",
  "excerpt",
  "summary",
  "faq",
  "cta_agents",
  "note_published",
];

const KNOWN_CATEGORIES = ["業界解説", "体験談", "エージェント比較"];

// ── 結果の収集 ──

class Report {
  constructor() {
    this.rows = [];
  }

  add(step, name, ok, detail = "") {
    this.rows.push({ step, name, ok, detail });
    return ok;
  }

  get failed() {
    return this.rows.some((r) => !r.ok);
  }

  print() {
    const width = Math.max(...this.rows.map((r) => r.name.length));
    console.log("");
    console.log("─".repeat(width + 30));
    for (const r of this.rows) {
      const mark = r.ok ? "PASS" : "FAIL";
      console.log(
        `${String(r.step).padStart(2)}. [${mark}] ${r.name.padEnd(width)}  ${r.detail}`
      );
    }
    console.log("─".repeat(width + 30));
    const failCount = this.rows.filter((r) => !r.ok).length;
    console.log(
      failCount === 0
        ? `すべて PASS（${this.rows.length} 項目）`
        : `FAIL ${failCount} 件 / 全 ${this.rows.length} 項目`
    );
  }
}

// ── 補助 ──

export function parseArgs(argv) {
  const out = { slug: null, skipHeavy: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--slug") out.slug = argv[++i] ?? null;
    else if (a.startsWith("--slug=")) out.slug = a.slice("--slug=".length);
    else if (a === "--skip-heavy") out.skipHeavy = true;
  }
  return out;
}

export function isValidSlug(slug) {
  return typeof slug === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** 本文から画像参照（alt, src）を抽出する */
export function extractImageRefs(body) {
  const out = [];
  const re = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    out.push({ alt: m[1], src: m[2] });
  }
  return out;
}

/** 本文から内部リンク（/で始まるもの）を抽出する。画像参照は除く */
export function extractInternalLinks(body) {
  const withoutImages = body.replace(/!\[[^\]]*\]\([^)\s]+\)/g, " ");
  const out = new Set();
  const re = /\[[^\]]*\]\((\/[^)\s]*)\)/g;
  let m;
  while ((m = re.exec(withoutImages)) !== null) {
    out.add(m[1].split(/[?#]/)[0]);
  }
  return [...out];
}

/** リポジトリ内に実在するサイト内パスの集合を作る（ネットワークを使わない） */
async function collectKnownPaths() {
  const paths = new Set([
    "/",
    "/about",
    "/glossary",
    "/shindan",
    "/agent-diagnosis",
    "/ai-interview-check",
    "/contact",
    "/privacy",
    "/members/resume-template",
    "/guides/second-new-grad-complete-guide",
  ]);

  // 記事
  for (const f of await fs.readdir(ARTICLES_DIR)) {
    if (f.endsWith(".md") && !f.endsWith("-note.md")) {
      paths.add(`/articles/${f.replace(/\.md$/, "")}`);
    }
  }

  // カテゴリ（src/lib/categories から実キーを読む）
  try {
    const src = await fs.readFile(path.join(ROOT, "src", "lib", "categories.ts"), "utf8");
    for (const m of src.matchAll(/^\s*"?([a-z0-9-]+)"?\s*:\s*\{/gm)) {
      paths.add(`/category/${m[1]}`);
    }
  } catch {
    /* categories が読めない場合はカテゴリ検証を行わない */
  }

  // 診断結果・タイプ
  for (const dir of ["shindan/result", "types"]) {
    const p = path.join(ROOT, "src", "app", dir);
    if (await exists(p)) {
      // 動的ルートのため個別slugは検証対象にしない
      paths.add(`/${dir}`);
    }
  }

  return paths;
}

/** npm スクリプトを実行し、成否だけを返す */
function runCommand(label, command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let tail = "";
    const capture = (chunk) => {
      tail = (tail + chunk.toString()).slice(-4000);
    };
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);
    child.on("error", (e) => resolve({ ok: false, detail: e.message.slice(0, 120), tail }));
    child.on("close", (code) => {
      resolve({ ok: code === 0, detail: `exit ${code}`, tail });
    });
    void label;
  });
}

// ── 本体 ──

export async function runLocalQa({ slug, skipHeavy = false, report = new Report() }) {
  // 1. 記事の存在確認
  const mdPath = path.join(ARTICLES_DIR, `${slug}.md`);
  const mdExists = await exists(mdPath);
  report.add(1, "記事Markdownの存在", mdExists, mdExists ? path.relative(ROOT, mdPath) : `見つかりません: ${path.relative(ROOT, mdPath)}`);

  let raw = "";
  let parsed = null;
  if (mdExists) {
    raw = await fs.readFile(mdPath, "utf8");
    try {
      parsed = matter(raw);
    } catch (e) {
      parsed = null;
      report.add(1.1, "frontmatterの解析", false, e.message.slice(0, 120));
    }
  }

  // 2. 画像4枚の存在確認
  const slots = Object.keys(IMAGE_SLOTS);
  const missing = [];
  const present = [];
  for (const slot of slots) {
    const file = path.join(IMAGES_DIR, articleImageName(slug, slot));
    if (await exists(file)) present.push(slot);
    else missing.push(slot);
  }
  report.add(
    2,
    "画像4枚の存在（card/01/02/03）",
    missing.length === 0,
    missing.length === 0 ? `${present.length}枚` : `不足: ${missing.join(", ")}`
  );

  // 3〜5. サイズ / WebP / メタデータ
  const sizeIssues = [];
  const formatIssues = [];
  const metaIssues = [];
  for (const slot of present) {
    const file = path.join(IMAGES_DIR, articleImageName(slug, slot));
    const expect = IMAGE_SLOTS[slot];
    try {
      const meta = await sharp(file).metadata();
      if (meta.width !== expect.width || meta.height !== expect.height) {
        sizeIssues.push(`${slot}=${meta.width}x${meta.height}(期待${expect.width}x${expect.height})`);
      }
      if (meta.format !== "webp") formatIssues.push(`${slot}=${meta.format}`);
      const forbidden = ["exif", "xmp", "iptc", "icc", "comments"].filter(
        (k) => meta[k] != null
      );
      if (forbidden.length > 0) metaIssues.push(`${slot}:${forbidden.join("/")}`);
    } catch (e) {
      formatIssues.push(`${slot}=読み込み失敗(${e.message.slice(0, 40)})`);
    }
  }
  report.add(
    3,
    "画像サイズ（card 1200x630 / 本文 1200x675）",
    sizeIssues.length === 0 && missing.length === 0,
    sizeIssues.length === 0 ? (missing.length === 0 ? "全枚一致" : "画像不足のため未検証") : sizeIssues.join(" ")
  );
  report.add(
    4,
    "WebP形式",
    formatIssues.length === 0 && missing.length === 0,
    formatIssues.length === 0 ? (missing.length === 0 ? "全枚webp" : "画像不足のため未検証") : formatIssues.join(" ")
  );
  report.add(
    5,
    "メタデータ除去（EXIF/XMP/IPTC/ICC/コメント）",
    metaIssues.length === 0 && missing.length === 0,
    metaIssues.length === 0 ? (missing.length === 0 ? "残存なし" : "画像不足のため未検証") : metaIssues.join(" ")
  );

  // 6. Markdown内の画像参照と実ファイルの一致
  const refs = parsed ? extractImageRefs(parsed.content) : [];
  const refProblems = [];
  for (const r of refs) {
    if (!r.src.startsWith("/images/")) {
      refProblems.push(`外部/不正参照: ${r.src.slice(0, 60)}`);
      continue;
    }
    const abs = path.join(ROOT, "public", r.src.replace(/^\//, ""));
    if (!(await exists(abs))) refProblems.push(`実ファイルなし: ${r.src}`);
  }
  // 本文3枚が参照されているか
  const referenced = new Set(refs.map((r) => r.src));
  const notEmbedded = BODY_SLOTS.filter(
    (slot) => !referenced.has(`/images/articles/${articleImageName(slug, slot)}`)
  );
  if (notEmbedded.length > 0) {
    refProblems.push(`本文へ未埋め込み: ${notEmbedded.join(", ")}`);
  }
  report.add(
    6,
    "画像参照と実ファイルの一致",
    refProblems.length === 0 && mdExists,
    refProblems.length === 0 ? `参照 ${refs.length} 件すべて一致` : refProblems.join(" / ")
  );

  // 7. alt 欠落確認
  const altMissing = refs.filter((r) => r.alt.trim() === "").map((r) => r.src);
  report.add(
    7,
    "alt属性の欠落",
    altMissing.length === 0,
    altMissing.length === 0 ? `alt欠落なし（${refs.length}件）` : `alt空: ${altMissing.join(", ")}`
  );

  // 8. frontmatter 構文・必須キー
  const fmProblems = [];
  if (parsed) {
    const fm = parsed.data ?? {};
    for (const k of REQUIRED_FRONTMATTER) {
      if (!(k in fm)) fmProblems.push(`欠落:${k}`);
    }
    if (fm.category && !KNOWN_CATEGORIES.includes(fm.category)) {
      fmProblems.push(`未知のcategory:${fm.category}`);
    }
    for (const dk of ["datePublished", "dateModified"]) {
      const v = fm[dk];
      const s = v instanceof Date ? v.toISOString().slice(0, 10) : v;
      if (v !== undefined && !(typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s))) {
        fmProblems.push(`${dk}の形式`);
      }
    }
    if (fm.summary !== undefined && (!Array.isArray(fm.summary) || fm.summary.length === 0)) {
      fmProblems.push("summaryが空");
    }
    if (fm.faq !== undefined) {
      if (!Array.isArray(fm.faq)) fmProblems.push("faqが配列でない");
      else if (
        fm.faq.some(
          (f) => !f || typeof f.question !== "string" || typeof f.answer !== "string"
        )
      ) {
        fmProblems.push("faqのquestion/answer不備");
      }
    }
  } else {
    fmProblems.push("frontmatterを解析できません");
  }
  report.add(
    8,
    "frontmatter構文・必須キー",
    fmProblems.length === 0,
    fmProblems.length === 0 ? "必須キー・形式OK" : fmProblems.join(" / ")
  );

  // 9. 内部リンクのローカル存在確認
  const links = parsed ? extractInternalLinks(parsed.content) : [];
  const known = await collectKnownPaths();
  const broken = links.filter((l) => {
    if (known.has(l)) return false;
    // 動的ルート配下は個別slugを検証しない
    return !/^\/(shindan\/result|types)\//.test(l);
  });
  report.add(
    9,
    "内部リンクの実在（ローカル判定）",
    broken.length === 0,
    broken.length === 0 ? `リンク ${links.length} 件すべて実在` : `不明: ${broken.join(", ")}`
  );

  // 10〜12. 重い検証
  if (skipHeavy) {
    report.add(10, "npm test", true, "--skip-heavy によりスキップ");
    report.add(11, "npx tsc --noEmit", true, "--skip-heavy によりスキップ");
    report.add(12, "npm run build", true, "--skip-heavy によりスキップ");
  } else {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    const npx = process.platform === "win32" ? "npx.cmd" : "npx";

    const t = await runCommand("test", npm, ["test"]);
    report.add(10, "npm test", t.ok, t.detail);

    const tc = await runCommand("tsc", npx, ["tsc", "--noEmit"]);
    report.add(11, "npx tsc --noEmit", tc.ok, tc.detail);

    const b = await runCommand("build", npm, ["run", "build"]);
    report.add(12, "npm run build", b.ok, b.detail);
  }

  return report;
}

// ── CLI ──

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { slug, skipHeavy } = parseArgs(process.argv.slice(2));

  if (!slug) {
    console.error("使い方: npm run article:local-qa -- --slug <slug> [--skip-heavy]");
    process.exit(1);
  }
  if (!isValidSlug(slug)) {
    console.error("slugは英小文字・数字・ハイフンのみ指定できます");
    process.exit(1);
  }

  console.log(`記事ローカルQA: ${slug}${skipHeavy ? "（重い検証はスキップ）" : ""}`);
  console.log("OpenAI APIや外部APIは使用しません。");

  const report = await runLocalQa({ slug, skipHeavy });
  report.print();

  if (report.failed) {
    console.log("");
    console.log("FAIL があるため公開前提の確認は通っていません。");
    process.exit(1);
  }
  console.log("");
  console.log("画面内のAIロゴ・透かし・文字崩れ、本文と画像の整合は別途目視で確認してください。");
  process.exit(0);
}
