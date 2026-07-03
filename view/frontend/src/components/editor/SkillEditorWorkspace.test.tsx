/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SkillEditorWorkspace } from "@/components/editor/SkillEditorWorkspace";
import * as dispatchSkillsApi from "@/lib/dispatchSkillsApi";

describe("SkillEditorWorkspace", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("loads and displays the skill's content and an estimated token count", async () => {
    vi.spyOn(dispatchSkillsApi, "fetchDispatchSkillContent").mockResolvedValue("# Style\n\nBe concise.");

    await act(async () => {
      render(
        <SkillEditorWorkspace filename="style.md" onClose={vi.fn()} onError={vi.fn()} />,
      );
    });

    const textarea = screen.getByLabelText("Skill content") as HTMLTextAreaElement;
    expect(textarea.value).toBe("# Style\n\nBe concise.");
    expect(screen.getByText(/~5 tokens/)).toBeTruthy();
  });

  it("disables Save until the content or filename actually changes", async () => {
    vi.spyOn(dispatchSkillsApi, "fetchDispatchSkillContent").mockResolvedValue("# Style\n");

    await act(async () => {
      render(<SkillEditorWorkspace filename="style.md" onClose={vi.fn()} onError={vi.fn()} />);
    });

    const saveButton = screen.getByRole("button", { name: /^Save$/i });
    expect(saveButton.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Skill content"), { target: { value: "# Style v2\n" } });
    expect(saveButton.hasAttribute("disabled")).toBe(false);
  });

  it("saves content + rename together and closes on success", async () => {
    vi.spyOn(dispatchSkillsApi, "fetchDispatchSkillContent").mockResolvedValue("# Style\n");
    const updateSpy = vi.spyOn(dispatchSkillsApi, "updateDispatchSkill").mockResolvedValue([]);
    const onClose = vi.fn();
    const onSkillsChanged = vi.fn();

    await act(async () => {
      render(
        <SkillEditorWorkspace
          filename="style.md"
          onClose={onClose}
          onError={vi.fn()}
          onSkillsChanged={onSkillsChanged}
        />,
      );
    });

    fireEvent.change(screen.getByLabelText("Skill content"), { target: { value: "# Style v2\n" } });
    fireEvent.change(screen.getByLabelText("Skill filename"), { target: { value: "style-v2.md" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));
    });

    expect(updateSpy).toHaveBeenCalledWith("style.md", {
      content: "# Style v2\n",
      newFilename: "style-v2.md",
    });
    expect(onSkillsChanged).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("asks for confirmation before closing with unsaved changes", async () => {
    vi.spyOn(dispatchSkillsApi, "fetchDispatchSkillContent").mockResolvedValue("# Style\n");
    const confirmSpy = vi.fn(() => false);
    window.confirm = confirmSpy;
    const onClose = vi.fn();

    await act(async () => {
      render(<SkillEditorWorkspace filename="style.md" onClose={onClose} onError={vi.fn()} />);
    });

    fireEvent.change(screen.getByLabelText("Skill content"), { target: { value: "# Style v2\n" } });
    fireEvent.click(screen.getByRole("button", { name: /Back/i }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes without confirmation when there are no unsaved changes", async () => {
    vi.spyOn(dispatchSkillsApi, "fetchDispatchSkillContent").mockResolvedValue("# Style\n");
    const confirmSpy = vi.fn();
    window.confirm = confirmSpy;
    const onClose = vi.fn();

    await act(async () => {
      render(<SkillEditorWorkspace filename="style.md" onClose={onClose} onError={vi.fn()} />);
    });

    fireEvent.click(screen.getByRole("button", { name: /Back/i }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("deletes the skill after confirmation", async () => {
    vi.spyOn(dispatchSkillsApi, "fetchDispatchSkillContent").mockResolvedValue("# Style\n");
    window.confirm = vi.fn(() => true);
    const deleteSpy = vi.spyOn(dispatchSkillsApi, "deleteDispatchSkill").mockResolvedValue([]);
    const onClose = vi.fn();

    await act(async () => {
      render(<SkillEditorWorkspace filename="style.md" onClose={onClose} onError={vi.fn()} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Delete style\.md/i }));
    });

    expect(deleteSpy).toHaveBeenCalledWith("style.md");
    expect(onClose).toHaveBeenCalled();
  });

  it("surfaces a load failure via onError", async () => {
    vi.spyOn(dispatchSkillsApi, "fetchDispatchSkillContent").mockRejectedValue(new Error("disk error"));
    const onError = vi.fn();

    await act(async () => {
      render(<SkillEditorWorkspace filename="style.md" onClose={vi.fn()} onError={onError} />);
    });

    expect(onError).toHaveBeenCalledWith("disk error");
  });
});
