/** @vitest-environment happy-dom */
import { describe, expect, it, vi, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { AiChatThread } from "@/components/assistant/AiChatThread";

vi.mock("@/lib/agentDispatchClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/agentDispatchClient")>(
    "@/lib/agentDispatchClient",
  );
  return { ...actual, previewAgentDispatch: vi.fn() };
});

vi.mock("@/modelApi", async () => {
  const actual = await vi.importActual<typeof import("@/modelApi")>("@/modelApi");
  return { ...actual, fetchContextFiles: vi.fn().mockResolvedValue({ files: [] }) };
});

vi.mock("@/lib/aiChat/sessionClient", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/aiChat/sessionClient")>("@/lib/aiChat/sessionClient");
  return { ...actual, listChatSessions: vi.fn().mockResolvedValue([]) };
});

const { previewAgentDispatch } = await import("@/lib/agentDispatchClient");
const { fetchContextFiles } = await import("@/modelApi");
const { listChatSessions } = await import("@/lib/aiChat/sessionClient");

function openHotActions() {
  fireEvent.click(screen.getByRole("button", { name: /AI actions/i }));
}

function baseProps(overrides: Partial<React.ComponentProps<typeof AiChatThread>> = {}) {
  return {
    status: "attached" as const,
    terminalConnected: true,
    turns: [],
    pendingText: "",
    suggestedProvider: null,
    onAttach: vi.fn(),
    onSend: vi.fn(),
    onStop: vi.fn(),
    onDetach: vi.fn(),
    onOpenTerminal: vi.fn(),
    currentPath: "papers/demo/1-intro/some-unit",
    isUnit: true,
    canFanOut: false,
    onError: vi.fn(),
    ...overrides,
  };
}

