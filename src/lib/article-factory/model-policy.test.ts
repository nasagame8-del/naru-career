import { describe, expect, it } from "vitest";
import {
  DEFAULT_ARTICLE_FACTORY_MODEL,
  DEFAULT_ARTICLE_FACTORY_MODEL_LIGHT,
  resolveArticleFactoryModels,
} from "./model-policy";
import { isPermanentLlmErrorMessage } from "./llm-policy";

describe("Article Factory model policy", () => {
  it("keeps the premium model for writing and defaults other work to a mini model", () => {
    expect(resolveArticleFactoryModels({})).toEqual({
      primary: DEFAULT_ARTICLE_FACTORY_MODEL,
      light: DEFAULT_ARTICLE_FACTORY_MODEL_LIGHT,
      research: DEFAULT_ARTICLE_FACTORY_MODEL_LIGHT,
    });
  });

  it("does not inherit the premium model into the light slot", () => {
    expect(resolveArticleFactoryModels({ ARTICLE_FACTORY_MODEL: "gpt-5.5" })).toEqual({
      primary: "gpt-5.5",
      light: DEFAULT_ARTICLE_FACTORY_MODEL_LIGHT,
      research: DEFAULT_ARTICLE_FACTORY_MODEL_LIGHT,
    });
  });

  it("supports independent overrides for every workload", () => {
    expect(
      resolveArticleFactoryModels({
        ARTICLE_FACTORY_MODEL: "writer-model",
        ARTICLE_FACTORY_MODEL_LIGHT: "light-model",
        ARTICLE_FACTORY_MODEL_RESEARCH: "research-model",
      })
    ).toEqual({
      primary: "writer-model",
      light: "light-model",
      research: "research-model",
    });
  });

  it("ignores blank overrides", () => {
    expect(
      resolveArticleFactoryModels({
        ARTICLE_FACTORY_MODEL: "  ",
        ARTICLE_FACTORY_MODEL_LIGHT: "",
        ARTICLE_FACTORY_MODEL_RESEARCH: "  ",
      })
    ).toEqual({
      primary: DEFAULT_ARTICLE_FACTORY_MODEL,
      light: DEFAULT_ARTICLE_FACTORY_MODEL_LIGHT,
      research: DEFAULT_ARTICLE_FACTORY_MODEL_LIGHT,
    });
  });
});

describe("permanent LLM errors", () => {
  it.each([
    "429 You have no credits remaining. Add credits to continue using the API",
    "insufficient_quota",
    "Billing hard limit has been reached",
    "You exceeded your current quota",
    "Incorrect API key provided",
    "OPENAI_API_KEY が未設定です",
  ])("stops immediately for %s", (message) => {
    expect(isPermanentLlmErrorMessage(message)).toBe(true);
  });

  it.each([
    "429 rate limit exceeded; retry later",
    "503 service unavailable",
    "ETIMEDOUT",
  ])("keeps transient errors retryable for %s", (message) => {
    expect(isPermanentLlmErrorMessage(message)).toBe(false);
  });
});
