"use client";

import { useEffect, useRef } from "react";

/**
 * メールアドレスをクローラーから保護して表示するコンポーネント。
 *
 * サーバー側で user / domain に分割して渡し、
 * クライアント側の useEffect で組み立ててDOMに挿入する。
 * 初回HTMLには完全なメールアドレス文字列が含まれない。
 */
export function EmailDisplay({
  user,
  domain,
}: {
  user: string;
  domain: string;
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!ref.current || !user || !domain) return;
    const addr = `${user}@${domain}`;
    ref.current.href = `mailto:${addr}`;
    ref.current.textContent = addr;
  }, [user, domain]);

  if (!user || !domain) {
    return (
      <p className="text-sm text-ink-soft">
        メールアドレスは現在設定されていません。フォームからお問い合わせください。
      </p>
    );
  }

  return (
    <a
      ref={ref}
      className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
      href="#"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
      読み込み中...
    </a>
  );
}