describe("AiChatThread", () => {
  afterEach(() => {
    cleanup();
    vi.mocked(previewAgentDispatch).mockReset();
    vi.mocked(fetchContextFiles).mockReset();
    vi.mocked(fetchContextFiles).mockResolvedValue({ files: [] });
    vi.mocked(listChatSessions).mockReset();
    vi.mocked(listChatSessions).mockResolvedValue([]);
  });

  it("always shows the current unit/section as a context pointer", () => {
    render(<AiChatThread {...baseProps()} />);
    expect(screen.getByTitle("papers/demo/1-intro/some-unit").textContent).toContain(
      "…/1-intro/some-unit",
    );
  });

  it("shows a fallback context pointer when nothing is open", () => {
    render(<AiChatThread {...baseProps({ currentPath: "", status: "idle" })} />);
    expect(screen.getByText("No section or unit open")).toBeTruthy();
  });

  it("shows unit hot-command actions for a unit, collapsed behind an AI actions toggle", () => {
    render(<AiChatThread {...baseProps({ isUnit: true })} />);
    expect(screen.queryByRole("button", { name: /Make draft/i })).not.toBeTruthy();
    openHotActions();
    expect(screen.getByRole("button", { name: /Make draft/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Cite-check/i })).toBeTruthy();
    // "custom" is filtered out — it has no prompt to preview.
    expect(screen.queryByRole("button", { name: /^Custom$/i })).not.toBeTruthy();
  });

  it("clicking a hot command populates the composer with the built prompt, expanded and readable by default", async () => {
    vi.mocked(previewAgentDispatch).mockResolvedValue({
      prompt: "A".repeat(500),
      command: "claude -p ...",
      outputPath: "papers/demo/1-intro/some-unit/draft.md",
    });
    const onSend = vi.fn();
    render(<AiChatThread {...baseProps({ onSend })} />);
    openHotActions();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Make draft/i }));
    });

    expect(previewAgentDispatch).toHaveBeenCalledWith({
      unitPath: "papers/demo/1-intro/some-unit",
      action: "draft",
    });
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByText(/Make draft prompt built/)).toBeTruthy();
    const textarea = screen.getByPlaceholderText("Message the agent…") as HTMLTextAreaElement;
    expect(textarea.value).toHaveLength(500);
    // Expanded by default — staging exists so the user can actually read/edit
    // before sending, so it shouldn't need an extra click to become legible.
    expect(Number(textarea.rows)).toBe(10);

    fireEvent.click(screen.getByText(/Make draft prompt built/));
    const collapsedTextarea = screen.getByPlaceholderText(
      "Message the agent…",
    ) as HTMLTextAreaElement;
    expect(Number(collapsedTextarea.rows)).toBe(2);
  });

  it("auto-run sends the built prompt immediately instead of staging it", async () => {
    vi.mocked(previewAgentDispatch).mockResolvedValue({
      prompt: "auto prompt",
      command: "claude -p ...",
      outputPath: "papers/demo/1-intro/some-unit/draft.md",
    });
    const onSend = vi.fn();
    render(<AiChatThread {...baseProps({ onSend })} />);
    openHotActions();

    fireEvent.click(screen.getByLabelText(/Auto-run/i));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Make draft/i }));
    });

    expect(onSend).toHaveBeenCalledWith("auto prompt");
    expect(screen.queryByText(/prompt built/)).not.toBeTruthy();
  });

  it("surfaces a preview failure via onError without crashing", async () => {
    vi.mocked(previewAgentDispatch).mockRejectedValue(new Error("no context files"));
    const onError = vi.fn();
    render(<AiChatThread {...baseProps({ onError })} />);
    openHotActions();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Make draft/i }));
    });

    expect(onError).toHaveBeenCalledWith("no context files");
  });

  it("collapses a long sent message behind a 'Show full message' toggle", () => {
    const longText = "B".repeat(400);
    render(
      <AiChatThread
        {...baseProps({
          turns: [{ role: "user", text: longText, at: "2026-07-02T10:00:00.000Z" }],
        })}
      />,
    );
    expect(screen.getByText(`B`.repeat(320) + "…")).toBeTruthy();
    fireEvent.click(screen.getByText(/Show full message/));
    expect(screen.getByText(longText)).toBeTruthy();
  });

  it("does not collapse a short sent message", () => {
    render(
      <AiChatThread
        {...baseProps({
          turns: [{ role: "user", text: "hi", at: "2026-07-02T10:00:00.000Z" }],
        })}
      />,
    );
    expect(screen.getByText("hi")).toBeTruthy();
    expect(screen.queryByText(/Show full message/)).not.toBeTruthy();
  });

  it("Enter sends the staged prompt just like a typed message", async () => {
    vi.mocked(previewAgentDispatch).mockResolvedValue({
      prompt: "built prompt text",
      command: "claude -p ...",
      outputPath: "papers/demo/1-intro/some-unit/draft.md",
    });
    const onSend = vi.fn();
    render(<AiChatThread {...baseProps({ onSend })} />);
    openHotActions();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Make draft/i }));
    });
    const textarea = screen.getByPlaceholderText("Message the agent…");
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(onSend).toHaveBeenCalledWith("built prompt text", undefined);
  });

  it("lists fetched context files grouped by category behind the attach button", async () => {
    vi.mocked(fetchContextFiles).mockResolvedValue({
      files: [
        { path: "papers/demo/1-intro/some-unit/outline.md", label: "Unit outline", category: "unit", defaultIncluded: true },
        { path: "papers/demo/1-intro/ref-a.md", label: "ref-a", category: "literature", defaultIncluded: true },
      ],
    });
    await act(async () => {
      render(<AiChatThread {...baseProps()} />);
    });

    fireEvent.click(screen.getByRole("button", { name: /Attach context files/i }));

    expect(screen.getByText("Manuscript")).toBeTruthy();
    expect(screen.getByText("References")).toBeTruthy();
    expect(screen.getByText("Unit outline")).toBeTruthy();
    expect(screen.getByText("ref-a")).toBeTruthy();
  });

  it("attaching a file adds a chip and sends it as contextPaths", async () => {
    vi.mocked(fetchContextFiles).mockResolvedValue({
      files: [
        { path: "papers/demo/1-intro/some-unit/outline.md", label: "Unit outline", category: "unit", defaultIncluded: true },
      ],
    });
    const onSend = vi.fn();
    await act(async () => {
      render(<AiChatThread {...baseProps({ onSend })} />);
    });

    fireEvent.click(screen.getByRole("button", { name: /Attach context files/i }));
    fireEvent.click(screen.getByText("Unit outline"));

    // The chip renders the bare filename ("outline.md"), distinct from the
    // candidate's descriptive label ("Unit outline") still shown in the list.
    expect(screen.getByText("outline.md")).toBeTruthy();

    const textarea = screen.getByPlaceholderText("Message the agent…");
    fireEvent.change(textarea, { target: { value: "What changed here?" } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(onSend).toHaveBeenCalledWith("What changed here?", [
      "papers/demo/1-intro/some-unit/outline.md",
    ]);
  });

  it("removing a chip drops it from the next send", async () => {
    vi.mocked(fetchContextFiles).mockResolvedValue({
      files: [
        { path: "papers/demo/1-intro/some-unit/outline.md", label: "Unit outline", category: "unit", defaultIncluded: true },
      ],
    });
    const onSend = vi.fn();
    await act(async () => {
      render(<AiChatThread {...baseProps({ onSend })} />);
    });

    fireEvent.click(screen.getByRole("button", { name: /Attach context files/i }));
    fireEvent.click(screen.getByText("Unit outline"));
    fireEvent.click(screen.getByRole("button", { name: /Detach outline\.md/i }));

    const textarea = screen.getByPlaceholderText("Message the agent…");
    fireEvent.change(textarea, { target: { value: "hello" } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(onSend).toHaveBeenCalledWith("hello", undefined);
  });

  it("opens and closes the read-only session history from the context pointer", async () => {
    await act(async () => {
      render(<AiChatThread {...baseProps()} />);
    });

    fireEvent.click(screen.getByRole("button", { name: /Open session history/i }));
    expect(listChatSessions).toHaveBeenCalledWith("papers/demo/1-intro/some-unit");
    expect(await screen.findByText("Session history")).toBeTruthy();
    // The composer/hot-command row is replaced while history is open.
    expect(screen.queryByPlaceholderText("Message the agent…")).not.toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Close history/i }));
    expect(screen.getByPlaceholderText("Message the agent…")).toBeTruthy();
  });

  it("keeps the AI actions row collapsed by default and toggles it open/closed", () => {
    render(<AiChatThread {...baseProps()} />);
    const toggle = screen.getByRole("button", { name: /AI actions/i });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", { name: /Make draft/i })).not.toBeTruthy();

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: /Make draft/i })).toBeTruthy();

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", { name: /Make draft/i })).not.toBeTruthy();
  });

  it("groups end-session and attach-files controls with history in the context pointer bar", () => {
    render(<AiChatThread {...baseProps()} />);
    // All three session-level controls live in the same title-bar row now.
    expect(screen.getByRole("button", { name: /Attach context files/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /End chat session/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Open session history/i })).toBeTruthy();
  });

  it("calls onDetach when ending the session from the context pointer bar", () => {
    const onDetach = vi.fn();
    render(<AiChatThread {...baseProps({ onDetach })} />);
    fireEvent.click(screen.getByRole("button", { name: /End chat session/i }));
    expect(onDetach).toHaveBeenCalled();
  });
});
