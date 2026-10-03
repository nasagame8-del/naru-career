import OpenAI from "openai";

export type WarRoomMode = "answer" | "delegate" | "human";

export interface WarRoomPlan {
  mode: WarRoomMode;
  reply: string;
  claude_instruction: string;
}

const schema = {
  type: "object",
  properties: {
    mode: { type: "string", enum: ["answer", "delegate", "human"] },
    reply: { type: "string" },
    claude_instruction: { type: "string" },
  },
  required: ["mode", "reply", "claude_instruction"],
  additionalProperties: false,
} as const;

const instructions = [
  "あなたはNARU War RoomのChatGPT司会役です。",
  "入力には現在のSlack発言、同じSlackスレッドの直近文脈、参照されたGoogle Drive資料が含まれることがあります。",
  "スレッド文脈やDrive資料がある場合は必ず参照し、『前の発言は見えない』『Driveを直接確認できない』とは答えないでください。",
  "通常の質問・意見交換は answer。",
  "明示的にClaudeとの相談・議論・実装を求められた場合、またはNARUのrepo/site/code/SEO実装が必要な場合は delegate。",
  "merge、production deploy、破壊的削除、認証情報操作、不可逆で曖昧な判断は human。",
  "delegateでは、まずChatGPT自身の見解をreplyに簡潔に示し、claude_instructionにはClaudeがその見解へ反論・検証してから安全な範囲で実装するための具体的指示を書く。",
  "本番merge/deployを許可しない。既存のNARU安全ゲートを迂回しない。",
  "OpenAI/Anthropicを含む外部有料APIをClaudeに新規利用させない。",
  "claude_instructionはdelegate以外では必ず空文字。",
  "出力は指定されたJSON Schemaだけに従う。",
].join("\n");

export async function planWarRoomMessage(input: {
  userText: string;
  threadContext?: string;
  driveContext?: string;
  driveWarning?: string;
}): Promise<WarRoomPlan> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const client = new OpenAI({ apiKey });
  const prompt = [
    "## Current Slack message",
    input.userText.slice(0, 4000),
    "",
    "## Slack thread context (oldest to newest)",
    (input.threadContext || "(none)").slice(-8000),
    "",
    "## Google Drive context",
    (input.driveContext || "(none)").slice(0, 14000),
    input.driveWarning ? `Drive access note: ${input.driveWarning}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.responses.create({
    model: process.env.WAR_ROOM_OPENAI_MODEL || "gpt-6-luna",
    instructions,
    input: prompt,
    reasoning: { effort: "none" },
    max_output_tokens: 450,
    store: false,
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "naru_war_room_plan",
        strict: true,
        schema,
      },
    },
  });

  if (!response.output_text) {
    throw new Error("War Room planner returned no output");
  }

  const parsed = JSON.parse(response.output_text) as WarRoomPlan;
  if (!["answer", "delegate", "human"].includes(parsed.mode)) {
    throw new Error("War Room planner returned an invalid mode");
  }
  if (parsed.mode !== "delegate") parsed.claude_instruction = "";
  return parsed;
}
