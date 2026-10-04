"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { label: string; href: string };

/** カテゴリ一覧はサーバー側（layout）から渡し、説明文などをクライアントへ送らない */
export function CategoryNavBar({ categories }: { categories: NavItem[] }) {
  const pathname = usePathname();
  const items = [{ label: "すべて", href: "/" }, ...categories];

  return (
    <nav aria-label="カテゴリ" className="bg-surface border-b border-line w-full">
      <div className="site-container relative">
        <div className="overflow-x-auto scrollbar-hide">
          <ul className="flex items-center h-11 gap-0 justify-center w-max min-w-full whitespace-nowrap min-w-0">
            {items.map(({ label, href }) => {
              const isActive =
                href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(href);

              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={isActive ? "page" : undefined}
                    className={`inline-flex items-center h-11 px-3 sm:px-5 text-[12px] sm:text-[13px] tracking-tight sm:tracking-normal transition-colors ${
                      isActive
                        ? "text-primary font-bold underline decoration-primary decoration-2 underline-offset-[12px]"
                        : "text-ink-soft hover:text-primary font-medium"
                    }`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        {/* 横スクロールできることを示す右端のフェード */}
        <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-surface to-transparent pointer-events-none sm:hidden" />
      </div>
    </nav>
  );
}
