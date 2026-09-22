/**
 * 候補バッチ保存アダプタのテスト。
 *
 * ここで確認したいのは機能そのものより「永続性を偽らないこと」。
 * メモリ実装は durable=false を必ず申告しなければならない。
 */

import { describe, it, expect, beforeEach } from "vitest";
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
