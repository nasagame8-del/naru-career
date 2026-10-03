const MAX_THREAD_MESSAGES = 20;
const MAX_CONTEXT_CHARS = 8000;

interface SlackMessage {
  user?: string;
  bot_id?: string;
  text?: string;
  ts?: string;
  subtype?: string;
}

interface SlackRepliesResponse {
  ok?: boolean;
  error?: string;
  messages?: SlackMessage[];
}

export function formatThreadContext(
  messages: SlackMessage[],
  currentMessageTs?: string
): string {
  return messages
    .filter((message) => message.text && !message.subtype)
    .slice(-MAX_THREAD_MESSAGES)
    .map((message) => {
      const speaker = message.bot_id
        ? "bot"
        : message.user
          ? `user:${message.user}`
          : "unknown";
      const marker = message.ts === currentMessageTs ? "current" : "prior";
      const text = (message.text ?? "").replace(/\s+/g, " ").trim();
      return `[${marker}][${speaker}] ${text}`;
    })
    .join("\n")
    .slice(-MAX_CONTEXT_CHARS);
}

export async function fetchThreadContext(input: {
  token: string;
  channel: string;
  threadTs: string;
  currentMessageTs?: string;
}): Promise<string> {
  const url = new URL("https://slack.com/api/conversations.replies");
  url.searchParams.set("channel", input.channel);
  url.searchParams.set("ts", input.threadTs);
  url.searchParams.set("limit", String(MAX_THREAD_MESSAGES));

  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${input.token}` },
    cache: "no-store",
  });

  const body = (await response.json()) as SlackRepliesResponse;
  if (!response.ok || !body.ok) {
    throw new Error(`Slack thread read failed: ${body.error ?? response.status}`);
  }

  return formatThreadContext(body.messages ?? [], input.currentMessageTs);
}
