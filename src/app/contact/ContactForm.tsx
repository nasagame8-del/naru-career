"use client";

import { useState } from "react";

type Status = "idle" | "sending" | "sent" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      category: (form.elements.namedItem("category") as HTMLSelectElement).value,
      message: (form.elements.namedItem("message") as HTMLTextAreaElement).value,
      _hp: (form.elements.namedItem("_hp") as HTMLInputElement).value,
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (json.success) {
        setStatus("sent");
        form.reset();
      } else {
        setErrorMsg(json.error || "送信に失敗しました");
        setStatus("error");
      }
    } catch {
      setErrorMsg("通信エラーが発生しました");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="bg-primary-soft border border-primary/20 rounded-lg p-6 text-center">
        <p className="font-bold text-primary mb-2">送信完了しました</p>
        <p className="text-sm text-ink-soft">
          お問い合わせありがとうございます。内容を確認のうえ、必要に応じてご返信いたします。
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="mt-4 text-sm text-primary hover:underline"
        >
          新しいお問い合わせを送る
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Honeypot — visually hidden, bots fill this */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
        <label htmlFor="_hp">この欄は入力しないでください</label>
        <input type="text" id="_hp" name="_hp" tabIndex={-1} autoComplete="off" />
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium mb-1">
          お問い合わせ種別
        </label>
        <select
          id="category"
          name="category"
          className="w-full border border-line rounded-lg px-3 py-2.5 text-sm bg-white"
          defaultValue="question"
        >
          <option value="question">質問・感想</option>
          <option value="creator">発信者としてのご連絡（相互紹介・寄稿等）</option>
          <option value="other">その他</option>
        </select>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          お名前 / ハンドルネーム
          <span className="text-ink-soft font-normal ml-1">（任意）</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          className="w-full border border-line rounded-lg px-3 py-2.5 text-sm"
          placeholder="磯貝アルト"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          メールアドレス
          <span className="text-red-500 ml-1">*</span>
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          className="w-full border border-line rounded-lg px-3 py-2.5 text-sm"
          placeholder="example@example.com"
        />
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium mb-1">
          内容
          <span className="text-red-500 ml-1">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          className="w-full border border-line rounded-lg px-3 py-2.5 text-sm resize-y"
          placeholder="お問い合わせ内容をご記入ください"
        />
      </div>

      {errorMsg && (
        <p className="text-sm text-red-600">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full bg-primary text-white font-bold text-sm py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {status === "sending" ? "送信中..." : "送信する"}
      </button>
    </form>
  );
}
