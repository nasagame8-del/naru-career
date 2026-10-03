import { describe, expect, it } from "vitest";

import { driveCollectionPriority, extractDriveTargets } from "./drive";

describe("extractDriveTargets", () => {
  it("extracts folder and Google Docs IDs without duplicates", () => {
    const result = extractDriveTargets(
      [
        "https://drive.google.com/drive/folders/folder_ABC-123",
        "https://docs.google.com/document/d/doc_XYZ-789/edit",
        "https://drive.google.com/drive/folders/folder_ABC-123",
      ].join(" ")
    );

    expect(result).toEqual([
      { id: "folder_ABC-123", kind: "folder" },
      { id: "doc_XYZ-789", kind: "file" },
    ]);
  });

  it("prioritizes article bodies over image planning files for collection sampling", () => {
    expect(driveCollectionPriority("article.md")).toBeLessThan(
      driveCollectionPriority("image-plan.md")
    );
    expect(driveCollectionPriority("article-run｜NARU-055")).toBeLessThan(
      driveCollectionPriority("image-prompts.md")
    );
  });

  it("returns an empty list when no Drive link exists", () => {
    expect(extractDriveTargets("普通のSlackメッセージ")).toEqual([]);
  });
});
