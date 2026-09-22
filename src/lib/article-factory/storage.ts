/**
 * 候補バッチの保存。
 *
 * 重要な前提:
 *   Vercelのサーバーレス実行はインスタンスが使い捨てで、
 *   モジュールスコープの変数はリクエスト間で共有される保証が無い。
 *   したがって **MemoryCandidateBatchStore は永続化ではない**。
 *   これを本番の唯一の保存先として扱ってはいけない。
 *
 * 新しい有料サービスを増やさずに使える耐久面は、既に連携済みの GitHub リポジトリのみ。
 * そのため **本番では GithubCandidateBatchStore を既定**とし、
 * 設定が欠けている場合はメモリへ暗黙に落ちず、明示的なエラーで止める。
 */

import { CANDIDATE_BATCH_DIR, GITHUB_BASE_BRANCH, GITHUB_REPO } from "./config";
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

/** 保存先を選べなかったときに投げる。API/UIはこれを明示的なエラーとして見せる */
export class StorageUnavailableError extends Error {
  readonly reasons: string[];
  constructor(reasons: string[]) {
    super(reasons.join(" / "));
    this.name = "StorageUnavailableError";
    this.reasons = reasons;
  }
}

/** 本番環境かどうか */
function isProduction(): boolean {
  // Vercel は VERCEL_ENV に production / preview / development を入れる。
  // Vercel以外で動く場合は NODE_ENV にフォールバックする。
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv) return vercelEnv === "production";
  return process.env.NODE_ENV === "production";
}

/** GitHub保存に必要な設定が揃っているか（値は読まない・返さない） */
export function githubStoreReadiness(): { ready: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!process.env.SEO_EDITOR_GITHUB_TOKEN && !process.env.GITHUB_TOKEN) {
    reasons.push("GitHub Tokenが未設定です（SEO_EDITOR_GITHUB_TOKEN / GITHUB_TOKEN）");
  }
  if (!GITHUB_BASE_BRANCH) {
    reasons.push(
      "SEO_EDITOR_BASE_BRANCH が未設定です（候補バッチ用branchの作成元として必要）"
    );
  }
  if (!GITHUB_REPO.includes("/")) {
    reasons.push("SEO_EDITOR_GITHUB_REPO の形式が owner/repo ではありません");
  }
  return { ready: reasons.length === 0, reasons };
}

/**
 * 有効な保存先を返す。
 *
 * 方針（INST-004）:
 *   - **本番では GitHub 保存が既定**。メモリへ暗黙にフォールバックしない。
 *   - 本番で GitHub の設定が欠けていれば `StorageUnavailableError` を投げ、
 *     API/UI にはっきりしたエラーとして出す（fail closed）。
 *   - メモリ実装はテスト・開発でのみ使える。
 *     本番で明示的に memory を選ぼうとしても拒否する。
 *
 * @throws StorageUnavailableError 本番で永続保存を用意できない場合
 */
export function getCandidateBatchStore(): CandidateBatchStore {
  const selected = process.env.ARTICLE_FACTORY_BATCH_STORE;
  const production = isProduction();

  if (production) {
    // 本番でメモリを選ぼうとするのは設定ミス。黙って通さない。
    if (selected === "memory") {
      throw new StorageUnavailableError([
        "本番環境では ARTICLE_FACTORY_BATCH_STORE=memory を使用できません。候補バッチが失われるため拒否しました",
      ]);
    }
    const readiness = githubStoreReadiness();
    if (!readiness.ready) {
      throw new StorageUnavailableError([
        "本番環境では候補バッチをGitHubへ永続化する必要があります",
        ...readiness.reasons,
      ]);
    }
    return new GithubCandidateBatchStore();
  }

  // 本番以外: 明示的に github を選べる。既定はメモリ。
  if (selected === "github") {
    const readiness = githubStoreReadiness();
    if (!readiness.ready) throw new StorageUnavailableError(readiness.reasons);
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
