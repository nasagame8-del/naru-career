import { describe, expect, it } from "vitest";
import {
  isSortId,
  recommendedSlugOrder,
  sortArticles,
  sortByNewest,
  sortByPopularity,
  sortByRecommended,
  SORT_OPTIONS,
} from "./article-sort";
import type { ArticleMeta } from "./articles";

/** テストに必要な項目だけ持つ最小の記事 */
function article(slug: string, datePublished: string, category: ArticleMeta["category"] = "業界解説") {
  return { slug, datePublished, category } as ArticleMeta;
}

const A = article("a-old", "2026-01-01");
const B = article("b-mid", "2026-05-05");
const C = article("c-new", "2026-09-09");
const SAME_1 = article("x-same", "2026-05-05");
const SAME_2 = article("y-same", "2026-05-05");

describe("SORT_OPTIONS / isSortId", () => {
  it("3つの並び順を提供する", () => {
    expect(SORT_OPTIONS.map((o) => o.id)).toEqual(["newest", "popular", "recommended"]);
  });

  it("ラベルが日本語で用意されている", () => {
    expect(SORT_OPTIONS.map((o) => o.label)).toEqual(["新しい順", "人気順", "おすすめ順"]);
  });

  it("isSortId は既知のidのみ通す", () => {
    expect(isSortId("newest")).toBe(true);
    expect(isSortId("popular")).toBe(true);
    expect(isSortId("recommended")).toBe(true);
    expect(isSortId("random")).toBe(false);
  });
});

describe("sortByNewest", () => {
  it("公開日の降順に並べる", () => {
    expect(sortByNewest([A, C, B]).map((a) => a.slug)).toEqual(["c-new", "b-mid", "a-old"]);
  });

  it("同じ公開日は slug の昇順で安定させる", () => {
    expect(sortByNewest([SAME_2, SAME_1]).map((a) => a.slug)).toEqual(["x-same", "y-same"]);
  });

  it("元の配列を壊さない", () => {
    const input = [A, C, B];
    sortByNewest(input);
    expect(input.map((a) => a.slug)).toEqual(["a-old", "c-new", "b-mid"]);
  });
});

describe("sortByPopularity", () => {
  it("スナップショットの順に並べる", () => {
    const order = ["b-mid", "c-new", "a-old"];
    expect(sortByPopularity([A, B, C], order).map((a) => a.slug)).toEqual([
      "b-mid",
      "c-new",
      "a-old",
    ]);
  });

  it("スナップショットに無い記事は後ろへ新しい順で続ける", () => {
    // b だけ順位がある。残りは新しい順（c → a）
    expect(sortByPopularity([A, B, C], ["b-mid"]).map((a) => a.slug)).toEqual([
      "b-mid",
      "c-new",
      "a-old",
    ]);
  });

  it("順位不明の記事を勝手に上位へ混ぜない", () => {
    const result = sortByPopularity([A, B, C], ["a-old"]);
    // 先頭は必ず順位のある a-old
    expect(result[0].slug).toBe("a-old");
  });

  it("スナップショットが空なら実質新しい順になる", () => {
    expect(sortByPopularity([A, B, C], []).map((a) => a.slug)).toEqual([
      "c-new",
      "b-mid",
      "a-old",
    ]);
  });

  it("スナップショットに存在しないslugが含まれていても壊れない", () => {
    const order = ["deleted-article", "c-new"];
    expect(sortByPopularity([A, B, C], order).map((a) => a.slug)).toEqual([
      "c-new",
      "b-mid",
      "a-old",
    ]);
  });

  it("重複したslugは最初の順位を使う", () => {
    const order = ["c-new", "a-old", "c-new"];
    expect(sortByPopularity([A, B, C], order).map((a) => a.slug)).toEqual([
      "c-new",
      "a-old",
      "b-mid",
    ]);
  });
});

describe("recommendedSlugOrder", () => {
  it("カテゴリ定義の readingOrder を連結して返す", () => {
    const order = recommendedSlugOrder();
    expect(order.length).toBeGreaterThan(0);
    // 実データ: 体験談の先頭が全体の先頭になる
    expect(order[0]).toBe("second-new-grad-it-career-change");
  });

  it("重複を含まない", () => {
    const order = recommendedSlugOrder();
    expect(new Set(order).size).toBe(order.length);
  });
});

describe("sortByRecommended", () => {
  it("指定された推奨順を優先する", () => {
    const order = ["c-new", "a-old"];
    expect(sortByRecommended([A, B, C], order).map((a) => a.slug)).toEqual([
      "c-new",
      "a-old",
      "b-mid",
    ]);
  });

  it("推奨順に無い記事は後ろへ新しい順で続ける", () => {
    const order = ["a-old"];
    expect(sortByRecommended([A, B, C], order).map((a) => a.slug)).toEqual([
      "a-old",
      "c-new",
      "b-mid",
    ]);
  });

  it("既定では実データの readingOrder を使う", () => {
    const real = article("second-new-grad-it-career-change", "2020-01-01");
    const result = sortByRecommended([C, real]);
    // 公開日が古くても readingOrder の先頭なので先に出る
    expect(result[0].slug).toBe("second-new-grad-it-career-change");
  });
});

describe("sortArticles", () => {
  it("newest を適用する", () => {
    expect(sortArticles([A, C, B], "newest").map((a) => a.slug)).toEqual([
      "c-new",
      "b-mid",
      "a-old",
    ]);
  });

  it("popular を適用する", () => {
    expect(
      sortArticles([A, B, C], "popular", { popularityOrder: ["a-old"] }).map((a) => a.slug)
    ).toEqual(["a-old", "c-new", "b-mid"]);
  });

  it("recommended を適用する", () => {
    expect(
      sortArticles([A, B, C], "recommended", { recommendedOrder: ["b-mid"] }).map((a) => a.slug)
    ).toEqual(["b-mid", "c-new", "a-old"]);
  });

  it("popularityOrder 未指定の popular は新しい順へ退避する", () => {
    expect(sortArticles([A, B, C], "popular").map((a) => a.slug)).toEqual([
      "c-new",
      "b-mid",
      "a-old",
    ]);
  });

  it("どの並び順でも件数は変わらない", () => {
    for (const id of ["newest", "popular", "recommended"] as const) {
      expect(sortArticles([A, B, C], id, { popularityOrder: ["b-mid"] })).toHaveLength(3);
    }
  });

  it("どの並び順でも同じ記事集合を返す", () => {
    const base = [A, B, C].map((a) => a.slug).sort();
    for (const id of ["newest", "popular", "recommended"] as const) {
      const got = sortArticles([A, B, C], id, { popularityOrder: ["b-mid"] })
        .map((a) => a.slug)
        .sort();
      expect(got).toEqual(base);
    }
  });
});
