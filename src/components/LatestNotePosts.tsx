import Image from "next/image";
import { getLatestNotePosts } from "@/lib/note-feed";

export async function LatestNotePosts() {
  const posts = await getLatestNotePosts(3);

  if (posts.length === 0) return null;

  return (
    <section className="bg-bg-soft border-t border-line">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-5">
          <div>
            <span className="inline-block font-mono text-[11px] font-medium tracking-[0.2em] text-primary uppercase mb-1">
              NOTE
            </span>
            <h2 className="text-lg font-bold text-ink">最新のnote投稿</h2>
          </div>
          <a
            href="https://note.com/altogenerative20"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline hidden sm:block"
          >
            もっと見る →
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {posts.map((post) => (
            <a
              key={post.url}
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex sm:flex-col bg-surface rounded-lg border border-line overflow-hidden hover:shadow-sm hover:-translate-y-0.5 transition-all duration-150"
            >
              {/* サムネイル */}
              <div className="w-[100px] sm:w-full aspect-square sm:aspect-[1.91/1] relative bg-line overflow-hidden shrink-0">
                {post.thumbnail ? (
                  <Image
                    src={post.thumbnail}
                    alt=""
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 640px) 100px, 33vw"
                    unoptimized={post.thumbnail.startsWith("http")}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-soft/30">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M9 9h6M9 13h4" />
                    </svg>
                  </div>
                )}
              </div>

              {/* テキスト */}
              <div className="p-3 flex-1 min-w-0">
                <h3 className="font-bold text-[13px] text-ink leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                  {post.title}
                </h3>
                {post.pubDate && (
                  <time className="block text-[11px] text-ink-soft font-mono mt-1.5">
                    {new Date(post.pubDate).toLocaleDateString("ja-JP", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    })}
                  </time>
                )}
              </div>
            </a>
          ))}
        </div>

        {/* モバイル用「もっと見る」 */}
        <div className="mt-4 text-center sm:hidden">
          <a
            href="https://note.com/altogenerative20"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            もっと見る →
          </a>
        </div>
      </div>
    </section>
  );
}
