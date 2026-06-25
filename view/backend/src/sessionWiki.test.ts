import { describe, expect, it } from "vitest";

import {
  appendSessionWikiEntry,
  listSessionWikiEntries,
  sessionFilenameFromId,
  sessionIdFromAt,
  sessionMatchesUnitFilter,
  updateSessionWikiEntry,
} from "./sessionWiki.js";

describe("sessionWiki", () => {
  it("derives stable session ids from timestamps", () => {
    expect(sessionIdFromAt("2026-06-23T04:35:14.886Z")).toBe("2026-06-23_04-35-14-886Z");
    expect(sessionFilenameFromId("2026-06-23_04-35-14-886Z")).toBe("2026-06-23_04-35-14-886Z.md");
  });

  it("matches descendant unit sessions when filtering by container path", () => {
    expect(
      sessionMatchesUnitFilter(
        "papers/vibecount/introduction/background",
        "papers/vibecount/introduction",
      ),
    ).toBe(true);
    expect(sessionMatchesUnitFilter("papers/vibecount/abstract", "papers/vibecount")).toBe(true);
    expect(
      sessionMatchesUnitFilter("papers/vibecount/introduction/background", "papers/vibecount/results"),
    ).toBe(false);
  });
});

describe("sessionWiki integration", () => {
  it("roundtrips append, list, and update", async () => {
    const { mkdtemp, mkdir, rm, readFile } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");
    const matter = (await import("gray-matter")).default;

    const modelRoot = await mkdtemp(path.join(tmpdir(), "tw-wiki-"));
    const unitPath = "papers/demo/unit-a";
    await mkdir(path.join(modelRoot, unitPath), { recursive: true });

    const created = await appendSessionWikiEntry(modelRoot, unitPath, {
      at: "2026-06-18T12:00:00.000Z",
      provider: "Claude",
      action: "draft",
      command: "claude -p hi",
      status: "dispatched",
    });

    expect(created.wikiPath).toBe("papers/demo/notes/sessions/2026-06-18.md");
    const listed = await listSessionWikiEntries(modelRoot, unitPath);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.command).toBe("claude -p hi");

    await updateSessionWikiEntry(modelRoot, unitPath, created.id, "complete");
    const updated = await listSessionWikiEntries(modelRoot, unitPath);
    expect(updated[0]?.status).toBe("complete");

    const raw = await readFile(path.join(modelRoot, created.wikiPath), "utf8");
    expect(matter(raw).data.kind).toBe("llm-wiki-day");

    await rm(modelRoot, { recursive: true, force: true });
  });
});
