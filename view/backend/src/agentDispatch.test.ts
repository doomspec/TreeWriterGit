import path from "node:path";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { beforeEach, afterEach, describe, it, expect } from "vitest";

import { loadProviders, buildPreview } from "./agentDispatch.js";

let repoRoot: string;
let modelRoot: string;

beforeEach(async () => {
  repoRoot = await mkdtemp(path.join(tmpdir(), "tw-dispatch-"));
  modelRoot = path.join(repoRoot, "model");
  await mkdir(modelRoot, { recursive: true });
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

describe("loadProviders", () => {
  it("returns built-in defaults when .treewriter.json absent", async () => {
    const config = await loadProviders(repoRoot);
    expect(config.aiProviders.length).toBeGreaterThan(0);
    expect(config.defaultProvider).toBeTruthy();
    expect(config.aiProviders[0].command).toBeTruthy();
  });

  it("reads custom providers from .treewriter.json", async () => {
    const custom = {
      aiProviders: [
        { name: "MyTool", command: "mytool", args: ["-p", "{prompt}"], writesFiles: false },
      ],
      defaultProvider: "MyTool",
    };
    await writeFile(path.join(repoRoot, ".treewriter.json"), JSON.stringify(custom), "utf8");
    const config = await loadProviders(repoRoot);
    expect(config.aiProviders[0].name).toBe("MyTool");
    expect(config.defaultProvider).toBe("MyTool");
  });

  it("falls back to defaults when .treewriter.json has empty providers array", async () => {
    await writeFile(
      path.join(repoRoot, ".treewriter.json"),
      JSON.stringify({ aiProviders: [], defaultProvider: "X" }),
      "utf8",
    );
    const config = await loadProviders(repoRoot);
    expect(config.aiProviders.length).toBeGreaterThan(0);
  });

  it("falls back to defaults on malformed JSON", async () => {
    await writeFile(path.join(repoRoot, ".treewriter.json"), "{ not json }", "utf8");
    const config = await loadProviders(repoRoot);
    expect(config.aiProviders.length).toBeGreaterThan(0);
  });
});

describe("buildPreview", () => {
  const provider = {
    name: "Claude Code",
    command: "claude",
    args: ["-p", "{prompt}"],
    writesFiles: true,
  };

  async function makeUnit(unitPath: string, idea: string, links: string[] = []) {
    const abs = path.join(modelRoot, unitPath);
    await mkdir(abs, { recursive: true });
    const fm = `---\nkind: unit\nstatus: outline\nlinks: [${links.map((l) => JSON.stringify(l)).join(", ")}]\n---\n`;
    await writeFile(path.join(abs, "INDEX.md"), fm, "utf8");
    await writeFile(path.join(abs, "outline.md"), `# Title\n\n${idea}\n`, "utf8");
    await writeFile(path.join(abs, "draft.md"), "", "utf8");
  }

  it("returns outputPath = unitPath/draft.md", async () => {
    await makeUnit("intro/problem", "State the research gap.");
    const result = await buildPreview(modelRoot, repoRoot, "intro/problem", "draft", provider);
    expect(result.outputPath).toBe("intro/problem/draft.md");
  });

  it("draft action: prompt contains manuscript markup conventions", async () => {
    await makeUnit("intro/problem", "State the research gap.");
    const result = await buildPreview(modelRoot, repoRoot, "intro/problem", "draft", provider);
    expect(result.prompt).toContain("MANUSCRIPT MARKUP");
    expect(result.prompt).toContain("[@smith2024; @jones2020]");
    expect(result.prompt).toContain("::figure[papers/<paper>/figures/<name>]");
  });

  it("refresh-index action: prompt omits manuscript markup", async () => {
    await makeUnit("intro/problem", "State the research gap.");
    const result = await buildPreview(
      modelRoot,
      repoRoot,
      "intro/problem",
      "refresh-index",
      provider,
    );
    expect(result.prompt).not.toContain("::figure[papers/<paper>/figures/<name>]");
  });

  it("sync-outline action: prompt requires concise bullet overview", async () => {
    await makeUnit("intro/problem", "Old overview.");
    await writeFile(
      path.join(modelRoot, "intro/problem/draft.md"),
      "Cells are counted manually.\n",
      "utf8",
    );
    const result = await buildPreview(modelRoot, repoRoot, "intro/problem", "sync-outline", provider);
    expect(result.outputPath).toBe("intro/problem/outline.md");
    expect(result.prompt).toContain("concise bullet list");
    expect(result.prompt).toContain("Do not write narrative paragraphs");
    expect(result.prompt).toContain("Cells are counted manually.");
  });

  it("summarize-outline action: includes downstream child outlines in context", async () => {
    await mkdir(path.join(modelRoot, "papers/demo/introduction"), { recursive: true });
    await writeFile(
      path.join(modelRoot, "papers/demo/introduction/INDEX.md"),
      "---\nkind: section\nchild_order: [background]\n---\n",
      "utf8",
    );
    await writeFile(
      path.join(modelRoot, "papers/demo/introduction/outline.md"),
      "# Introduction\n\n## Summary\n\n_Old summary._\n",
      "utf8",
    );
    await makeUnit("papers/demo/introduction/background", "Cells matter for bioprocessing.");

    const result = await buildPreview(
      modelRoot,
      repoRoot,
      "papers/demo/introduction",
      "summarize-outline",
      provider,
    );
    expect(result.outputPath).toBe("papers/demo/introduction/outline.md");
    expect(result.prompt).toContain("DOWNSTREAM PARTS");
    expect(result.prompt).toContain("Cells matter for bioprocessing.");
    expect(result.prompt).toContain("## Summary");
  });

  it("summarize-outline action: includes cited references and only cited assets", async () => {
    await mkdir(path.join(modelRoot, "papers/demo/introduction"), { recursive: true });
    await writeFile(
      path.join(modelRoot, "papers/demo/introduction/INDEX.md"),
      "---\nkind: section\nchild_order: [background]\n---\n",
      "utf8",
    );
    await writeFile(
      path.join(modelRoot, "papers/demo/introduction/outline.md"),
      "# Introduction\n\n## Summary\n\n_Old summary._\n",
      "utf8",
    );
    await makeUnit("papers/demo/introduction/background", "Cells matter [@smith2024].");
    await writeFile(
      path.join(modelRoot, "papers/demo/introduction/background/draft.md"),
      "VCD estimation uses ::figure[papers/demo/figures/cited-fig].\n",
      "utf8",
    );

    await mkdir(path.join(modelRoot, "papers/demo/notes/literature"), { recursive: true });
    await writeFile(
      path.join(modelRoot, "papers/demo/notes/literature/smith2024.md"),
      '---\ntype: literature\ncite_key: smith2024\ntitle: Smith 2024\n---\n# Smith 2024\n',
      "utf8",
    );
    await writeFile(
      path.join(modelRoot, "papers/demo/notes/literature/jones2020.md"),
      '---\ntype: literature\ncite_key: jones2020\ntitle: Jones 2020\n---\n# Jones 2020\n',
      "utf8",
    );

    await mkdir(path.join(modelRoot, "papers/demo/figures/cited-fig"), { recursive: true });
    await writeFile(
      path.join(modelRoot, "papers/demo/figures/cited-fig/INDEX.md"),
      "---\nkind: figure\ntitle: Cited Fig\n---\n",
      "utf8",
    );
    await writeFile(
      path.join(modelRoot, "papers/demo/figures/cited-fig/outline.md"),
      "# Cited Fig\n",
      "utf8",
    );
    await mkdir(path.join(modelRoot, "papers/demo/figures/uncited-fig"), { recursive: true });
    await writeFile(
      path.join(modelRoot, "papers/demo/figures/uncited-fig/INDEX.md"),
      "---\nkind: figure\ntitle: Uncited Fig\n---\n",
      "utf8",
    );
    await writeFile(
      path.join(modelRoot, "papers/demo/figures/uncited-fig/outline.md"),
      "# Uncited Fig\n",
      "utf8",
    );

    const result = await buildPreview(
      modelRoot,
      repoRoot,
      "papers/demo/introduction",
      "summarize-outline",
      provider,
    );
    expect(result.prompt).toContain("REFERENCES:");
    expect(result.prompt).toContain("papers/demo/notes/literature/smith2024.md");
    expect(result.prompt).not.toContain("papers/demo/notes/literature/jones2020.md");
    expect(result.prompt).toContain("CITED ASSETS:");
    expect(result.prompt).toContain("papers/demo/figures/cited-fig/outline.md");
    expect(result.prompt).not.toContain("papers/demo/figures/uncited-fig/outline.md");
  });

  it("draft action: prompt contains section overview from outline.md", async () => {
    await makeUnit("intro/problem", "State the research gap.");
    const result = await buildPreview(modelRoot, repoRoot, "intro/problem", "draft", provider);
    expect(result.prompt).toContain("SECTION OVERVIEW");
    expect(result.prompt).toContain("State the research gap.");
  });

  it("revise action: prompt contains CURRENT DRAFT and existing draft text", async () => {
    await makeUnit("intro/problem", "State the gap.");
    const draftText = "Cells are important.";
    await writeFile(path.join(modelRoot, "intro/problem/draft.md"), draftText, "utf8");
    const result = await buildPreview(modelRoot, repoRoot, "intro/problem", "revise", provider);
    expect(result.prompt).toContain("CURRENT DRAFT");
    expect(result.prompt).toContain(draftText);
  });

  it("custom action: uses customPrompt text", async () => {
    await makeUnit("intro/problem", "Idea.");
    const result = await buildPreview(
      modelRoot,
      repoRoot,
      "intro/problem",
      "custom",
      provider,
      "Fix the citations.",
    );
    expect(result.prompt).toContain("Fix the citations.");
  });

  it("command for writesFiles=true provider contains provider command", async () => {
    await makeUnit("intro/problem", "Idea.");
    const result = await buildPreview(modelRoot, repoRoot, "intro/problem", "draft", provider);
    expect(result.command).toContain("claude");
    expect(result.command).not.toContain(">");
  });

  it("command for writesFiles=false provider appends redirect", async () => {
    const stdoutProvider = {
      name: "Echo",
      command: "echo",
      args: ["{prompt}"],
      writesFiles: false,
    };
    await makeUnit("intro/problem", "Idea.");
    const result = await buildPreview(
      modelRoot,
      repoRoot,
      "intro/problem",
      "draft",
      stdoutProvider,
    );
    expect(result.command).toContain("> 'intro/problem/draft.md'");
  });

  it("codex never gets stdout redirect (requires a TTY)", async () => {
    const codexProvider = {
      name: "Codex",
      command: "codex",
      args: ["{prompt}"],
      writesFiles: false,
    };
    await makeUnit("intro/problem", "Idea.");
    const result = await buildPreview(
      modelRoot,
      repoRoot,
      "intro/problem",
      "draft",
      codexProvider,
    );
    expect(result.command).toContain("codex");
    expect(result.command).not.toContain(">");
  });

  it("gemini uses headless prompt without stdout redirect", async () => {
    const geminiProvider = {
      name: "Gemini",
      command: "gemini",
      args: ["-p", "{prompt}", "--approval-mode", "auto_edit"],
      writesFiles: true,
    };
    await makeUnit("intro/problem", "Idea.");
    const result = await buildPreview(
      modelRoot,
      repoRoot,
      "intro/problem",
      "draft",
      geminiProvider,
    );
    expect(result.command).toContain("gemini");
    expect(result.command).toContain("--approval-mode");
    expect(result.command).not.toMatch(/>\s*'/);
  });

  it("writes per-session prompt file under .treewriter-prompts/", async () => {
    await makeUnit("intro/problem", "State the gap.");
    const sessionId = "test-session-a";
    await buildPreview(modelRoot, repoRoot, "intro/problem", "draft", provider, undefined, sessionId);
    const saved = await readFile(
      path.join(repoRoot, ".treewriter-prompts", `${sessionId}.txt`),
      "utf8",
    );
    expect(saved).toContain("State the gap.");
  });

  it("isolates prompts per sessionId", async () => {
    await makeUnit("intro/problem", "Prompt A idea.");
    await buildPreview(modelRoot, repoRoot, "intro/problem", "draft", provider, undefined, "session-a");
    await makeUnit("intro/other", "Prompt B idea.");
    await buildPreview(modelRoot, repoRoot, "intro/other", "draft", provider, undefined, "session-b");
    const promptA = await readFile(path.join(repoRoot, ".treewriter-prompts", "session-a.txt"), "utf8");
    const promptB = await readFile(path.join(repoRoot, ".treewriter-prompts", "session-b.txt"), "utf8");
    expect(promptA).toContain("Prompt A idea.");
    expect(promptB).toContain("Prompt B idea.");
    expect(promptA).not.toContain("Prompt B idea.");
  });

  it("gathers context from linked units", async () => {
    await makeUnit("intro/problem", "State the gap.", ["methods/analysis"]);
    await makeUnit("methods/analysis", "Describe the statistical analysis.");
    const result = await buildPreview(modelRoot, repoRoot, "intro/problem", "draft", provider);
    expect(result.prompt).toContain("methods/analysis");
    expect(result.prompt).toContain("Describe the statistical analysis.");
  });

  it("listContextCandidates includes outline and links", async () => {
    const { listContextCandidates } = await import("./agentDispatch.js");
    await makeUnit("papers/demo/intro/claim", "Claim idea.", ["papers/demo/methods"]);
    await mkdir(path.join(modelRoot, "papers/demo/methods"), { recursive: true });
    await writeFile(path.join(modelRoot, "papers/demo/methods/outline.md"), "# Methods\n", "utf8");
    const files = await listContextCandidates(modelRoot, "papers/demo/intro/claim", "draft");
    expect(files.some((f) => f.path.endsWith("outline.md"))).toBe(true);
    expect(files.some((f) => f.category === "link")).toBe(true);
  });

  it("buildFanOutPreviews drafts each unit under a section", async () => {
    const { buildFanOutPreviews } = await import("./agentDispatch.js");
    await mkdir(path.join(modelRoot, "papers/demo/intro/a"), { recursive: true });
    await mkdir(path.join(modelRoot, "papers/demo/intro/b"), { recursive: true });
    for (const name of ["a", "b"]) {
      const unit = `papers/demo/intro/${name}`;
      await writeFile(
        path.join(modelRoot, unit, "INDEX.md"),
        "---\nkind: unit\nstatus: outline\n---\n",
        "utf8",
      );
      await writeFile(path.join(modelRoot, unit, "outline.md"), `# ${name}\n`, "utf8");
      await writeFile(path.join(modelRoot, unit, "draft.md"), "", "utf8");
    }
    await writeFile(
      path.join(modelRoot, "papers/demo/intro/INDEX.md"),
      "---\nkind: section\nchild_order: [a,b]\n---\n",
      "utf8",
    );
    const previews = await buildFanOutPreviews(
      modelRoot,
      repoRoot,
      "papers/demo/intro",
      "draft",
      provider,
    );
    expect(previews).toHaveLength(2);
  });

  it("gracefully handles missing unit INDEX.md", async () => {
    // unit folder exists but no INDEX.md
    const abs = path.join(modelRoot, "orphan/unit");
    await mkdir(abs, { recursive: true });
    const result = await buildPreview(modelRoot, repoRoot, "orphan/unit", "draft", provider);
    expect(result.prompt).toContain("no overview defined");
    expect(result.outputPath).toBe("orphan/unit/draft.md");
  });
});
