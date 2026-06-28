import { describe, expect, it } from "vitest";

import {
  applyEditorPanePreset,
  clampEditorPanePrefsForNotesAvailability,
  DEFAULT_EDITOR_VISIBLE_PANES,
  focusEditorPane,
  focusOrToggleEditorPane,
  hideEditorPane,
  matchingEditorPanePreset,
  migrateLegacyPanePrefs,
  normalizeEditorVisiblePanes,
  reconcileActiveEditorPane,
  shouldSyncDocumentOutlineForPanes,
  toggleEditorPane,
} from "@/lib/editorVisiblePanes";

describe("toggleEditorPane", () => {
  it("keeps at least one pane visible", () => {
    const onlyOutline = { outline: true, draft: false, notes: false };
    expect(toggleEditorPane(onlyOutline, "outline")).toEqual(onlyOutline);
  });

  it("allows two panes", () => {
    expect(toggleEditorPane(DEFAULT_EDITOR_VISIBLE_PANES, "notes", "outline")).toEqual({
      outline: true,
      draft: false,
      notes: true,
    });
  });

  it("drops the non-active pane when enabling a third", () => {
    expect(toggleEditorPane(DEFAULT_EDITOR_VISIBLE_PANES, "notes", "draft")).toEqual({
      outline: false,
      draft: true,
      notes: true,
    });
  });
});

describe("focusEditorPane", () => {
  it("focuses a visible pane", () => {
    const visible = { outline: true, draft: true, notes: false };
    expect(focusEditorPane(visible, "outline", "draft")).toEqual({
      visible,
      active: "outline",
    });
  });

  it("shows and focuses a hidden pane", () => {
    expect(
      focusEditorPane({ outline: true, draft: false, notes: false }, "draft", "outline"),
    ).toEqual({
      visible: { outline: true, draft: true, notes: false },
      active: "draft",
    });
  });
});

describe("hideEditorPane", () => {
  it("hides a visible pane when another remains", () => {
    expect(hideEditorPane(DEFAULT_EDITOR_VISIBLE_PANES, "outline", "outline")).toEqual({
      visible: { outline: false, draft: true, notes: false },
      active: "draft",
    });
  });

  it("does not hide the last visible pane", () => {
    const onlyDraft = { outline: false, draft: true, notes: false };
    expect(hideEditorPane(onlyDraft, "draft", "draft")).toEqual({
      visible: onlyDraft,
      active: "draft",
    });
  });
});

describe("normalizeEditorVisiblePanes", () => {
  it("collapses three visible panes to two", () => {
    expect(
      normalizeEditorVisiblePanes({ outline: true, draft: true, notes: true }),
    ).toEqual({
      outline: true,
      draft: true,
      notes: false,
    });
  });
});

describe("editor pane presets", () => {
  it("applies split preset", () => {
    expect(applyEditorPanePreset("split", true)).toEqual({
      visible: { outline: true, draft: true, notes: false },
      active: "draft",
    });
  });

  it("falls back when notes preset is unavailable", () => {
    expect(applyEditorPanePreset("write", false)).toEqual({
      visible: { outline: true, draft: true, notes: false },
      active: "draft",
    });
  });

  it("matches write preset regardless of focused pane", () => {
    expect(
      matchingEditorPanePreset(
        { outline: false, draft: true, notes: true },
        "draft",
        true,
      ),
    ).toBe("write");
    expect(
      matchingEditorPanePreset(
        { outline: false, draft: true, notes: true },
        "notes",
        true,
      ),
    ).toBe("write");
  });
});

describe("clampEditorPanePrefsForNotesAvailability", () => {
  it("maps write preset to split when notes are unavailable", () => {
    expect(
      clampEditorPanePrefsForNotesAvailability(
        { outline: false, draft: true, notes: true },
        "notes",
        false,
      ),
    ).toEqual({
      visible: { outline: true, draft: true, notes: false },
      active: "draft",
    });
  });
});

describe("migrateLegacyPanePrefs", () => {
  it("maps split + notes strip to draft and notes", () => {
    expect(migrateLegacyPanePrefs("split", true)).toEqual({
      outline: false,
      draft: true,
      notes: true,
    });
  });
});

describe("shouldSyncDocumentOutlineForPanes", () => {
  it("syncs draft when draft pane is visible, otherwise outline", () => {
    expect(
      shouldSyncDocumentOutlineForPanes({ outline: true, draft: false, notes: false }, "outline"),
    ).toBe(true);
    expect(
      shouldSyncDocumentOutlineForPanes({ outline: true, draft: false, notes: false }, "draft"),
    ).toBe(false);
    expect(
      shouldSyncDocumentOutlineForPanes({ outline: true, draft: true, notes: false }, "draft"),
    ).toBe(true);
    expect(
      shouldSyncDocumentOutlineForPanes({ outline: true, draft: true, notes: false }, "outline"),
    ).toBe(false);
    expect(
      shouldSyncDocumentOutlineForPanes({ outline: false, draft: true, notes: true }, "draft"),
    ).toBe(true);
    expect(
      shouldSyncDocumentOutlineForPanes({ outline: false, draft: true, notes: true }, "notes"),
    ).toBe(false);
  });
});

describe("focusOrToggleEditorPane", () => {
  it("focuses a visible pane without hiding it", () => {
    const visible = { outline: true, draft: true, notes: false };
    expect(focusOrToggleEditorPane(visible, "outline", "draft")).toEqual({
      visible,
      active: "outline",
    });
  });

  it("hides a focused visible pane", () => {
    expect(focusOrToggleEditorPane(DEFAULT_EDITOR_VISIBLE_PANES, "outline", "outline")).toEqual({
      visible: { outline: false, draft: true, notes: false },
      active: "draft",
    });
  });

  it("shows a hidden pane", () => {
    expect(
      focusOrToggleEditorPane(
        { outline: true, draft: false, notes: false },
        "draft",
        "outline",
      ),
    ).toEqual({
      visible: { outline: true, draft: true, notes: false },
      active: "draft",
    });
  });
});

describe("reconcileActiveEditorPane", () => {
  it("moves focus to a visible pane", () => {
    expect(
      reconcileActiveEditorPane({ outline: false, draft: true, notes: true }, "outline"),
    ).toBe("draft");
  });
});
