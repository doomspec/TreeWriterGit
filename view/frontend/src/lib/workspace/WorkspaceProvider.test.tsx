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
      result.current.setSidebarPanel("papers");
    });
    expect(result.current.sidebarPanelOpen).toBe(false);
    act(() => {
      result.current.setSidebarPanel("outline");
    });
    expect(result.current.sidebarPanel).toBe("outline");
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
});
