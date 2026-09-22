/**
 * 候補バッチ保存アダプタのテスト。
 *
 * ここで確認したいのは機能そのものより「永続性を偽らないこと」。
 * メモリ実装は durable=false を必ず申告しなければならない。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryCandidateBatchStore, describeStore } from "./storage";
import { computeNextArticleId } from "./inventory";
import { branchNameForRun } from "./github";
import type { CandidateBatch } from "./types";

function batch(id: string): CandidateBatch {
  return {
    batchId: id,
    generatedAt: "2026-09-23T00:00:00.000Z",
    trigger: "cron",
    candidates: [],
    inventorySize: 37,
    nextArticleId: 38,
    notes: [],
  };
}

describe("MemoryCandidateBatchStore", () => {
  let store: MemoryCandidateBatchStore;

  beforeEach(() => {
    store = new MemoryCandidateBatchStore();
  });

  it("保存したバッチをIDで取り出せる", async () => {
    await store.save(batch("b1"));
    expect((await store.getById("b1"))?.batchId).toBe("b1");
  });

  it("最新のバッチを返す", async () => {
    await store.save(batch("b1"));
    await store.save(batch("b2"));
    expect((await store.getLatest())?.batchId).toBe("b2");
  });

  it("何も保存されていなければ null", async () => {
    expect(await store.getLatest()).toBeNull();
    expect(await store.getById("missing")).toBeNull();
  });

  it("永続化されないことを申告する（偽らない）", () => {
    const d = describeStore(store);
    expect(d.durable).toBe(false);
    expect(d.kind).toBe("memory");
    expect(d.warning).toBeTruthy();
    expect(d.warning).toContain("ARTICLE_FACTORY_BATCH_STORE");
  });
});

describe("computeNextArticleId", () => {
  it("在庫数+1を返す", () => {
    expect(computeNextArticleId(37)).toBe(38);
    expect(computeNextArticleId(0)).toBe(1);
  });
});

describe("branchNameForRun", () => {
  it("同じrunIdなら常に同じbranch名になる（冪等）", () => {
    expect(branchNameForRun("run_abc123")).toBe(branchNameForRun("run_abc123"));
  });

  it("異なるrunIdなら異なるbranch名になる", () => {
    expect(branchNameForRun("run_a")).not.toBe(branchNameForRun("run_b"));
  });

  it("branch名に使えない文字を落とす", () => {
    const name = branchNameForRun("run/../evil id");
    expect(name).not.toContain("..");
    expect(name).not.toContain(" ");
    expect(name.startsWith("article-factory/")).toBe(true);
  });
});

// ── 本番での保存先選択（INST-004） ──

describe("getCandidateBatchStore（本番の既定）", () => {
  const ENV_KEYS = [
    "VERCEL_ENV",
    "NODE_ENV",
    "ARTICLE_FACTORY_BATCH_STORE",
    "SEO_EDITOR_GITHUB_TOKEN",
    "GITHUB_TOKEN",
    "SEO_EDITOR_BASE_BRANCH",
  ] as const;

  const saved: Record<string, string | undefined> = {};

  /** NODE_ENV は型上 readonly のため、テストでは可変ビュー経由で操作する */
  const env = process.env as Record<string, string | undefined>;

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    vi.resetModules();
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else env[k] = saved[k];
    }
    vi.resetModules();
  });

  /** config.ts は env をモジュール読み込み時に固定するため、毎回読み直す */
  async function freshStorage() {
    return await import("./storage");
  }

  it("本番でGitHub設定が揃っていればGitHub保存を選ぶ", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.GITHUB_TOKEN = "dummy";
    process.env.SEO_EDITOR_BASE_BRANCH = "master";

    const m = await freshStorage();
    const store = m.getCandidateBatchStore();
    expect(store.kind).toBe("github");
    expect(store.durable).toBe(true);
  });

  it("本番でGitHub設定が欠けていればエラーで止まる（メモリへ落ちない）", async () => {
    process.env.VERCEL_ENV = "production";
    // token も base branch も無い

    const m = await freshStorage();
    expect(() => m.getCandidateBatchStore()).toThrow(m.StorageUnavailableError);
  });

  it("本番でトークンだけ欠けていてもエラーになる", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.SEO_EDITOR_BASE_BRANCH = "master";

    const m = await freshStorage();
    expect(() => m.getCandidateBatchStore()).toThrow(m.StorageUnavailableError);
  });

  it("本番で memory を明示指定しても拒否する", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.GITHUB_TOKEN = "dummy";
    process.env.SEO_EDITOR_BASE_BRANCH = "master";
    process.env.ARTICLE_FACTORY_BATCH_STORE = "memory";

    const m = await freshStorage();
    expect(() => m.getCandidateBatchStore()).toThrow(/memory/);
  });

  it("エラーには欠けている設定名が含まれる（値は含まない）", async () => {
    process.env.VERCEL_ENV = "production";

    const m = await freshStorage();
    try {
      m.getCandidateBatchStore();
      throw new Error("should have thrown");
    } catch (e) {
      const err = e as InstanceType<typeof m.StorageUnavailableError>;
      expect(err.reasons.join(" ")).toContain("SEO_EDITOR_GITHUB_TOKEN");
      expect(err.reasons.join(" ")).toContain("SEO_EDITOR_BASE_BRANCH");
    }
  });

  it("本番以外の既定はメモリ（開発・テスト用）", async () => {
    process.env.VERCEL_ENV = "preview";

    const m = await freshStorage();
    const store = m.getCandidateBatchStore();
    expect(store.kind).toBe("memory");
    expect(store.durable).toBe(false);
  });

  it("本番以外でもgithubを明示選択できる", async () => {
    process.env.VERCEL_ENV = "development";
    process.env.ARTICLE_FACTORY_BATCH_STORE = "github";
    process.env.GITHUB_TOKEN = "dummy";
    process.env.SEO_EDITOR_BASE_BRANCH = "master";

    const m = await freshStorage();
    expect(m.getCandidateBatchStore().kind).toBe("github");
  });

  it("VERCEL_ENV が無い場合は NODE_ENV=production を本番とみなす", async () => {
    env.NODE_ENV = "production";

    const m = await freshStorage();
    expect(() => m.getCandidateBatchStore()).toThrow(m.StorageUnavailableError);
  });
});
