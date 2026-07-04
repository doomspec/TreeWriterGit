/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { DispatchSkillsPanel } from "@/components/dispatch/DispatchSkillsPanel";
import * as dispatchSkillsApi from "@/lib/dispatchSkillsApi";
import type { DispatchSkill } from "@/lib/dispatchSkillsApi";

function userSkill(overrides: Partial<DispatchSkill> = {}): DispatchSkill {
  return {
    filename: "style.md",
    title: "Scientific tone",
    size: 400,
    enabled: true,
    tier: "user",
    subkind: "rule",
    skillPath: "user/style.md",
    ...overrides,
  };
}

describe("DispatchSkillsPanel", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("lists user skills with skillPath in meta", async () => {
    vi.spyOn(dispatchSkillsApi, "fetchDispatchSkills").mockResolvedValue([userSkill()]);

    await act(async () => {
      render(<DispatchSkillsPanel onError={vi.fn()} onEditSkill={vi.fn()} />);
    });

    expect(screen.getByText("Scientific tone")).toBeTruthy();
    expect(screen.getByText(/user\/style\.md · ~100 tokens/)).toBeTruthy();
  });

  it("opens the editor when the skill card body is clicked", async () => {
    vi.spyOn(dispatchSkillsApi, "fetchDispatchSkills").mockResolvedValue([userSkill()]);
    const onEditSkill = vi.fn();

    await act(async () => {
      render(<DispatchSkillsPanel onError={vi.fn()} onEditSkill={onEditSkill} />);
    });

    fireEvent.click(screen.getByRole("button", { name: /Edit Scientific tone/i }));

    expect(onEditSkill).toHaveBeenCalledWith("user/style.md");
    expect(screen.queryByLabelText("Skill content")).not.toBeTruthy();
  });

  it("toggles a user skill enabled/disabled", async () => {
    vi.spyOn(dispatchSkillsApi, "fetchDispatchSkills").mockResolvedValue([userSkill()]);
    const patchSpy = vi
      .spyOn(dispatchSkillsApi, "patchDispatchSkillsEnabled")
      .mockResolvedValue([userSkill({ enabled: false })]);
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

  it("deletes a user skill from the actions menu after confirmation", async () => {
    vi.spyOn(dispatchSkillsApi, "fetchDispatchSkills").mockResolvedValue([userSkill()]);
    const deleteSpy = vi.spyOn(dispatchSkillsApi, "deleteDispatchSkill").mockResolvedValue([]);
    window.confirm = vi.fn(() => true);

    await act(async () => {
      render(<DispatchSkillsPanel onError={vi.fn()} onEditSkill={vi.fn()} />);
    });

    fireEvent.click(screen.getByRole("button", { name: /Actions for Scientific tone/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: /Delete/i }));
    });

    expect(deleteSpy).toHaveBeenCalledWith("user/style.md");
  });

  it("renames a user skill from the actions menu", async () => {
    vi.spyOn(dispatchSkillsApi, "fetchDispatchSkills").mockResolvedValue([userSkill()]);
    const updateSpy = vi
      .spyOn(dispatchSkillsApi, "updateDispatchSkill")
      .mockResolvedValue([userSkill({ filename: "voice.md", skillPath: "user/voice.md" })]);
    window.prompt = vi.fn(() => "voice");

    await act(async () => {
      render(<DispatchSkillsPanel onError={vi.fn()} onEditSkill={vi.fn()} />);
    });

    fireEvent.click(screen.getByRole("button", { name: /Actions for Scientific tone/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: /Rename/i }));
    });

    expect(updateSpy).toHaveBeenCalledWith("user/style.md", { newFilename: "voice.md" });
  });

  it("shows reset for system skills, not delete/rename", async () => {
    vi.spyOn(dispatchSkillsApi, "fetchDispatchSkills").mockResolvedValue([
      {
        filename: "dispatch-draft.md",
        title: "Make draft",
        size: 800,
        enabled: true,
        tier: "system",
        subkind: "action",
        skillPath: "system/dispatch-draft.md",
      },
    ]);

    await act(async () => {
      render(<DispatchSkillsPanel onError={vi.fn()} onEditSkill={vi.fn()} />);
    });

    fireEvent.click(screen.getByRole("button", { name: /Actions for Make draft/i }));
    expect(screen.getByRole("menuitem", { name: /Reset/i })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: /Rename/i })).not.toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: /Delete/i })).not.toBeTruthy();
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
    const uploadSpy = vi.spyOn(dispatchSkillsApi, "uploadDispatchSkill").mockResolvedValue(
      userSkill({
        filename: "abstract-review.md",
        title: "Abstract review",
        size: 300,
        skillPath: "user/abstract-review.md",
      }),
    );
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
    expect(onEditSkill).toHaveBeenCalledWith("user/abstract-review.md");
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
