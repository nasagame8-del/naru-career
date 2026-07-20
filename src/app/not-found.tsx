import Link from "next/link";
import { MiniAlto } from "@/components/MiniAlto";

export default function NotFound() {
  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <MiniAlto pose="alert" size={140} className="mx-auto mb-6" />
      <h1 className="text-2xl font-bold text-ink mb-3">ページが見つかりませんでした</h1>
      <p className="text-sm text-ink-soft leading-relaxed mb-8">
        お探しのページは移動または削除された可能性があります。
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/"
          className="inline-flex items-center justify-center px-6 py-2.5 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors"
        >
          トップページへ戻る
        </Link>
        <Link
          href="/#articles"
          className="inline-flex items-center justify-center px-6 py-2.5 bg-surface text-primary text-sm font-bold rounded-lg border border-primary hover:bg-primary-soft transition-colors"
        >
          記事一覧を見る
        </Link>
      </div>
    </div>
  );
}
