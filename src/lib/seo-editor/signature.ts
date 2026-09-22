/**
 * SeoRun の改ざん防止。
 *
 * Runはリクエスト間でクライアントを経由するが、クライアントは正本ではない。
 * サーバーだけが持つ秘密鍵でHMAC署名し、次のリクエストで検証する。
 * Phase結果を書き換えたRunは署名検証で落ちるため、
 * 改ざんされた結果が記事生成やGitHub PR作成まで到達しない。
 *
 * localStorage はUI状態の復元にのみ使う想定で、署名が一致しなければ
 * サーバーはその Run を受け付けない。
 */

import crypto from "crypto";
import type { SeoRun, SignedRun } from "@/types/seo-editor";

/**
 * 署名鍵。
 * SEO_EDITOR_RUN_SECRET が未設定の場合はプロセス起動時のランダム値を使う。
 * インスタンスが入れ替わると既存Runの署名は無効になるが、
 * 固定の既定値を持つより安全側に倒す（その場合はRunをやり直す）。
 */
const SECRET: string =
  process.env.SEO_EDITOR_RUN_SECRET || crypto.randomBytes(32).toString("hex");

export const USING_EPHEMERAL_SECRET = !process.env.SEO_EDITOR_RUN_SECRET;

/** 署名対象を安定した文字列にする（キー順序に依存しないよう再帰ソート） */
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
}

export function signRun(run: SeoRun): SignedRun {
  const signature = crypto.createHmac("sha256", SECRET).update(canonicalize(run)).digest("hex");
  return { run, signature };
}

export class RunSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunSignatureError";
  }
}

/**
 * 署名を検証してRunを取り出す。
 * @throws RunSignatureError 署名が無い・一致しない場合
 */
export function verifySignedRun(value: unknown): SeoRun {
  if (typeof value !== "object" || value === null) {
    throw new RunSignatureError("署名付きRunが送られていません");
  }
  const { run, signature } = value as Partial<SignedRun>;
  if (!run || typeof signature !== "string" || signature.length === 0) {
    throw new RunSignatureError("Runの署名がありません");
  }

  const expected = crypto.createHmac("sha256", SECRET).update(canonicalize(run)).digest("hex");
  const a = Buffer.from(expected, "utf-8");
  const b = Buffer.from(signature, "utf-8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new RunSignatureError(
      "Runの署名が一致しません。サーバーが発行した状態ではないため処理を中止しました"
    );
  }
  return run as SeoRun;
}
