import Link from "next/link";

export function MobileCareerCTA() {
  return (
    <div className="lg:hidden my-8 bg-primary-soft p-5 rounded-sm">
      <p className="text-xs text-ink-soft">どの記事から読めばいいか迷った方へ</p>
      <Link href="/guides/second-new-grad-complete-guide" className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4">
        転職完全ガイドから読む
      </Link>
    </div>
  );
}

