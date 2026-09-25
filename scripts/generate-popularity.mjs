#!/usr/bin/env node

/**
 * Search Console から記事の人気順スナップショットを生成する。
 *
 *   npm run data:popularity
 *
 * 出力: data/popularity.json
 *
 * ## 保存する内容
 *
 * **順位（slugの並び）だけ**を保存し、表示回数・クリック数は保存しない。
 * このリポジトリは公開されているため、流入の実数値をコミットしない。
 *
 * ## 並び順の基準
 *
 * 過去28日のクリック数の降順。同数の場合は表示回数の降順、
 * さらに同数なら slug の昇順で安定させる。
 *
 * ## 必要な環境変数（値は出力しない）
 *
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 *   SEARCH_CONSOLE_SITE_URL
 *
 * 未設定なら何も書かずに終了する（既存スナップショットを壊さない）。
 */

import fs from "node:fs/promises";
import path from "node:path";

const OUT_PATH = path.join(process.cwd(), "data", "popularity.json");
const ARTICLES_DIR = path.join(process.cwd(), "content", "articles");
const WINDOW_LABEL = "過去28日";

/** UTC基準で n 日前の YYYY-MM-DD */
function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** /articles/<slug> のパスから slug を取り出す */
export function slugFromPage(pageUrl) {
  try {
    const pathname = pageUrl.startsWith("/") ? pageUrl : new URL(pageUrl).pathname;
    const m = pathname.match(/^\/articles\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * GSCの行から人気順のslug列を作る（純粋関数）。
 *
 * - 記事ページ以外の行は捨てる
 * - `knownSlugs` に無いslug（削除済み記事など）は捨てる
 * - clicks 降順 → impressions 降順 → slug 昇順
 */
export function buildOrder(rows, knownSlugs) {
  const byslug = new Map();

  for (const row of rows ?? []) {
    const page = row?.keys?.[0];
    if (!page) continue;
    const slug = slugFromPage(page);
    if (!slug || !knownSlugs.has(slug)) continue;

    const prev = byslug.get(slug) ?? { clicks: 0, impressions: 0 };
    byslug.set(slug, {
      clicks: prev.clicks + (row.clicks ?? 0),
      impressions: prev.impressions + (row.impressions ?? 0),
    });
  }

  return [...byslug.entries()]
    .sort((a, b) => {
      if (b[1].clicks !== a[1].clicks) return b[1].clicks - a[1].clicks;
      if (b[1].impressions !== a[1].impressions) {
        return b[1].impressions - a[1].impressions;
      }
      return a[0].localeCompare(b[0]);
    })
    .map(([slug]) => slug);
}

async function knownArticleSlugs() {
  const files = await fs.readdir(ARTICLES_DIR);
  return new Set(
    files
      .filter((f) => f.endsWith(".md") && !f.endsWith("-note.md"))
      .map((f) => f.replace(/\.md$/, ""))
  );
}

async function main() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const siteUrl = process.env.SEARCH_CONSOLE_SITE_URL;

  if (!email || !privateKey || !siteUrl) {
    console.error(
      "Search Console の環境変数が未設定です（GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY / SEARCH_CONSOLE_SITE_URL）。"
    );
    console.error("スナップショットは更新していません。");
    process.exit(1);
  }

  const { google } = await import("googleapis");
  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });

  // GSCのデータは数日遅れるため、3日前を終了日にする
  const endDate = daysAgo(-3);
  const startDate = daysAgo(-30);

  const searchconsole = google.searchconsole({ version: "v1", auth });
  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["page"],
      rowLimit: 500,
      type: "web",
    },
  });

  const known = await knownArticleSlugs();
  const order = buildOrder(res.data.rows ?? [], known);

  if (order.length === 0) {
    console.error(
      "記事ページの行が取得できませんでした。スナップショットは更新していません。"
    );
    process.exit(1);
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    window: WINDOW_LABEL,
    // 順位のみ。clicks / impressions は意図的に保存しない
    order,
  };

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(snapshot, null, 2) + "\n", "utf8");

  console.log(`data/popularity.json を更新しました（${order.length} 記事 / ${WINDOW_LABEL}）`);
  console.log("保存したのは順位のみで、表示回数・クリック数は含めていません。");
  console.log(`対象期間: ${startDate} 〜 ${endDate}`);
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

if (isDirectRun) {
  main().catch((error) => {
    // 資格情報がメッセージへ混入しないよう内容は絞って出す
    console.error(`取得に失敗しました: ${String(error?.message ?? error).slice(0, 200)}`);
    process.exit(1);
  });
}
