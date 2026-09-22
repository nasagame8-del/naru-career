/**
 * 調査フェーズの純粋ロジックのテスト。
 *
 * 中心的な性質:
 *   「構文として正しいURL」は根拠ではない。
 *   実検索で引用が確認できたURLだけが出典になり、
 *   それ以外で支えられた時事的主張は unsupported に落ちる。
 */

import { describe, it, expect } from "vitest";
import {
  buildResearchResult,
  dedupeSources,
  isAuthoritativeUrl,
  normalizeSourceUrl,
  type VerifiedSource,
} from "./research";
import type { ResearchSource } from "./types";

// ── URL正規化 ──

describe("normalizeSourceUrl", () => {
  it("http/https を通す", () => {
    expect(normalizeSourceUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(normalizeSourceUrl("http://example.com/a")).toBe("http://example.com/a");
  });

  it("http/https 以外を拒否する", () => {
    expect(normalizeSourceUrl("ftp://example.com/a")).toBeNull();
    expect(normalizeSourceUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeSourceUrl("data:text/html,hi")).toBeNull();
  });

  it("URLとして壊れているものを拒否する", () => {
    expect(normalizeSourceUrl("not a url")).toBeNull();
    expect(normalizeSourceUrl("")).toBeNull();
    expect(normalizeSourceUrl("   ")).toBeNull();
  });

  it("ホスト名を小文字化し www. を落とす", () => {
    expect(normalizeSourceUrl("https://WWW.Example.COM/Path")).toBe(
      "https://example.com/Path"
    );
  });

  it("追跡パラメータを落とす", () => {
    expect(
      normalizeSourceUrl("https://example.com/a?utm_source=x&utm_medium=y&id=1&gclid=z")
    ).toBe("https://example.com/a?id=1");
  });

  it("クエリが全部消えたら ? を残さない", () => {
    expect(normalizeSourceUrl("https://example.com/a?utm_source=x")).toBe(
      "https://example.com/a"
    );
  });

  it("フラグメントを落とす", () => {
    expect(normalizeSourceUrl("https://example.com/a#section")).toBe("https://example.com/a");
  });

  it("末尾スラッシュを落とす（ルートは残す）", () => {
    expect(normalizeSourceUrl("https://example.com/a/")).toBe("https://example.com/a");
    expect(normalizeSourceUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("既定ポートを落とす", () => {
    expect(normalizeSourceUrl("https://example.com:443/a")).toBe("https://example.com/a");
    expect(normalizeSourceUrl("http://example.com:80/a")).toBe("http://example.com/a");
  });

  it("クエリの順序が違っても同じ正規形になる", () => {
    const a = normalizeSourceUrl("https://example.com/a?b=2&a=1");
    const b = normalizeSourceUrl("https://example.com/a?a=1&b=2");
    expect(a).toBe(b);
  });
});

describe("isAuthoritativeUrl", () => {
  it("日本の公的機関を一次情報とみなす", () => {
    expect(isAuthoritativeUrl("https://www.mhlw.go.jp/stf/x.html")).toBe(true);
    expect(isAuthoritativeUrl("https://www.e-stat.go.jp/x")).toBe(true);
    expect(isAuthoritativeUrl("https://example.lg.jp/x")).toBe(true);
  });

  it("一般サイトは一次情報としない", () => {
    expect(isAuthoritativeUrl("https://example.com/blog")).toBe(false);
    expect(isAuthoritativeUrl("https://note.com/someone")).toBe(false);
  });

  it("壊れたURLは false", () => {
    expect(isAuthoritativeUrl("nonsense")).toBe(false);
  });

  it("go.jp を含むだけの別ドメインを誤判定しない", () => {
    expect(isAuthoritativeUrl("https://go.jp.evil.com/x")).toBe(false);
  });
});

// ── 重複排除 ──

describe("dedupeSources", () => {
  function src(url: string, claims: string[], title = "T"): ResearchSource {
    return {
      title,
      url,
      retrievedAt: "2026-09-23",
      supportsClaims: claims,
      authoritative: false,
    };
  }

  it("正規化後に同じURLを1件へ畳み、主張を統合する", () => {
    const out = dedupeSources([
      src("https://example.com/a", ["claim1"]),
      src("https://www.example.com/a/", ["claim2"]),
      src("https://example.com/a?utm_source=x", ["claim1", "claim3"]),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe("https://example.com/a");
    expect(out[0].supportsClaims.sort()).toEqual(["claim1", "claim2", "claim3"]);
  });

  it("異なるURLは畳まない", () => {
    const out = dedupeSources([
      src("https://example.com/a", ["c"]),
      src("https://example.com/b", ["c"]),
    ]);
    expect(out).toHaveLength(2);
  });

  it("不正なURLの出典を落とす", () => {
    const out = dedupeSources([src("not-a-url", ["c"]), src("https://ok.com/x", ["c"])]);
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe("https://ok.com/x");
  });

  it("authoritative は OR で統合する", () => {
    const a = { ...src("https://mhlw.go.jp/x", ["c"]), authoritative: false };
    const b = { ...src("https://mhlw.go.jp/x", ["d"]), authoritative: true };
    const out = dedupeSources([a, b]);
    expect(out[0].authoritative).toBe(true);
  });
});

// ── 主張と出典の突き合わせ ──

describe("buildResearchResult", () => {
  const verified: VerifiedSource[] = [
    { title: "厚労省 統計", url: "https://mhlw.go.jp/stat", authoritative: true },
    { title: "公式ドキュメント", url: "https://example.com/docs", authoritative: false },
  ];

  it("検証済みURLで支えられた主張は出典付きになる", () => {
    const r = buildResearchResult({
      verified,
      claimMappings: [
        {
          claim: "2026年の有効求人倍率は1.3倍",
          sourceUrls: ["https://mhlw.go.jp/stat"],
          timeSensitive: true,
        },
      ],
      searchAvailable: true,
    });
    expect(r.unsupportedClaims).toHaveLength(0);
    expect(r.sources).toHaveLength(1);
    expect(r.sources[0].url).toBe("https://mhlw.go.jp/stat");
    expect(r.sources[0].supportsClaims).toContain("2026年の有効求人倍率は1.3倍");
    expect(r.sources[0].authoritative).toBe(true);
    expect(r.timeSensitiveClaims).toContain("2026年の有効求人倍率は1.3倍");
  });

  it("検証済み集合に無いURLは根拠として採用しない", () => {
    const r = buildResearchResult({
      verified,
      claimMappings: [
        {
          claim: "2026年の平均年収は500万円",
          // 構文としては正しいが、実検索で確認されていないURL
          sourceUrls: ["https://totally-made-up.example.org/report"],
          timeSensitive: true,
        },
      ],
      searchAvailable: true,
    });
    expect(r.sources).toHaveLength(0);
    expect(r.unsupportedClaims).toHaveLength(1);
    expect(r.unsupportedClaims[0]).toContain("実検索で確認できた出典がありません");
  });

  it("出典が無い時事的主張は unsupported になる", () => {
    const r = buildResearchResult({
      verified,
      claimMappings: [{ claim: "制度が変わった", sourceUrls: [], timeSensitive: true }],
      searchAvailable: true,
    });
    expect(r.unsupportedClaims).toHaveLength(1);
  });

  it("時事的でない主張は出典が無くても unsupported にしない", () => {
    const r = buildResearchResult({
      verified,
      claimMappings: [
        { claim: "職務経歴書は読み手を意識して書く", sourceUrls: [], timeSensitive: false },
      ],
      searchAvailable: true,
    });
    expect(r.unsupportedClaims).toHaveLength(0);
    expect(r.timeSensitiveClaims).toHaveLength(0);
  });

  it("検索が使えない場合、時事的主張はすべて unsupported になる", () => {
    const r = buildResearchResult({
      verified: [],
      claimMappings: [
        { claim: "2026年の制度はこうなった", sourceUrls: ["https://mhlw.go.jp/stat"], timeSensitive: true },
        { claim: "一般論", sourceUrls: [], timeSensitive: false },
      ],
      searchAvailable: false,
      unavailableReason: "Web検索が利用できません",
    });
    expect(r.sources).toHaveLength(0);
    expect(r.unsupportedClaims).toHaveLength(1);
    expect(r.unsupportedClaims[0]).toContain("Web検索が利用できません");
  });

  it("同じURLが複数の主張を支える場合は1件にまとめる", () => {
    const r = buildResearchResult({
      verified,
      claimMappings: [
        { claim: "主張A", sourceUrls: ["https://mhlw.go.jp/stat"], timeSensitive: true },
        { claim: "主張B", sourceUrls: ["https://mhlw.go.jp/stat"], timeSensitive: true },
      ],
      searchAvailable: true,
    });
    expect(r.sources).toHaveLength(1);
    expect(r.sources[0].supportsClaims.sort()).toEqual(["主張A", "主張B"]);
  });

  it("URL表記が揺れていても検証済みとして一致させる", () => {
    const r = buildResearchResult({
      verified: [{ title: "T", url: "https://example.com/docs", authoritative: false }],
      claimMappings: [
        {
          claim: "主張",
          sourceUrls: ["https://WWW.example.com/docs/?utm_source=x"],
          timeSensitive: true,
        },
      ],
      searchAvailable: true,
    });
    expect(r.unsupportedClaims).toHaveLength(0);
    expect(r.sources).toHaveLength(1);
  });

  it("どの主張も支えていない出典は結果に含めない", () => {
    const r = buildResearchResult({
      verified,
      claimMappings: [
        { claim: "主張", sourceUrls: ["https://mhlw.go.jp/stat"], timeSensitive: true },
      ],
      searchAvailable: true,
    });
    expect(r.sources.map((s) => s.url)).not.toContain("https://example.com/docs");
  });

  it("空の主張は無視する", () => {
    const r = buildResearchResult({
      verified,
      claimMappings: [{ claim: "   ", sourceUrls: [], timeSensitive: true }],
      searchAvailable: true,
    });
    expect(r.timeSensitiveClaims).toHaveLength(0);
    expect(r.unsupportedClaims).toHaveLength(0);
  });

  it("検証済み出典が空なら時事的主張は必ず unsupported になる", () => {
    const r = buildResearchResult({
      verified: [],
      claimMappings: [
        { claim: "時事的主張", sourceUrls: ["https://mhlw.go.jp/stat"], timeSensitive: true },
      ],
      searchAvailable: true,
    });
    expect(r.sources).toHaveLength(0);
    expect(r.unsupportedClaims).toHaveLength(1);
  });
});
