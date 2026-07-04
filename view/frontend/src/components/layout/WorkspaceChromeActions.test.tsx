/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { WorkspaceChromeActions } from "@/components/layout/WorkspaceChromeActions";

describe("WorkspaceChromeActions", () => {
  afterEach(() => cleanup());

  it("shows the AI toggle and focus-view button", () => {
    render(
      <WorkspaceChromeActions onRefreshModel={vi.fn()} aiPanelOpen={false} onToggleAiPanel={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /open assistant panel/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /more actions/i })).toBeTruthy();
  });

  it("opens the overflow menu with Terminal/History/Skills/Refresh, each calling its callback", () => {
    const onRefreshModel = vi.fn();
    const onOpenTerminal = vi.fn();
    const onOpenHistory = vi.fn();
    const onOpenSkills = vi.fn();
    render(
      <WorkspaceChromeActions
        onRefreshModel={onRefreshModel}
        onOpenTerminal={onOpenTerminal}
        onOpenHistory={onOpenHistory}
        onOpenSkills={onOpenSkills}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));

    fireEvent.click(screen.getByText("Terminal"));
    expect(onOpenTerminal).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    fireEvent.click(screen.getByText("History"));
    expect(onOpenHistory).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    fireEvent.click(screen.getByText("Skills"));
    expect(onOpenSkills).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    fireEvent.click(screen.getByText("Refresh model"));
    expect(onRefreshModel).toHaveBeenCalledOnce();
  });

  it("omits Terminal/History/Skills items when their callbacks aren't provided", () => {
    render(<WorkspaceChromeActions onRefreshModel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    expect(screen.queryByText("Terminal")).not.toBeTruthy();
    expect(screen.queryByText("History")).not.toBeTruthy();
    expect(screen.queryByText("Skills")).not.toBeTruthy();
    expect(screen.getByText("Refresh model")).toBeTruthy();
  });
});
