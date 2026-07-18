import Image from "next/image";
import { getLatestNotePosts } from "@/lib/note-feed";

export async function LatestNotePosts() {
  const posts = await getLatestNotePosts(6);

  if (posts.length === 0) return null;

  return (
    <section className="bg-bg-soft border-t border-line">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="inline-block font-mono text-[11px] font-medium tracking-[0.2em] text-accent uppercase mb-2">
              NOTE
            </span>
            <h2 className="text-xl font-bold text-ink">最新のnote投稿</h2>
          </div>
          <a
            href="https://note.com/altogenerative20"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent hover:underline hidden sm:block"
          >
            もっと見る →
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((post) => (
            <a
              key={post.url}
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block bg-white rounded-lg border border-line overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-150"
            >
              {/* サムネイル */}
              <div className="aspect-[1.91/1] relative bg-line overflow-hidden">
                {post.thumbnail ? (
                  <Image
                    src={post.thumbnail}
                    alt=""
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    unoptimized={post.thumbnail.startsWith("http")}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-soft/30">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M9 9h6M9 13h4" />
                    </svg>
                  </div>
                )}
              </div>

              {/* テキスト */}
              <div className="p-4">
                <h3 className="font-bold text-sm text-ink leading-snug line-clamp-2 group-hover:text-accent transition-colors">
                  {post.title}
                </h3>
                {post.pubDate && (
                  <time className="block text-xs text-ink-soft font-mono mt-2">
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
        <div className="mt-6 text-center sm:hidden">
          <a
            href="https://note.com/altogenerative20"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent hover:underline"
          >
            もっと見る →
          </a>
        </div>
      </div>
    </section>
  );
}
