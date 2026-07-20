"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "すべて", href: "/" },
  { label: "体験談", href: "/category/taiken" },
  { label: "エージェント比較", href: "/category/agent-comparison" },
  { label: "業界解説", href: "/category/industry-guide" },
] as const;

export function CategoryNavBar() {
  const pathname = usePathname();

  return (
    <nav className="bg-primary w-full">
      <div className="max-w-5xl mx-auto px-2 sm:px-4 relative">
        <div className="overflow-x-auto scrollbar-hide">
          <ul className="flex items-center h-11 gap-0 whitespace-nowrap min-w-0">
            {NAV_ITEMS.map(({ label, href }) => {
              const isActive =
                href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(href);

              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`inline-flex items-center h-11 px-3 sm:px-5 text-[12px] sm:text-[13px] tracking-tight sm:tracking-normal transition-colors ${
                      isActive
                        ? "text-amber font-bold"
                        : "text-white/90 hover:bg-white/10 font-medium"
                    }`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        {/* 右端フェード（スクロール示唆） */}
        <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-primary to-transparent pointer-events-none sm:hidden" />
      </div>
    </nav>
  );
}
