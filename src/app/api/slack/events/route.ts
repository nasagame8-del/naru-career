import { after, NextResponse } from "next/server";

import { buildDriveContextFromText } from "@/lib/war-room/drive";
import { delegateToClaude, githubDelegationReady } from "@/lib/war-room/github";
import { planWarRoomMessage } from "@/lib/war-room/planner";
import {
  postSlackMessage,
  stripSlackMention,
  type SlackEventEnvelope,
  verifySlackSignature,
} from "@/lib/war-room/slack";
import { fetchThreadContext } from "@/lib/war-room/thread";

export const runtime = "nodejs";

const DEFAULT_WAR_ROOM_CHANNEL = "C0C71TPTSHW";

async function processMessage(
  envelope: SlackEventEnvelope,
  vercelOidcToken?: string
): Promise<void> {
  const event = envelope.event;
  if (!event) return;

  const botToken = process.env.SLACK_CHATGPT_BOT_TOKEN;
  if (!botToken) return;

  const threadTs = event.thread_ts || event.ts;
  const userText = stripSlackMention(event.text);
  const explicitlyAddressedClaude =
    /(?:^|\s)(?:claude|クロード)(?:\s|$)/i.test(userText) ||
    event.text.includes("<@U0C66M6ASLW>");

  if (!userText) {
    await postSlackMessage({
      token: botToken,
      channel: event.channel,
      threadTs,
      text: "相談内容を書いてください。",
    });
    return;
  }

  const directClaudeMention = event.text.includes("<@U0C66M6ASLW>");

  if (directClaudeMention) {
    try {
      if (!githubDelegationReady() || !envelope.event_id) return;

      const threadContext = await fetchThreadContext({
        token: botToken,
        channel: event.channel,
        threadTs,
        currentMessageTs: event.ts,
      }).catch(() => "");

      const drive = await buildDriveContextFromText(
        [event.text, threadContext].filter(Boolean).join("\n"),
        { vercelOidcToken }
      );

      const sharedContext = [
        drive.context ? `## Google Drive context\n${drive.context}` : "",
        drive.warning ? `## Drive access note\n${drive.warning}` : "",
        threadContext ? `## Slack thread context\n${threadContext}` : "",
      ]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 18000);

      await delegateToClaude({
        eventId: envelope.event_id,
        slackChannel: event.channel,
        slackTs: threadTs,
        userRequest: userText,
        chatgptPosition:
          "DIRECT_CLAUDE_NO_REVIEW: This is a direct request from the Slack user. There is no ChatGPT proposal to debate.",
        claudeInstruction: [
          "ユーザーからClaudeへの直接依頼です。ChatGPTの返答を待たず、ユーザー本人に直接回答してください。",
          "実装や編集を明示的に頼まれていない場合は、回答だけ行い、不要な変更はしないでください。",
          sharedContext
            ? "\n同じSlackスレッドと参照Driveの共有コンテキストです。必要な範囲だけ根拠として使ってください。\n" + sharedContext
            : "",
          "\nREPORT.mdにはSlackへ返す日本語回答を '## Slack reply' 見出しで必ず記載してください。",
        ].join("\n"),
      });
    } catch {
      // Direct-Claude mode stays silent on the ChatGPT identity.
    }
    return;
  }

  try {
    await postSlackMessage({
      token: botToken,
      channel: event.channel,
      threadTs,
      text: "受信しました。スレッドと参照資料を確認し、必要ならClaudeへ自動で回します。",
    });

    const threadContext = await fetchThreadContext({
      token: botToken,
      channel: event.channel,
      threadTs,
      currentMessageTs: event.ts,
    }).catch(() => "");

    const drive = await buildDriveContextFromText(
      [event.text, threadContext].filter(Boolean).join("\n"),
      { vercelOidcToken }
    );

    let plan = await planWarRoomMessage({
      userText,
      threadContext,
      driveContext: drive.context,
      driveWarning: drive.warning,
    });

    if (explicitlyAddressedClaude && plan.mode !== "delegate") {
      plan = {
        mode: "delegate" as const,
        reply: "Claudeへの直接依頼として受け取りました。Claude本人に回答させます。",
        claude_instruction: userText,
      };
    }

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
          "Claudeとの議論・実装を開始しようとしましたが、GitHub委譲用の実行権限が未設定です。ChatGPTとの会話はこのまま使えます。",
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

    const sharedContext = [
      drive.context ? `## Google Drive context\n${drive.context}` : "",
      drive.warning ? `## Drive access note\n${drive.warning}` : "",
      threadContext ? `## Slack thread context\n${threadContext}` : "",
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 18000);

    const delegation = await delegateToClaude({
      eventId: envelope.event_id,
      slackChannel: event.channel,
      slackTs: threadTs,
      userRequest: userText,
      chatgptPosition: plan.reply,
      claudeInstruction: [
        plan.claude_instruction,
        sharedContext
          ? "\nShared context from the same Slack thread and referenced Drive material follows. Use it as evidence; do not claim it was unavailable.\n" + sharedContext
          : "",
        "\nFinish with a concise Japanese section headed exactly '## Slack reply' in REPORT.md so the War Room can display your actual response.",
      ].join("\n"),
    });

    await postSlackMessage({
      token: botToken,
      channel: event.channel,
      threadTs,
      text: [
        plan.reply,
        "",
        drive.linksFound > 0 && drive.context
          ? "参照されたGoogle Drive資料も読み込んでClaudeへ共有しました。"
          : "",
        delegation.reused
          ? "同じSlackイベントのClaudeタスクはすでに作成済みです。"
          : "Claudeにも反論・検証させたうえで実装を開始しました。",
        `Draft PR: ${delegation.prUrl}`,
        "本番マージ・公開は自動では行いません。",
      ]
        .filter(Boolean)
        .join("\n"),
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

  if (
    envelope.type !== "event_callback" ||
    !envelope.event ||
    !["app_mention", "message"].includes(envelope.event.type)
  ) {
    return NextResponse.json({ ok: true });
  }

  const event = envelope.event;
  const allowedChannel =
    process.env.SLACK_WAR_ROOM_CHANNEL_ID || DEFAULT_WAR_ROOM_CHANNEL;

  const chatgptBotUserId =
    process.env.SLACK_CHATGPT_BOT_USER_ID || "U0C66MEQJ06";

  if (
    event.channel !== allowedChannel ||
    event.bot_id ||
    event.subtype ||
    (event.type === "message" &&
      event.text.includes(`<@${chatgptBotUserId}>`))
  ) {
    return NextResponse.json({ ok: true });
  }

  const vercelOidcToken =
    request.headers.get("x-vercel-oidc-token") || undefined;

  after(async () => {
    await processMessage(envelope, vercelOidcToken);
  });

  return NextResponse.json({ ok: true });
}
