import { NextRequest, NextResponse } from "next/server";

function getResend() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Resend } = require("resend") as typeof import("resend");
  return new Resend(process.env.RESEND_API_KEY);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, category, message, _hp } = body;

  // Honeypot: if filled, silently succeed (bot)
  if (_hp) {
    return NextResponse.json({ success: true });
  }

  // Validation
  if (!email || !message) {
    return NextResponse.json(
      { error: "メールアドレスと内容は必須です" },
      { status: 400 }
    );
  }

  const to = process.env.CONTACT_EMAIL;
  const from = process.env.CONTACT_FROM || "onboarding@resend.dev";

  if (!to) {
    return NextResponse.json(
      { error: "送信先が設定されていません" },
      { status: 500 }
    );
  }

  const categoryLabel =
    category === "creator"
      ? "発信者としてのご連絡（相互紹介・寄稿等）"
      : category === "other"
        ? "その他"
        : "質問・感想";

  try {
    const resend = getResend();
    await resend.emails.send({
      from: `NARU お問い合わせ <${from}>`,
      to: [to],
      replyTo: email,
      subject: `[NARU] ${categoryLabel}：${name || "匿名"}さんからのお問い合わせ`,
      text: [
        `種別: ${categoryLabel}`,
        `お名前: ${name || "未入力"}`,
        `メールアドレス: ${email}`,
        "",
        "--- 内容 ---",
        message,
      ].join("\n"),
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Resend error:", e);
    return NextResponse.json(
      { error: "送信に失敗しました。時間を置いて再度お試しください。" },
      { status: 500 }
    );
  }
}
