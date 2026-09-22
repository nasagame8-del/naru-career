/**
 * 候補バッチの保存。
 *
 * 重要な前提:
 *   Vercelのサーバーレス実行はインスタンスが使い捨てで、
 *   モジュールスコープの変数はリクエスト間で共有される保証が無い。
 *   したがって **MemoryCandidateBatchStore は永続化ではない**。
 *   これを本番の唯一の保存先として扱ってはいけない。
 *
 * 現時点で新しい有料サービスを増やさずに使える耐久面は、
 * 既に連携済みの GitHub リポジトリのみ。
 * そのため GithubCandidateBatchStore を用意し、
 * 明示的に ARTICLE_FACTORY_BATCH_STORE=github を設定した場合にだけ有効にする。
 */

import { CANDIDATE_BATCH_DIR } from "./config";
import { readFileFromBranch, writeFileToBranch } from "./github";
import type { CandidateBatch } from "./types";

/** 候補バッチの保存先アダプタ */
export interface CandidateBatchStore {
  /** 実装の識別子（レポート・UI表示用） */
  readonly kind: "memory" | "github";
  /** この実装がプロセスをまたいで永続化されるか */
  readonly durable: boolean;
  save(batch: CandidateBatch): Promise<void>;
  /** 最新のバッチを返す。無ければ null */
  getLatest(): Promise<CandidateBatch | null>;
  getById(batchId: string): Promise<CandidateBatch | null>;
}

// ── メモリ実装（開発・テスト用） ──

/**
 * プロセス内メモリ実装。
 *
 * テストとローカル開発のためのもの。
 * durable = false を明示しており、UI・レポートはこれを本番の永続化として扱わない。
 */
export class MemoryCandidateBatchStore implements CandidateBatchStore {
  readonly kind = "memory" as const;
  readonly durable = false;

  private batches = new Map<string, CandidateBatch>();
  private latestId: string | null = null;

  async save(batch: CandidateBatch): Promise<void> {
    this.batches.set(batch.batchId, batch);
    this.latestId = batch.batchId;
  }

  async getLatest(): Promise<CandidateBatch | null> {
    if (!this.latestId) return null;
    return this.batches.get(this.latestId) ?? null;
  }

  async getById(batchId: string): Promise<CandidateBatch | null> {
    return this.batches.get(batchId) ?? null;
  }

  /** テスト用 */
  clear(): void {
    this.batches.clear();
    this.latestId = null;
  }
}

// ── GitHub実装（既存連携のみを使う耐久保存） ──

/** 候補バッチ専用のbranch。master とは独立しており、ここへPRは作らない */
export const CANDIDATE_BRANCH = "article-factory/candidates";

const LATEST_POINTER = `${CANDIDATE_BATCH_DIR}/latest.json`;

/**
 * GitHubリポジトリを保存先に使う実装。
 *
 * 新しい外部サービスを増やさずに済む唯一の耐久面。
 * master には一切書き込まず、専用branchのみを更新する。
 */
export class GithubCandidateBatchStore implements CandidateBatchStore {
  readonly kind = "github" as const;
  readonly durable = true;

  async save(batch: CandidateBatch): Promise<void> {
    const path = `${CANDIDATE_BATCH_DIR}/${batch.batchId}.json`;
    const content = JSON.stringify(batch, null, 2) + "\n";

    await writeFileToBranch({
      path,
      branch: CANDIDATE_BRANCH,
      content,
      message: `chore(article-factory): candidate batch ${batch.batchId}`,
    });

    await writeFileToBranch({
      path: LATEST_POINTER,
      branch: CANDIDATE_BRANCH,
      content: JSON.stringify({ batchId: batch.batchId, savedAt: batch.generatedAt }, null, 2) + "\n",
      message: `chore(article-factory): point latest to ${batch.batchId}`,
    });
  }

  async getLatest(): Promise<CandidateBatch | null> {
    const pointer = await readFileFromBranch(LATEST_POINTER, CANDIDATE_BRANCH);
    if (!pointer) return null;
    try {
      const { batchId } = JSON.parse(pointer) as { batchId: string };
      if (!batchId) return null;
      return await this.getById(batchId);
    } catch {
      return null;
    }
  }

  async getById(batchId: string): Promise<CandidateBatch | null> {
    if (!/^[\w.-]+$/.test(batchId)) return null;
    const raw = await readFileFromBranch(
      `${CANDIDATE_BATCH_DIR}/${batchId}.json`,
      CANDIDATE_BRANCH
    );
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CandidateBatch;
    } catch {
      return null;
    }
  }
}

// ── アダプタの選択 ──

const memorySingleton = new MemoryCandidateBatchStore();

/**
 * 有効な保存先を返す。
 *
 * 既定はメモリ実装（= 永続化されない）。
 * 本番で候補バッチを翌日まで保持するには
 * ARTICLE_FACTORY_BATCH_STORE=github を設定すること。
 */
export function getCandidateBatchStore(): CandidateBatchStore {
  if (process.env.ARTICLE_FACTORY_BATCH_STORE === "github") {
    return new GithubCandidateBatchStore();
  }
  return memorySingleton;
}

/** 保存先の状態。UI・レポートで「永続化されているか」を正直に出すために使う */
export function describeStore(store: CandidateBatchStore): {
  kind: string;
  durable: boolean;
  warning: string | null;
} {
  return {
    kind: store.kind,
    durable: store.durable,
    warning: store.durable
      ? null
      : "候補バッチはインメモリ保存のため、サーバーレスのインスタンスが入れ替わると失われます。本番で保持するには ARTICLE_FACTORY_BATCH_STORE=github を設定してください。",
  };
}
