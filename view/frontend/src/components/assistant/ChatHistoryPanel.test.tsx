/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ChatHistoryPanel } from "@/components/assistant/ChatHistoryPanel";
import * as sessionClient from "@/lib/aiChat/sessionClient";

describe("ChatHistoryPanel", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows an empty state when the paper has no past sessions", async () => {
    vi.spyOn(sessionClient, "listChatSessions").mockResolvedValue([]);
    await act(async () => {
      render(
        <ChatHistoryPanel
          paperPath="papers/demo"
          unitPath="papers/demo/1-intro"
          onClose={vi.fn()}
          onError={vi.fn()}
        />,
      );
    });

    expect(screen.getByText(/No past sessions for this paper yet/)).toBeTruthy();
  });

  it("lists past sessions with section labels and opens a read-only transcript on click", async () => {
    vi.spyOn(sessionClient, "listChatSessions").mockResolvedValue([
      {
        provider: "gemini",
        mode: "bridged",
        startedAt: "2026-07-02T09:00:00.000Z",
        unitPath: "papers/demo/1-intro/some-unit",
        id: "1",
        filename: "chat-1.md",
        wikiPath: "papers/demo/notes/sessions/chat-1.md",
        turnCount: 2,
        lastAt: "2026-07-02T09:05:00.000Z",
        contextFiles: ["papers/demo/1-intro/outline.md"],
      },
    ]);
    vi.spyOn(sessionClient, "readChatSession").mockResolvedValue({
      provider: "gemini",
      mode: "bridged",
      startedAt: "2026-07-02T09:00:00.000Z",
      unitPath: "papers/demo/1-intro/some-unit",
      id: "1",
      filename: "chat-1.md",
      wikiPath: "papers/demo/notes/sessions/chat-1.md",
      contextFiles: ["papers/demo/1-intro/outline.md"],
      turns: [
        { role: "user", text: "Summarize this section.", at: "2026-07-02T09:00:05.000Z" },
        { role: "assistant", text: "Here is the summary.", at: "2026-07-02T09:00:20.000Z" },
      ],
    });

    await act(async () => {
      render(
        <ChatHistoryPanel
          paperPath="papers/demo"
          unitPath="papers/demo/1-intro"
          onClose={vi.fn()}
          onError={vi.fn()}
        />,
      );
    });

    expect(screen.getByText("…/1-intro/some-unit")).toBeTruthy();
    expect(screen.getByText("2 turns · 1 file attached")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByText("gemini"));
    });

    expect(screen.getByText("Summarize this section.")).toBeTruthy();
    expect(screen.getByText("Here is the summary.")).toBeTruthy();
    expect(screen.getByText("papers/demo/1-intro/outline.md")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Back to session list/i }));
    expect(screen.queryByText("Summarize this section.")).not.toBeTruthy();
    expect(screen.getByText("gemini")).toBeTruthy();
  });

  it("calls onResumeSession when Continue is clicked on a bridged session", async () => {
    const sessionFile = {
      provider: "codex",
      mode: "bridged" as const,
      startedAt: "2026-07-02T09:00:00.000Z",
      unitPath: "papers/demo/1-intro/some-unit",
      agentSessionId: "sess-1",
      id: "1",
      filename: "chat-1.md",
      wikiPath: "papers/demo/notes/sessions/chat-1.md",
      turns: [{ role: "user" as const, text: "Hi", at: "2026-07-02T09:00:05.000Z" }],
    };
    vi.spyOn(sessionClient, "listChatSessions").mockResolvedValue([
      {
        ...sessionFile,
        turnCount: 1,
        lastAt: "2026-07-02T09:00:05.000Z",
      },
    ]);
    vi.spyOn(sessionClient, "readChatSession").mockResolvedValue(sessionFile);
    const onResumeSession = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      render(
        <ChatHistoryPanel
          paperPath="papers/demo"
          unitPath="papers/demo/1-intro"
          onClose={onClose}
          onError={vi.fn()}
          onResumeSession={onResumeSession}
        />,
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByText("codex"));
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(onResumeSession).toHaveBeenCalledWith(sessionFile);
    expect(onClose).toHaveBeenCalled();
  });

  it("does not show Continue for PTY sessions", async () => {
    vi.spyOn(sessionClient, "listChatSessions").mockResolvedValue([
      {
        provider: "claude",
        mode: "pty",
        startedAt: "2026-07-02T09:00:00.000Z",
        unitPath: "papers/demo/1-intro",
        id: "1",
        filename: "chat-1.md",
        wikiPath: "papers/demo/notes/sessions/chat-1.md",
        turnCount: 1,
        lastAt: "2026-07-02T09:00:05.000Z",
      },
    ]);
    vi.spyOn(sessionClient, "readChatSession").mockResolvedValue({
      provider: "claude",
      mode: "pty",
      startedAt: "2026-07-02T09:00:00.000Z",
      unitPath: "papers/demo/1-intro",
      id: "1",
      filename: "chat-1.md",
      wikiPath: "papers/demo/notes/sessions/chat-1.md",
      turns: [{ role: "user", text: "Hi", at: "2026-07-02T09:00:05.000Z" }],
    });

    await act(async () => {
      render(
        <ChatHistoryPanel
          paperPath="papers/demo"
          unitPath="papers/demo/1-intro"
          onClose={vi.fn()}
          onError={vi.fn()}
          onResumeSession={vi.fn()}
        />,
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByText("claude"));
    });

    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeTruthy();
  });

  it("surfaces a listing failure via onError", async () => {
    vi.spyOn(sessionClient, "listChatSessions").mockRejectedValue(new Error("disk error"));
    const onError = vi.fn();
    await act(async () => {
      render(
        <ChatHistoryPanel
          paperPath="papers/demo"
          unitPath="papers/demo/1-intro"
          onClose={vi.fn()}
          onError={onError}
        />,
      );
    });

    expect(onError).toHaveBeenCalledWith("disk error");
  });

  it("calls onClose when the close button is clicked", async () => {
    vi.spyOn(sessionClient, "listChatSessions").mockResolvedValue([]);
    const onClose = vi.fn();
    await act(async () => {
      render(
        <ChatHistoryPanel
          paperPath="papers/demo"
          unitPath="papers/demo/1-intro"
          onClose={onClose}
          onError={vi.fn()}
        />,
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /Close history/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
