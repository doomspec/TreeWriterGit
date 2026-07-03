/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { DispatchSkillsPanel } from "@/components/dispatch/DispatchSkillsPanel";
import * as dispatchSkillsApi from "@/lib/dispatchSkillsApi";

describe("DispatchSkillsPanel", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("lists skills fetched on mount, showing an estimated token count instead of file size", async () => {
    vi.spyOn(dispatchSkillsApi, "fetchDispatchSkills").mockResolvedValue([
      { filename: "style.md", title: "Scientific tone", size: 400, enabled: true },
    ]);

    await act(async () => {
      render(<DispatchSkillsPanel onError={vi.fn()} onEditSkill={vi.fn()} />);
    });

    expect(screen.getByText("Scientific tone")).toBeTruthy();
    expect(screen.getByText(/style\.md · ~100 tokens/)).toBeTruthy();
  });

  it("calls onEditSkill with the filename instead of editing inline", async () => {
    vi.spyOn(dispatchSkillsApi, "fetchDispatchSkills").mockResolvedValue([
      { filename: "style.md", title: "Scientific tone", size: 400, enabled: true },
    ]);
    const onEditSkill = vi.fn();

    await act(async () => {
      render(<DispatchSkillsPanel onError={vi.fn()} onEditSkill={onEditSkill} />);
    });

    fireEvent.click(screen.getByRole("button", { name: /Edit style\.md/i }));

    expect(onEditSkill).toHaveBeenCalledWith("style.md");
    // No inline editor should ever appear in this panel.
    expect(screen.queryByLabelText("Skill content")).not.toBeTruthy();
  });

  it("toggles a skill enabled/disabled", async () => {
    vi.spyOn(dispatchSkillsApi, "fetchDispatchSkills").mockResolvedValue([
      { filename: "style.md", title: "Scientific tone", size: 400, enabled: true },
    ]);
    const patchSpy = vi
      .spyOn(dispatchSkillsApi, "patchDispatchSkillsEnabled")
      .mockResolvedValue([{ filename: "style.md", title: "Scientific tone", size: 400, enabled: false }]);
    const onSkillsChanged = vi.fn();

    await act(async () => {
      render(
        <DispatchSkillsPanel onError={vi.fn()} onEditSkill={vi.fn()} onSkillsChanged={onSkillsChanged} />,
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: /Use Scientific tone in dispatch/i }));
    });

    expect(patchSpy).toHaveBeenCalledWith([]);
    expect(onSkillsChanged).toHaveBeenCalled();
  });

  it("deletes a skill after confirmation", async () => {
    vi.spyOn(dispatchSkillsApi, "fetchDispatchSkills").mockResolvedValue([
      { filename: "style.md", title: "Scientific tone", size: 400, enabled: true },
    ]);
    const deleteSpy = vi.spyOn(dispatchSkillsApi, "deleteDispatchSkill").mockResolvedValue([]);
    window.confirm = vi.fn(() => true);

    await act(async () => {
      render(<DispatchSkillsPanel onError={vi.fn()} onEditSkill={vi.fn()} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Delete style\.md/i }));
    });

    expect(deleteSpy).toHaveBeenCalledWith("style.md");
  });

  it("shows the empty state when there are no skills yet", async () => {
    vi.spyOn(dispatchSkillsApi, "fetchDispatchSkills").mockResolvedValue([]);

    await act(async () => {
      render(<DispatchSkillsPanel onError={vi.fn()} onEditSkill={vi.fn()} />);
    });

    expect(screen.getByText(/No skills yet/)).toBeTruthy();
  });

  it("creates a skill from a template and opens it in the editor", async () => {
    vi.spyOn(dispatchSkillsApi, "fetchDispatchSkills").mockResolvedValue([]);
    const uploadSpy = vi
      .spyOn(dispatchSkillsApi, "uploadDispatchSkill")
      .mockResolvedValue({ filename: "abstract-review.md", title: "Abstract review", size: 300, enabled: true });
    window.prompt = vi.fn(() => "abstract-review");
    const onEditSkill = vi.fn();

    await act(async () => {
      render(<DispatchSkillsPanel onError={vi.fn()} onEditSkill={onEditSkill} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /New skill from template/i }));
    });

    expect(uploadSpy).toHaveBeenCalledTimes(1);
    const [filenameArg, contentArg] = uploadSpy.mock.calls[0];
    expect(filenameArg).toBe("abstract-review.md");
    expect(contentArg).toContain("# abstract-review");
    expect(contentArg).toContain("name: abstract-review");
    expect(onEditSkill).toHaveBeenCalledWith("abstract-review.md");
  });

  it("does not create when the name prompt is cancelled", async () => {
    vi.spyOn(dispatchSkillsApi, "fetchDispatchSkills").mockResolvedValue([]);
    const uploadSpy = vi.spyOn(dispatchSkillsApi, "uploadDispatchSkill");
    window.prompt = vi.fn(() => null);

    await act(async () => {
      render(<DispatchSkillsPanel onError={vi.fn()} onEditSkill={vi.fn()} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /New skill from template/i }));
    });

    expect(uploadSpy).not.toHaveBeenCalled();
  });
});
