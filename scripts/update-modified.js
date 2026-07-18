/**
 * 記事の dateModified 更新スクリプト
 *
 * 記事本文（content/articles/*.md）を編集したら、その記事のフロントマター
 * `dateModified` を編集日（今日・JST）に揃えるためのヘルパー。
 * サイト側は dateModified を JSON-LD（Article.dateModified）・OGP modifiedTime・
 * sitemap の lastModified・記事の「更新日」表示に使うため、編集のたびに更新する必要がある。
 *
 * 使い方:
 *   node scripts/update-modified.js <slug> [<slug> ...]  # 指定slugを今日の日付に更新
 *   node scripts/update-modified.js --changed            # gitで変更中の記事を自動検出して更新
 *   node scripts/update-modified.js --changed --dry-run  # 変更せず対象だけ表示
 *
 * 注意:
 *   - datePublished は変更しない（公開日は不変）。
 *   - dateModified 行が無い記事にはフロントマター末尾へ追記する。
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ARTICLES_DIR = path.join(__dirname, "..", "content", "articles");

// JST（Asia/Tokyo）の YYYY-MM-DD を返す
function todayJST() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  const d = parts.find((p) => p.type === "day").value;
  return `${y}-${m}-${d}`;
}

// git で変更中（staged/unstaged/untracked）の記事slugを検出
function changedSlugs() {
  let out = "";
  try {
    out = execSync("git status --porcelain -- content/articles", {
      cwd: path.join(__dirname, ".."),
      encoding: "utf-8",
    });
  } catch (e) {
    console.error("git status の実行に失敗しました:", e.message);
    process.exit(1);
  }
  const slugs = new Set();
  for (const line of out.split("\n")) {
    const m = line.match(/content\/articles\/([^/]+)\.md$/);
    if (m && !m[1].endsWith("-note")) slugs.add(m[1]);
  }
  return [...slugs];
}

function updateOne(slug, today, dryRun) {
  const filePath = path.join(ARTICLES_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠ ${slug}: ファイルが見つかりません（スキップ）`);
    return false;
  }
  const content = fs.readFileSync(filePath, "utf-8");
  const current = content.match(/^dateModified:\s*"?(\d{4}-\d{2}-\d{2})"?/m);

  if (current && current[1] === today) {
    console.log(`= ${slug}: 既に ${today}（変更なし）`);
    return false;
  }

  if (dryRun) {
    console.log(`→ ${slug}: ${current ? current[1] : "(なし)"} → ${today}（dry-run）`);
    return false;
  }

  let updated;
  if (current) {
    updated = content.replace(
      /^dateModified:\s*"?\d{4}-\d{2}-\d{2}"?/m,
      `dateModified: "${today}"`
    );
  } else {
    // dateModified 行が無い場合、datePublished の直後に挿入（無ければ先頭フロントマターに追記）
    if (/^datePublished:.*$/m.test(content)) {
      updated = content.replace(
        /^(datePublished:.*)$/m,
        `$1\ndateModified: "${today}"`
      );
    } else {
      console.warn(`⚠ ${slug}: datePublished が無く挿入位置を特定できません（スキップ）`);
      return false;
    }
  }
  fs.writeFileSync(filePath, updated, "utf-8");
  console.log(`✓ ${slug}: ${current ? current[1] : "(なし)"} → ${today}`);
  return true;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const useChanged = args.includes("--changed");
  const explicit = args.filter((a) => !a.startsWith("--"));

  const today = todayJST();
  let slugs = explicit;
  if (useChanged) slugs = [...new Set([...slugs, ...changedSlugs()])];

  if (slugs.length === 0) {
    console.log("対象がありません。slug を指定するか --changed を付けてください。");
    console.log("例: node scripts/update-modified.js resume-writing-second-new-grad");
    return;
  }

  console.log(`基準日(JST): ${today} / 対象: ${slugs.length}件\n`);
  let count = 0;
  for (const slug of slugs) {
    if (updateOne(slug, today, dryRun)) count++;
  }
  console.log(`\n更新: ${count}件${dryRun ? "（dry-run のため未書き込み）" : ""}`);
}

main();
