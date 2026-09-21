/**
 * OpenAI Structured Outputs の共通ラッパー。
 *
 * scripts/proofread.js と同じ Responses API + strict JSON Schema 方式。
 * 自由形式の文章をパースして処理しない。
 *
 * Prompt / Input / Schema / Output を明確に分離するため、
 * 各Phaseは runStructured() に4つを渡すだけにする。
 */

import OpenAI from "openai";
import { SEO_EDITOR_MODEL } from "./config";
import type { SeoUsage } from "@/types/seo-editor";

export class SeoEditorError extends Error {
  readonly kind: "config" | "openai" | "schema" | "validation";
  constructor(kind: SeoEditorError["kind"], message: string) {
    super(message);
    this.name = "SeoEditorError";
    this.kind = kind;
  }
}

export interface StructuredCall<T> {
  /** JSON Schema の name（英小文字とアンダースコア） */
  name: string;
  /** system instruction。untrustedなデータを絶対に含めない */
  instructions: string;
  /** user メッセージ。untrustedなデータはここにタグ付きで入れる */
  input: string;
  /** strict: true で通る JSON Schema */
  schema: Record<string, unknown>;
  model?: string;
  /** 形が想定どおりか最低限の検証。falseを返すとschemaエラー扱い */
  validate?: (value: unknown) => value is T;
}

export interface StructuredResult<T> {
  data: T;
  usage: SeoUsage;
}

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new SeoEditorError("config", "OPENAI_API_KEY が未設定です");
  }
  return new OpenAI();
}

/** OpenAIのエラーメッセージから秘密情報が漏れないようにする */
function safeErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const redacted = raw.replace(/sk-[A-Za-z0-9_-]{10,}/g, "sk-***");
  return redacted.slice(0, 300);
}

export async function runStructured<T>(call: StructuredCall<T>): Promise<StructuredResult<T>> {
  const client = getClient();
  const model = call.model || SEO_EDITOR_MODEL;

  let response;
  try {
    response = await client.responses.parse({
      model,
      instructions: call.instructions,
      input: [{ role: "user", content: call.input }],
      text: {
        format: {
          type: "json_schema",
          name: call.name,
          schema: call.schema,
          strict: true,
        },
      },
    });
  } catch (e) {
    throw new SeoEditorError("openai", `OpenAI APIエラー: ${safeErrorMessage(e)}`);
  }

  let parsed: unknown = response.output_parsed ?? null;
  if (parsed === null) {
    // parse に失敗した場合のフォールバック（proofread.js と同じ扱い）
    const text = response.output_text;
    if (!text) {
      throw new SeoEditorError("schema", "Structured Outputが返りませんでした");
    }
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new SeoEditorError("schema", "Structured Outputが不正なJSONでした");
    }
  }

  if (call.validate && !call.validate(parsed)) {
    throw new SeoEditorError("schema", `Structured Outputの形が想定と異なります (${call.name})`);
  }

  const usage: SeoUsage = {
    model,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens ?? 0,
  };

  return { data: parsed as T, usage };
}

/** JSON Schema を書くときの定型（strict: true では additionalProperties: false と required 全指定が必須） */
export function obj(
  properties: Record<string, unknown>,
  opts?: { required?: string[] }
): Record<string, unknown> {
  return {
    type: "object",
    properties,
    required: opts?.required ?? Object.keys(properties),
    additionalProperties: false,
  };
}

export function arr(items: unknown): Record<string, unknown> {
  return { type: "array", items };
}

export const str = { type: "string" } as const;
export const num = { type: "number" } as const;
export const bool = { type: "boolean" } as const;
export const strArr = { type: "array", items: { type: "string" } } as const;

export function enumStr(values: readonly string[]): Record<string, unknown> {
  return { type: "string", enum: [...values] };
}

/** strict mode では nullable は anyOf ではなく type 配列で表す */
export function nullableStr(): Record<string, unknown> {
  return { type: ["string", "null"] };
}

export function nullableNum(): Record<string, unknown> {
  return { type: ["number", "null"] };
}

export const CONFIDENCE_ENUM = ["low", "medium", "high"] as const;
