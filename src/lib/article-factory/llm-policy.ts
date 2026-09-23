/** OpenAIへ再試行しても解消しない課金・認証エラーを判定する純粋関数。 */
export function isPermanentLlmErrorMessage(message: string): boolean {
  return /(?:no\s+credits?\s+remaining|insufficient[_\s-]*quota|billing[_\s-]*(?:hard[_\s-]*)?limit|exceeded\s+your\s+current\s+quota|account\s+is\s+not\s+active|invalid[_\s-]*api[_\s-]*key|incorrect\s+api\s+key|OPENAI_API_KEY.*未設定|OPENAI_API_KEY\s+is\s+missing)/i.test(
    message
  );
}
