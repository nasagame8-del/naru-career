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
