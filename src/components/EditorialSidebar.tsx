import Image from "next/image";
import Link from "next/link";
import { getAuthorProfileLabel } from "@/lib/author";

export function CareerDiscoveryCard() {
  return null;
}

export function EditorialSidebar({ ad }: { ad?: "kosmo" } = {}) {
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
            <Image src="/images/author-avatar-illustration.webp" alt="磯貝アルトの著者イメージイラスト" width={48} height={48} className="rounded-full" />
            <span className="text-sm font-bold group-hover:text-primary">磯貝アルト <span className="block text-[11px] font-normal text-ink-soft">{getAuthorProfileLabel()}</span></span>
            <span className="ml-auto text-primary" aria-hidden="true">→</span>
          </Link>
          <p className="mt-1 text-[10px] text-ink-soft">著者イメージイラスト</p>
          <p className="mt-3 text-xs leading-loose text-ink-soft">飲食業界から第二新卒でIT/Web業界へ転職。約30社に応募し2社から内定を獲得。実体験と調査をもとに発信しています。</p>
        </section>
        {ad === "kosmo" && (
          <section aria-label="広告：KOSMO" className="border-t border-line pt-5">
            <p className="mb-3 text-[11px] text-ink-soft">広告（PR）｜KOSMO</p>
            <a
              href="https://px.a8.net/svt/ejp?a8mat=4BEHXF+56CP4I+59SS+BXIYP"
              rel="nofollow sponsored"
              data-track-event="cta_click"
              data-track-agent_name="KOSMO"
              data-track-format="banner"
              data-track-placement="article_sidebar"
              className="block w-fit max-w-full mx-auto"
            >
              {/* A8配信素材を直接読み込み、ASPの画像URL・計測を維持する。 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://www22.a8.net/svt/bgt?aid=261016899313&wid=001&eno=01&mid=s00000024598002004000&mc=1"
                alt="KOSMOの転職サポート案内（広告）"
                width={300}
                height={250}
                loading="lazy"
                decoding="async"
                style={{ width: 300, maxWidth: "100%", height: "auto" }}
              />
            </a>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://www17.a8.net/0.gif?a8mat=4BEHXF+56CP4I+59SS+BXIYP"
              alt=""
              width={1}
              height={1}
              style={{ width: 1, height: 1, margin: 0, border: 0 }}
            />
          </section>
        )}
      </div>
    </aside>
  );
}
