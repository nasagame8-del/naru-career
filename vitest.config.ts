import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Article Factory の純粋な安全判定ロジック向けのユニットテスト設定。
 *
 * ここでは Workflow SDK のプラグインを読み込まない。
 * "use workflow" / "use step" はコンパイラ無しでは no-op であり、
 * step 関数は普通の関数としてテストできる。
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
