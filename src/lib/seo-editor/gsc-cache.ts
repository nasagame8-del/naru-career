/**
 * Search Console データのサーバー側取得とキャッシュ。
 *
 * 正本はサーバー側。クライアントから渡されたSCDataは一切信用しない。
 * 既存の src/lib/search-console.ts の fetchSearchConsoleData() をそのまま再利用する。
 *
 * fetchSearchConsoleData() は1回で16回のGSC API callを行うため、
 * SEO Editor の実行ごとに呼び直さないよう TTL キャッシュを挟む。
 *
 * v1 はインスタンス内メモリキャッシュ。将来 Vercel Blob / KV などの
 * 共有キャッシュへ差し替えられるよう、SeoGscCache インターフェースで抽象化している。
 */

import { fetchSearchConsoleData } from "@/lib/search-console";
import type { SCData } from "@/types/search-console";
import { GSC_CACHE_TTL_MS } from "./config";

export interface SeoGscCache {
  get(key: string): Promise<SCData | null>;
  set(key: string, value: SCData): Promise<void>;
}

interface CacheEntry {
  value: SCData;
  expiresAt: number;
}

/** インスタンス内メモリキャッシュ（v1の既定実装） */
class MemoryGscCache implements SeoGscCache {
  private store = new Map<string, CacheEntry>();

  async get(key: string): Promise<SCData | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: SCData): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + GSC_CACHE_TTL_MS });
  }
}

let cache: SeoGscCache = new MemoryGscCache();

/** 共有キャッシュへ差し替えるための注入口 */
export function setGscCache(next: SeoGscCache): void {
  cache = next;
}

/**
 * GSCデータを取得する。キャッシュが有効なら API を呼ばない。
 * @param force true でキャッシュを無視して再取得
 */
export async function getSearchConsoleData(force = false): Promise<{
  data: SCData;
  fromCache: boolean;
}> {
  const key = `gsc:${process.env.SEARCH_CONSOLE_SITE_URL || "default"}`;

  if (!force) {
    const cached = await cache.get(key);
    if (cached) return { data: cached, fromCache: true };
  }

  const data = await fetchSearchConsoleData();
  // エラーレスポンスはキャッシュしない（設定ミスを固定化しないため）
  if (data.configured && !data.error) {
    await cache.set(key, data);
  }
  return { data, fromCache: false };
}
