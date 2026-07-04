/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useWorkspace } from "@/lib/workspace/WorkspaceProvider";
import { useWorkspaceLayout } from "@/lib/workspace/WorkspaceLayoutContext";
import { useWorkspaceNavigationContext } from "@/lib/workspace/WorkspaceNavigationContext";
import { renderWorkspaceHook } from "@/test/renderHook";

vi.mock("@/lib/api/commentsApi", () => ({
  fetchCommentSummary: vi.fn().mockResolvedValue({
    unresolved: 0,
    total: 0,
    assigned: 0,
    assignedUnresolved: 0,
  }),
  fetchAssignedComments: vi.fn().mockResolvedValue({ comments: [] }),
}));

vi.mock("@/modelApi", () => ({
  fetchModelTree: vi.fn().mockResolvedValue({ tree: [], treeVersion: 0, root: "model" }),
  createNode: vi.fn(),
}));

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  readyState = MockWebSocket.CONNECTING;
  addEventListener = vi.fn();
  close = vi.fn();
}

vi.stubGlobal("WebSocket", MockWebSocket);

describe("WorkspaceProvider", () => {
  it("provides default root shell state", async () => {
    const { result } = renderWorkspaceHook(() => useWorkspace());
    expect(result.current.appView).toBe("workspace");
    expect(result.current.error).toBeNull();
  });

  it("toggles sidebar panel when selecting the same rail icon", async () => {
    const { result } = renderWorkspaceHook(() => useWorkspaceNavigationContext());
    expect(result.current.sidebarPanelOpen).toBe(true);
    act(() => {
      result.current.setSidebarPanel("paperInfo");
    });
    expect(result.current.sidebarPanelOpen).toBe(false);
    act(() => {
      result.current.setSidebarPanel("graph");
    });
    expect(result.current.sidebarPanel).toBe("graph");
    expect(result.current.sidebarPanelOpen).toBe(true);
  });

  it("updates layout context when sidebar width changes", async () => {
    const { result } = renderWorkspaceHook(() => useWorkspaceLayout());
    const initial = result.current.sidebarWidth;
    act(() => {
      result.current.setSidebarWidth(420);
    });
    expect(result.current.sidebarWidth).toBe(420);
    expect(result.current.sidebarWidth).not.toBe(initial);
  });

  it("cycles sidebar layout collapsed → expanded → pinned → collapsed", async () => {
    const { result } = renderWorkspaceHook(() => useWorkspaceNavigationContext());
    expect(result.current.sidebarPanelOpen).toBe(true);
    expect(result.current.sidebarPinned).toBe(true);

    act(() => {
      result.current.cycleSidebarPanelLayout();
    });
    expect(result.current.sidebarPanelOpen).toBe(false);
    expect(result.current.sidebarPinned).toBe(false);

    act(() => {
      result.current.cycleSidebarPanelLayout();
    });
    expect(result.current.sidebarPanelOpen).toBe(true);
    expect(result.current.sidebarPinned).toBe(false);

    act(() => {
      result.current.cycleSidebarPanelLayout();
    });
    expect(result.current.sidebarPanelOpen).toBe(true);
    expect(result.current.sidebarPinned).toBe(true);
  });

  it("keeps assistant Skills and Terminal sections mutually exclusive", async () => {
    const { result } = renderWorkspaceHook(() => useWorkspaceLayout());

    expect(result.current.aiPanelTerminalOpen).toBe(true);
    expect(result.current.aiPanelSkillsOpen).toBe(false);

    act(() => {
      result.current.setAiPanelSkillsOpen(true);
    });
    expect(result.current.aiPanelSkillsOpen).toBe(true);
    expect(result.current.aiPanelTerminalOpen).toBe(false);

    act(() => {
      result.current.setAiPanelTerminalOpen(true);
    });
    expect(result.current.aiPanelTerminalOpen).toBe(true);
    expect(result.current.aiPanelSkillsOpen).toBe(false);
  });
});
