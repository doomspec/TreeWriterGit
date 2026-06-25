import { describe, expect, it } from "vitest";

import { createAgentJobManager } from "./agentJobManager.js";

describe("export orchestrator contract", () => {
  it("agent job manager integrates with shared job states", () => {
    const manager = createAgentJobManager();
    const job = manager.enqueue({ unitPath: "papers/p/intro", providerName: "Claude Code" });
    expect(job.state).toBe("queued");
    manager.markRunning(job.id);
    manager.complete(job.id, "abc");
    expect(manager.get(job.id)?.state).toBe("succeeded");
  });
});
