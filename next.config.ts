import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Vercelではoutput: "export"不要。SSG/ISRはネイティブサポート */
};

/**
 * withWorkflow() により "use workflow" / "use step" ディレクティブが有効になる。
 * Article Factory の耐久実行（ブラウザを閉じても継続）に必要。
 */
export default withWorkflow(nextConfig);
