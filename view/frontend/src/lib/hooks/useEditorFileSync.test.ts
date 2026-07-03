/** @vitest-environment happy-dom */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("@/lib/draftApproval", () => ({
  loadDraftApprovalState: vi.fn(),
  loadModelFileContent: vi.fn(),
}));

import { loadDraftApprovalState, loadModelFileContent } from "@/lib/draftApproval";
import { useEditorFileSync } from "@/lib/hooks/useEditorFileSync";

function setupHook(overrides: Partial<Parameters<typeof useEditorFileSync>[0]> = {}) {
  const isDirtyRef = { current: false };
  const loadedContentRef = { current: "" };
  const approvedBaselineRef = { current: null as string | null };
  const dispatchSnapshotRef = { current: null as string | null };
  const setApprovedBaseline = vi.fn((v: string | null) => {
    approvedBaselineRef.current = v;
  });
  const setLoadedContent = vi.fn((v: string) => {
    loadedContentRef.current = v;
  });

  const props = {
    filePath: "papers/demo/u1/draft.md",
    refreshVersion: 0,
    pathVersion: 0,
    requiresApproval: true,
    isDirtyRef,
    loadedContentRef,
    approvedBaselineRef,
    dispatchSnapshotRef,
    resetHistory: vi.fn(),
    setLoadedContent,
    setApprovedBaseline,
    setEditMeta: vi.fn(),
    setPendingSource: vi.fn(),
    setSaveState: vi.fn(),
    setLoadError: vi.fn(),
    ...overrides,
  };

  const { rerender } = renderHook((p) => useEditorFileSync(p), { initialProps: props });
  return { props, rerender, setApprovedBaseline, setLoadedContent, approvedBaselineRef, loadedContentRef };
}

describe("useEditorFileSync", () => {
  beforeEach(() => {
    vi.mocked(loadDraftApprovalState).mockResolvedValue({
      content: "",
      meta: {
        editedBy: "codex",
        editedAt: "2026-01-01T00:00:00.000Z",
        aiAssisted: true,
        aiProvider: "codex",
        approvedBy: null,
        approvedAt: null,
        contentHash: null,
        gitCommit: null,
        approvers: [],
      },
    });
  });

  it("freezes the pre-change content as approvedBaseline on the first externally-arriving pending edit for a never-approved unit", async () => {
    vi.mocked(loadModelFileContent).mockResolvedValue("Fresh AI text, never approved.\n");
    const { setApprovedBaseline, approvedBaselineRef } = setupHook();

    await waitFor(() => {
      expect(setApprovedBaseline).toHaveBeenCalledWith("");
    });
    expect(approvedBaselineRef.current).toBe("");
  });

  it("does not overwrite an already-established approved baseline with the pre-change content", async () => {
    // Default beforeEach mock reports approvedAt: null (never approved), which
    // makes the unrelated first effect legitimately call setApprovedBaseline(null) —
    // what matters here is that the content-sync effect's freeze logic never
    // fires when a real baseline ref is already set.
    vi.mocked(loadModelFileContent).mockResolvedValue("New AI text.\n");
    const { setApprovedBaseline } = setupHook({
      approvedBaselineRef: { current: "Approved text.\n" },
      loadedContentRef: { current: "Old session content.\n" },
    });

    await waitFor(() => {
      expect(loadModelFileContent).toHaveBeenCalled();
    });
    expect(setApprovedBaseline).not.toHaveBeenCalledWith("Old session content.\n");
  });

  it("does not freeze a baseline when disk content is unchanged from what was already loaded", async () => {
    vi.mocked(loadModelFileContent).mockResolvedValue("Same content.\n");
    const { setApprovedBaseline } = setupHook({
      loadedContentRef: { current: "Same content.\n" },
    });

    await waitFor(() => {
      expect(loadModelFileContent).toHaveBeenCalled();
    });
    expect(setApprovedBaseline).not.toHaveBeenCalledWith("Same content.\n");
  });
});
