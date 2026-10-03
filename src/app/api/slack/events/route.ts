import { after, NextResponse } from "next/server";

import { delegateToClaude, githubDelegationReady } from "@/lib/war-room/github";
import { planWarRoomMessage } from "@/lib/war-room/planner";
import {
  postSlackMessage,
  stripSlackMention,
  type SlackEventEnvelope,
  verifySlackSignature,
} from "@/lib/war-room/slack";

export const runtime = "nodejs";

const DEFAULT_WAR_ROOM_CHANNEL = "C0C71TPTSHW";

async function processMention(envelope: SlackEventEnvelope): Promise<void> {
  const event = envelope.event;
  if (!event) return;

  const botToken = process.env.SLACK_CHATGPT_BOT_TOKEN;
  if (!botToken) return;

  const threadTs = event.thread_ts || event.ts;
  const userText = stripSlackMention(event.text);

  if (!userText) {
    await postSlackMessage({
      token: botToken,
      channel: event.channel,
      threadTs,
      text: "相談内容を書いてメンションしてください。",
    });
    return;
  }

  try {
    await postSlackMessage({
      token: botToken,
      channel: event.channel,
      threadTs,
      text: "受信しました。ChatGPTで整理し、必要ならClaudeへ自動で回します。",
    });

    const plan = await planWarRoomMessage(userText);

    if (plan.mode !== "delegate") {
      await postSlackMessage({
        token: botToken,
        channel: event.channel,
        threadTs,
        text: plan.reply,
      });
      return;
    }

    if (!githubDelegationReady()) {
      await postSlackMessage({
        token: botToken,
        channel: event.channel,
        threadTs,
        text: [
          plan.reply,
          "",
          "Claudeとの議論・実装を開始しようとしましたが、Vercel側のGitHub実行トークンが未設定です。ChatGPTとの会話はこのまま使えます。",
        ].join("\n"),
      });
      return;
    }

    if (!envelope.event_id) {
      await postSlackMessage({
        token: botToken,
        channel: event.channel,
        threadTs,
        text: "Slack event IDを取得できなかったため、Claude実行は開始しませんでした。",
      });
      return;
    }

    const delegation = await delegateToClaude({
      eventId: envelope.event_id,
      slackChannel: event.channel,
      slackTs: event.ts,
      userRequest: userText,
      chatgptPosition: plan.reply,
      claudeInstruction: plan.claude_instruction,
    });

    await postSlackMessage({
      token: botToken,
      channel: event.channel,
      threadTs,
      text: [
        plan.reply,
        "",
        delegation.reused
          ? "同じSlackイベントのClaudeタスクはすでに作成済みです。"
          : "Claudeにも反論・検証させたうえで実装を開始しました。",
        `Draft PR: ${delegation.prUrl}`,
        "本番マージ・公開は自動では行いません。",
      ].join("\n"),
    });
  } catch {
    await postSlackMessage({
      token: botToken,
      channel: event.channel,
      threadTs,
      text: "War Room処理でエラーが発生しました。自動実行は継続していません。GitHub / Observer側を確認します。",
    }).catch(() => undefined);
  }
}

export async function POST(request: Request) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const rawBody = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp");
  const signature = request.headers.get("x-slack-signature");

  if (
    !verifySlackSignature({
      rawBody,
      timestamp,
      signature,
      signingSecret,
    })
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let envelope: SlackEventEnvelope;
  try {
    envelope = JSON.parse(rawBody) as SlackEventEnvelope;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (envelope.type === "url_verification") {
    return NextResponse.json({ challenge: envelope.challenge ?? "" });
  }

  if (request.headers.get("x-slack-retry-num")) {
    return NextResponse.json({ ok: true });
  }

  if (envelope.type !== "event_callback" || envelope.event?.type !== "app_mention") {
    return NextResponse.json({ ok: true });
  }

  const event = envelope.event;
  const allowedChannel =
    process.env.SLACK_WAR_ROOM_CHANNEL_ID || DEFAULT_WAR_ROOM_CHANNEL;

  if (
    event.channel !== allowedChannel ||
    event.bot_id ||
    event.subtype
  ) {
    return NextResponse.json({ ok: true });
  }

  after(async () => {
    await processMention(envelope);
  });

  return NextResponse.json({ ok: true });
}
