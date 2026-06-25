/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { DraftApprovalBar } from "@/components/editor/DraftApprovalBar";

describe("DraftApprovalBar", () => {
  it("shows editor attribution and calls approve/discard", () => {
    const onApprove = vi.fn();
    const onDiscard = vi.fn();
    render(
      <DraftApprovalBar
        pendingSource="human"
        editedBy="alice"
        onApprove={onApprove}
        onDiscard={onDiscard}
      />,
    );
    expect(screen.getAllByText(/@alice edited/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));
    fireEvent.click(screen.getByRole("button", { name: /discard/i }));
    expect(onApprove).toHaveBeenCalledOnce();
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it("shows change navigation when provided", () => {
    render(
      <DraftApprovalBar
        pendingSource="ai"
        aiAssisted
        onApprove={vi.fn()}
        onDiscard={vi.fn()}
        changeNavigation={{
          canNavigate: true,
          count: 3,
          index: 1,
          goToNext: vi.fn(),
          goToPrevious: vi.fn(),
        }}
      />,
    );
    expect(screen.getByLabelText("Navigate track changes")).toBeTruthy();
    expect(screen.getByText("2/3")).toBeTruthy();
  });
});
