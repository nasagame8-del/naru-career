import Image from "next/image";
import Link from "next/link";
import { getAuthorProfileLabel } from "@/lib/author";

export function CareerDiscoveryCard() {
  return (
    <Link href="/shindan" className="group block overflow-hidden rounded-sm bg-primary text-white">
      <div className="relative">
      <Image src="/images/editorial/career-discovery.webp" alt="" width={900} height={600}
        sizes="(min-width: 1024px) 272px, (min-width: 640px) 400px, calc(100vw - 40px)"
        className="w-full h-auto" />
      <p className="absolute top-3 inset-x-3 text-center text-primary text-lg font-bold leading-snug">自分らしい仕事を、<br />見つけよう。</p>
      </div>
      <div className="px-5 pt-4 pb-5">
        <span className="flex min-h-11 items-center justify-between gap-2 rounded-full bg-white px-4 text-sm font-bold text-primary">
          RPG適職診断 <span aria-hidden="true">→</span>
        </span>
        <p className="mt-2 text-center text-[11px] text-white/80">約2分で、あなたの適職タイプへ</p>
      </div>
    </Link>
  );
}

export function EditorialSidebar() {
  return (
    <aside aria-label="キャリアを考えるヒント" className="hidden lg:block min-w-0">
      <div className="editorial-sticky space-y-6">
        <CareerDiscoveryCard />
        <Link href="/guides/second-new-grad-complete-guide" className="group block bg-primary-soft rounded-sm p-5">
          <p className="text-xl font-bold text-primary">はじめての転職に、<br />一冊の道しるべ。</p>
          <span className="mt-3 flex min-h-11 items-center justify-between border-t border-primary/20 text-sm font-bold text-primary">転職完全ガイド <span aria-hidden="true">→</span></span>
        </Link>
        <section className="border-t border-line pt-5">
          <p className="text-xs text-ink-soft mb-3">著者について</p>
          <Link href="/about" className="group flex items-center gap-3">
            <Image src="/images/author-avatar.webp" alt="磯貝アルトのイラストアバター" width={48} height={48} className="rounded-full" />
            <span className="text-sm font-bold group-hover:text-primary">磯貝アルト <span className="block text-[11px] font-normal text-ink-soft">{getAuthorProfileLabel()}</span></span>
            <span className="ml-auto text-primary" aria-hidden="true">→</span>
          </Link>
          <p className="mt-3 text-xs leading-loose text-ink-soft">飲食からIT/Webへ。失敗も、迷いも、ぜんぶ書きます。</p>
        </section>
      </div>
    </aside>
  );
}
