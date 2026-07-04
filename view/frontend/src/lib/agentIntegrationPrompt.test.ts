import { describe, expect, it } from "vitest";

import { buildAgentIntegrationPrompt, buildDispatchGuideText } from "./agentIntegrationPrompt";

describe("agentIntegrationPrompt", () => {
  it("includes unit path when provided", () => {
    const prompt = buildAgentIntegrationPrompt("papers/demo/intro/problem");
    expect(prompt).toContain("papers/demo/intro/problem");
    expect(prompt).toContain("outline.md");
    expect(prompt).toContain("Approve");
  });

  it("falls back when unit path is missing", () => {
    const prompt = buildAgentIntegrationPrompt();
    expect(prompt).toContain("Ask the author which unit folder");
  });

  it("documents dispatch workflow", () => {
    expect(buildDispatchGuideText()).toContain(".treewriter.json");
    expect(buildDispatchGuideText()).toContain("Assistant panel");
    expect(buildDispatchGuideText()).toContain("tw-context.mjs");
    expect(buildDispatchGuideText()).toContain("three layers");
    expect(buildDispatchGuideText()).toContain("system/");
  });

  it("mentions approval folder in integration prompt", () => {
    const prompt = buildAgentIntegrationPrompt("papers/demo/intro/problem");
    expect(prompt).toContain(".approval/draft.approved.md");
  });

  it("includes context CLI in integration prompt", () => {
    const prompt = buildAgentIntegrationPrompt("papers/demo/intro/problem");
    expect(prompt).toContain("tw-context.mjs");
    expect(prompt).toContain("papers/demo");
  });
});
