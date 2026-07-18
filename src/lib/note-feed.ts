import fs from "fs";
import path from "path";
import matter from "gray-matter";

const NOTE_RSS_URL = "https://note.com/altogenerative20/rss";
const NOTE_DRAFTS_DIR = path.join(process.cwd(), "content", "note-drafts");

interface NoteLink {
  noteUrl: string;
  noteTitle: string;
}

/**
 * note-drafts の frontmatter を読み取り、title → original_slug のマップを返す
 */
function getNoteDraftMap(): Map<string, string> {
  const map = new Map<string, string>();
  if (!fs.existsSync(NOTE_DRAFTS_DIR)) return map;

  const files = fs.readdirSync(NOTE_DRAFTS_DIR).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const raw = fs.readFileSync(path.join(NOTE_DRAFTS_DIR, file), "utf-8");
    const { data } = matter(raw);
    if (data.title && data.original_slug) {
      map.set(normalise(data.title), data.original_slug);
    }
  }
  return map;
}

/** 比較用に正規化: 全角→半角、空白除去、小文字化 */
function normalise(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/**
 * RSS フィードを取得し、slug → NoteLink のマッピングを返す。
 * Next.js の fetch キャッシュで 1 時間保持。
 */
export async function getNoteLinkMap(): Promise<Map<string, NoteLink>> {
  const result = new Map<string, NoteLink>();

  let xml: string;
  try {
    const res = await fetch(NOTE_RSS_URL, { next: { revalidate: 3600 } });
    if (!res.ok) return result;
    xml = await res.text();
  } catch {
    return result;
  }

  // 簡易XMLパース: <item> 内の <title> と <link> を抽出
  const items = xml.match(/<item>[\s\S]*?<\/item>/g);
  if (!items) return result;

  const draftMap = getNoteDraftMap();

  for (const item of items) {
    const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
    const linkMatch = item.match(/<link>(.*?)<\/link>/);
    if (!titleMatch || !linkMatch) continue;

    const rssTitle = titleMatch[1] ?? titleMatch[2] ?? "";
    const rssLink = linkMatch[1];
    const normRssTitle = normalise(rssTitle);

    // 完全一致を優先
    let matchedSlug = draftMap.get(normRssTitle);

    // 前方一致フォールバック (表記ゆれ対策)
    if (!matchedSlug) {
      for (const [normDraftTitle, slug] of draftMap.entries()) {
        if (
          normRssTitle.startsWith(normDraftTitle) ||
          normDraftTitle.startsWith(normRssTitle)
        ) {
          matchedSlug = slug;
          break;
        }
      }
    }

    if (matchedSlug) {
      result.set(matchedSlug, { noteUrl: rssLink, noteTitle: rssTitle });
    }
  }

  return result;
}

// ── 最新note投稿一覧（トップページ表示用） ──

export interface NotePost {
  title: string;
  url: string;
  pubDate: string;
  thumbnail: string | null;
  slug: string | null;
}

/**
 * noteの最新投稿を取得し、新しい順にlimit件返す。
 * - RSSのmedia:thumbnailがあればそれを使用
 * - 対応するnote-drafts画像があればフォールバック
 */
export async function getLatestNotePosts(limit = 6): Promise<NotePost[]> {
  let xml: string;
  try {
    const res = await fetch(NOTE_RSS_URL, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    xml = await res.text();
  } catch {
    return [];
  }

  const items = xml.match(/<item>[\s\S]*?<\/item>/g);
  if (!items) return [];

  const draftMap = getNoteDraftMap();
  const imagesDir = path.join(process.cwd(), "content", "note-drafts-images");
  const posts: NotePost[] = [];

  for (const item of items) {
    const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
    const linkMatch = item.match(/<link>(.*?)<\/link>/);
    const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
    const mediaThumbnailMatch = item.match(/<media:thumbnail>(.*?)<\/media:thumbnail>/);

    if (!titleMatch || !linkMatch) continue;

    const rssTitle = titleMatch[1] ?? titleMatch[2] ?? "";
    const rssLink = linkMatch[1];
    const pubDate = pubDateMatch?.[1] || "";
    const mediaThumbnail = mediaThumbnailMatch?.[1] || null;

    // slug突き合わせ
    const normRssTitle = normalise(rssTitle);
    let matchedSlug: string | undefined;
    matchedSlug = draftMap.get(normRssTitle);
    if (!matchedSlug) {
      for (const [normDraftTitle, slug] of draftMap.entries()) {
        if (normRssTitle.startsWith(normDraftTitle) || normDraftTitle.startsWith(normRssTitle)) {
          matchedSlug = slug;
          break;
        }
      }
    }

    // サムネイル: RSS画像 > 自前note-header画像 > null
    let thumbnail = mediaThumbnail;
    if (!thumbnail && matchedSlug) {
      const localImage = path.join(imagesDir, `${matchedSlug}-note-header.png`);
      if (fs.existsSync(localImage)) {
        thumbnail = `/note-images/${matchedSlug}-note-header.png`;
      }
    }

    posts.push({
      title: rssTitle,
      url: rssLink,
      pubDate,
      thumbnail,
      slug: matchedSlug || null,
    });
  }

  // 新しい順
  posts.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
  return posts.slice(0, limit);
}
