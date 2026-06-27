import { randomUUID } from "node:crypto";

export type AgentJobState = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type AgentJob = {
  id: string;
  unitPath: string;
  providerName: string;
  state: AgentJobState;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  outputHash: string | null;
  cancelRequested: boolean;
};

export type AgentJobManager = ReturnType<typeof createAgentJobManager>;

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;

export function createAgentJobManager(options?: { timeoutMs?: number }) {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const jobs = new Map<string, AgentJob>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function clearTimer(id: string) {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
  }

  function enqueue(input: { unitPath: string; providerName: string }): AgentJob {
    const job: AgentJob = {
      id: randomUUID(),
      unitPath: input.unitPath,
      providerName: input.providerName,
      state: "queued",
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      error: null,
      outputHash: null,
      cancelRequested: false,
    };
    jobs.set(job.id, job);
    return job;
  }

  function markRunning(id: string): AgentJob | null {
    const job = jobs.get(id);
    if (!job || job.state !== "queued") return null;
    job.state = "running";
    job.startedAt = new Date().toISOString();
    clearTimer(id);
    timers.set(
      id,
      setTimeout(() => {
        fail(id, "Agent job timed out");
      }, timeoutMs),
    );
    return job;
  }

  function complete(id: string, outputHash: string | null): AgentJob | null {
    const job = jobs.get(id);
    if (!job || job.state !== "running") return null;
    clearTimer(id);
    job.state = "succeeded";
    job.finishedAt = new Date().toISOString();
    job.outputHash = outputHash;
    return job;
  }

  function fail(id: string, error: string): AgentJob | null {
    const job = jobs.get(id);
    if (!job || job.state === "succeeded" || job.state === "cancelled") return null;
    clearTimer(id);
    job.state = job.cancelRequested ? "cancelled" : "failed";
    job.finishedAt = new Date().toISOString();
    job.error = error;
    return job;
  }

  function cancel(id: string): AgentJob | null {
    const job = jobs.get(id);
    if (!job) return null;
    job.cancelRequested = true;
    if (job.state === "queued") {
      job.state = "cancelled";
      job.finishedAt = new Date().toISOString();
      clearTimer(id);
    }
    return job;
  }

  function get(id: string): AgentJob | null {
    return jobs.get(id) ?? null;
  }

  function listForUnit(unitPath: string): AgentJob[] {
    return [...jobs.values()].filter((job) => job.unitPath === unitPath);
  }

  return {
    enqueue,
    markRunning,
    complete,
    fail,
    cancel,
    get,
    listForUnit,
    _jobs: jobs,
  };
}
