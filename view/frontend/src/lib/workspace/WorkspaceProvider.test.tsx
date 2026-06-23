/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import { useWorkspace } from "@/lib/workspace/WorkspaceProvider";
import { renderWorkspaceHook } from "@/test/renderHook";

vi.mock("@/modelApi", () => ({
  fetchModelTree: vi.fn().mockResolvedValue({ tree: [] }),
  fetchCommentSummary: vi.fn().mockResolvedValue({ unresolved: 0, total: 0 }),
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
  it("provides default navigation state", async () => {
    const { result } = renderWorkspaceHook(() => useWorkspace());
    expect(result.current.sidebarTab).toBeDefined();
    expect(result.current.tree).toEqual([]);
    expect(result.current.appView).toBe("workspace");
  });
});
