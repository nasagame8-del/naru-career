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
    <nav className="bg-accent w-full">
      <div className="max-w-5xl mx-auto px-4 overflow-x-auto">
        <ul className="flex items-center h-10 gap-0 whitespace-nowrap">
          {NAV_ITEMS.map(({ label, href }) => {
            const isActive =
              href === "/"
                ? pathname === "/"
                : pathname.startsWith(href);

            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`inline-flex items-center h-10 px-5 text-[13px] transition-colors ${
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
    </nav>
  );
}
