/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useDocumentEditor } from "@/lib/hooks/useDocumentEditor";

describe("useDocumentEditor", () => {
  it("tracks content edits and dirty state", () => {
    const saveContent = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDocumentEditor({
        sessionKey: "test-session",
        targetPath: "papers/demo/sections/intro",
        loadedContent: "hello",
        setLoadedContent: vi.fn(),
        approvedBaseline: "hello",
        setApprovedBaseline: vi.fn(),
        saveContent,
      }),
    );

    expect(result.current.content).toBe("");
    act(() => {
      result.current.setContent("hello world");
    });
    expect(result.current.isDirty).toBe(true);
  });
});
