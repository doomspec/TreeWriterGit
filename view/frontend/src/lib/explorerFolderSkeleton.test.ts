import { describe, expect, it } from "vitest";

import {
  explorerFolderIndexContent,
  explorerFolderOutlineContent,
} from "@/lib/explorerFolderSkeleton";

describe("explorerFolderSkeleton", () => {
  it("creates index and outline skeletons", () => {
    expect(explorerFolderIndexContent("my-notes")).toContain("title: My Notes");
    expect(explorerFolderOutlineContent("my-notes")).toContain("# My Notes");
  });
});
