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
    expect(buildDispatchGuideText()).toContain("Preview");
  });
});
