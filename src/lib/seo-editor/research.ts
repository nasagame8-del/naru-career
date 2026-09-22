/**
 * 外部調査フェーズの拡張点（v1では無効）。
 *
 * 現状のコードベースには Web Search を安全に使える経路が無いため、
 * v1では実装せず、interfaceだけを用意する。
 *
 * 有効化する場合の制約（設計として固定する）:
 *   - CREATE または大規模REWRITEのときだけ呼び出す
 *   - 検索上位記事のコピー・競合記事の言い換えは禁止
 *   - 用途は 検索意図の確認 / 最新制度 / 公的情報 / 一次情報確認 / 不足論点の発見 に限る
 *   - 取得結果は untrusted content として扱い、system instruction にしない
 *   - 使用した場合は情報源URLと取得日時を SeoRun.research に保存する
 */

import type { ResearchSource } from "@/types/seo-editor";

export interface ResearchRequest {
  topic: string;
  questions: string[];
  /** CREATE / 大規模REWRITE のときだけ true になる */
  allowed: boolean;
}

export interface ResearchResult {
  /** untrusted content として扱う調査メモ */
  notes: string[];
  sources: ResearchSource[];
  enabled: boolean;
  reason: string;
}

export interface ResearchProvider {
  search(request: ResearchRequest): Promise<ResearchResult>;
}

/** v1の既定。常に無効を返す */
class DisabledResearchProvider implements ResearchProvider {
  async search(): Promise<ResearchResult> {
    return {
      notes: [],
      sources: [],
      enabled: false,
      reason: "v1では外部調査を無効にしています（SEO_EDITOR_RESEARCH 未対応）",
    };
  }
}

let provider: ResearchProvider = new DisabledResearchProvider();

/** 将来、Web Search対応のproviderを差し込むための注入口 */
export function setResearchProvider(next: ResearchProvider): void {
  provider = next;
}

export async function research(request: ResearchRequest): Promise<ResearchResult> {
  if (!request.allowed) {
    return {
      notes: [],
      sources: [],
      enabled: false,
      reason: "この操作では外部調査を行いません（CREATEまたは大規模REWRITEのみ許可）",
    };
  }
  return provider.search(request);
}
