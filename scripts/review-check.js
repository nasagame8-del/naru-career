/**
 * コンテンツ定期レビュー チェックスクリプト
 *
 * 公開（または前回レビュー）から一定期間が経過した記事をリストアップする。
 * 自動修正は一切行わない。レビュー対象の洗い出し（一覧表示）のみを行う。
 *
 * 使い方:
 *   node scripts/review-check.js            # 6ヶ月(既定)経過した記事を表示
 *   node scripts/review-check.js --months 3 # しきい値を3ヶ月に変更
 *   node scripts/review-check.js --json     # 結果をJSONで出力
 *
 * 判定基準:
 *   各記事の lastReviewDate（articles-status.json）を起点に、
 *   本日までの経過日数がしきい値（既定180日 ≒ 6ヶ月）を超えたものを対象とする。
 *   lastReviewDate が無い記事は datePublished（記事フロントマター）で補完する。
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const ARTICLES_DIR = path.join(__dirname, "..", "content", "articles");
const STATUS_PATH = path.join(DATA_DIR, "articles-status.json");

// 6ヶ月 ≒ 180日を既定のしきい値とする
const DEFAULT_THRESHOLD_MONTHS = 6;
const DAYS_PER_MONTH = 30;

function parseArgs(argv) {
  const opts = { months: DEFAULT_THRESHOLD_MONTHS, json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--months") {
      const val = Number(argv[++i]);
      if (!Number.isFinite(val) || val <= 0) {
        console.error(`--months には正の数値を指定してください（受け取った値: ${argv[i]}）`);
        process.exit(1);
      }
      opts.months = val;
    } else if (arg === "--json") {
      opts.json = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log("使い方: node scripts/review-check.js [--months <N>] [--json]");
      process.exit(0);
    }
  }
  return opts;
}

// 記事フロントマターから datePublished を取得（lastReviewDate 欠損時の補完用）
function getDatePublished(slug) {
  const filePath = path.join(ARTICLES_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, "utf-8");
  const m = content.match(/^datePublished:\s*"?(\d{4}-\d{2}-\d{2})"?/m);
  return m ? m[1] : null;
}

function daysBetween(fromDate, toDate) {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.floor((toDate.getTime() - fromDate.getTime()) / MS_PER_DAY);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(STATUS_PATH)) {
    console.error(`articles-status.json が見つかりません: ${STATUS_PATH}`);
    process.exit(1);
  }

  const thresholdDays = Math.round(opts.months * DAYS_PER_MONTH);
  const today = new Date();
  const data = JSON.parse(fs.readFileSync(STATUS_PATH, "utf-8"));

  const due = [];
  for (const article of data.articles) {
    const baseDate = article.lastReviewDate || getDatePublished(article.slug);
    if (!baseDate) {
      console.warn(`⚠ ${article.slug}: lastReviewDate も datePublished も取得できません（スキップ）`);
      continue;
    }
    const elapsedDays = daysBetween(new Date(baseDate), today);
    if (elapsedDays >= thresholdDays) {
      due.push({
        slug: article.slug,
        lastReviewDate: baseDate,
        elapsedDays,
        status: article.status,
      });
    }
  }

  // 経過日数が多い順（＝より古い記事が先頭）
  due.sort((a, b) => b.elapsedDays - a.elapsedDays);

  if (opts.json) {
    console.log(JSON.stringify(due, null, 2));
    return;
  }

  console.log(
    `\nレビュー対象チェック（しきい値: ${opts.months}ヶ月 = ${thresholdDays}日 / 基準日: ${today.toISOString().slice(0, 10)}）`
  );
  console.log("=".repeat(64));

  if (due.length === 0) {
    console.log("レビューが必要な記事はありません。すべて最新です。\n");
    return;
  }

  console.log(`レビューが必要な記事: ${due.length}件\n`);
  for (const item of due) {
    const months = (item.elapsedDays / DAYS_PER_MONTH).toFixed(1);
    console.log(
      `  • ${item.slug}\n` +
        `      前回レビュー: ${item.lastReviewDate} / 経過: ${item.elapsedDays}日（約${months}ヶ月） / status: ${item.status}`
    );
  }
  console.log("\n※ このスクリプトはリストアップのみを行います。記事の自動修正は行いません。\n");
}

main();
