import { describe, expect, it } from "vitest";

import { createAgentJobManager } from "./agentJobManager.js";

describe("createAgentJobManager", () => {
  it("tracks queued → running → succeeded lifecycle", () => {
    const manager = createAgentJobManager({ timeoutMs: 60_000 });
    const job = manager.enqueue({ unitPath: "papers/demo/intro", providerName: "Claude Code" });
    expect(job.state).toBe("queued");

    const running = manager.markRunning(job.id);
    expect(running?.state).toBe("running");

    const done = manager.complete(job.id, "hash123");
    expect(done?.state).toBe("succeeded");
    expect(done?.outputHash).toBe("hash123");
  });

  it("cancels queued jobs immediately", () => {
    const manager = createAgentJobManager();
    const job = manager.enqueue({ unitPath: "papers/demo/intro", providerName: "Aider" });
    const cancelled = manager.cancel(job.id);
    expect(cancelled?.state).toBe("cancelled");
  });
});
