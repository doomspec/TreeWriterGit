/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { EditorAiActionsMenu } from "@/components/editor/EditorAiActionsMenu";
import { AgentDispatchPanelContext } from "@/lib/agentDispatchPanel";

describe("EditorAiActionsMenu", () => {
  afterEach(() => cleanup());

  it("renders nothing outside an AgentDispatchPanelContext", () => {
    const { container } = render(
      <EditorAiActionsMenu pane="draft" actions={[{ action: "draft" }]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when given an empty action list", () => {
    const openDispatch = vi.fn();
    const { container } = render(
      <AgentDispatchPanelContext.Provider value={{ openDispatch }}>
        <EditorAiActionsMenu pane="draft" actions={[]} />
      </AgentDispatchPanelContext.Provider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("lists actions with dispatch labels and opens dispatch with the pane + autoPreview on click", () => {
    const openDispatch = vi.fn();
    render(
      <AgentDispatchPanelContext.Provider value={{ openDispatch }}>
        <EditorAiActionsMenu
          pane="draft"
          actions={[
            { action: "draft", label: "Draft from outline" },
            { action: "draft-from-notes" },
            { action: "custom", label: "Apply skill…", skipAutoPreview: true },
          ]}
        />
      </AgentDispatchPanelContext.Provider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /AI actions/i }));

    expect(screen.getByText("Draft from outline")).toBeTruthy();
    expect(screen.getByText("Draft from notes")).toBeTruthy();
    fireEvent.click(screen.getByText("Draft from notes"));
    expect(openDispatch).toHaveBeenCalledWith({
      action: "draft-from-notes",
      pane: "draft",
      autoPreview: true,
    });
  });

  it("does not auto-preview actions marked skipAutoPreview (e.g. Apply skill)", () => {
    const openDispatch = vi.fn();
    render(
      <AgentDispatchPanelContext.Provider value={{ openDispatch }}>
        <EditorAiActionsMenu
          pane="draft"
          actions={[{ action: "custom", label: "Apply skill…", skipAutoPreview: true }]}
        />
      </AgentDispatchPanelContext.Provider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /AI actions/i }));
    fireEvent.click(screen.getByText("Apply skill…"));

    expect(openDispatch).toHaveBeenCalledWith({
      action: "custom",
      pane: "draft",
      autoPreview: false,
    });
  });

  it("uses the dispatch label when no override label is given", () => {
    const openDispatch = vi.fn();
    render(
      <AgentDispatchPanelContext.Provider value={{ openDispatch }}>
        <EditorAiActionsMenu pane="notes" actions={[{ action: "notes-from-draft" }]} />
      </AgentDispatchPanelContext.Provider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /AI actions/i }));
    expect(screen.getByText("Notes from draft")).toBeTruthy();
  });
});
