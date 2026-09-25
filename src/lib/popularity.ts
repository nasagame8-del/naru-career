/**
 * 人気順スナップショットの読み込み。
 *
 * 公開ページから Search Console API を呼ばないため、
 * `npm run data:popularity` で生成したスナップショットをビルド時に読む。
 *
 * **保存するのは順位（slugの並び）だけで、表示回数・クリック数は保存しない。**
 * このリポジトリは公開されているため、流入の実数値をコミットしない方針。
 */

import fs from "fs";
import path from "path";

export interface PopularitySnapshot {
  /** 生成時刻 ISO8601 */
  generatedAt: string;
  /** 集計期間（表示用。例 "過去28日"） */
  window: string;
  /** 人気の高い順に並んだ記事slug。数値は含めない */
  order: string[];
}

const SNAPSHOT_PATH = path.join(process.cwd(), "data", "popularity.json");

/**
 * スナップショットを読む。
 *
 * 未生成・壊れている場合は null を返す（ビルドを壊さない）。
 * 呼び出し側は null のとき「人気順」を出さない判断をする。
 */
export function readPopularitySnapshot(): PopularitySnapshot | null {
  try {
    if (!fs.existsSync(SNAPSHOT_PATH)) return null;
    const parsed: unknown = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf-8"));
    if (!parsed || typeof parsed !== "object") return null;

    const snapshot = parsed as Partial<PopularitySnapshot>;
    if (!Array.isArray(snapshot.order)) return null;

    const order = snapshot.order.filter(
      (slug): slug is string => typeof slug === "string" && slug.length > 0
    );
    if (order.length === 0) return null;

    return {
      generatedAt: typeof snapshot.generatedAt === "string" ? snapshot.generatedAt : "",
      window: typeof snapshot.window === "string" ? snapshot.window : "",
      order,
    };
  } catch {
    // 壊れたスナップショットで記事一覧を落とさない
    return null;
  }
}
