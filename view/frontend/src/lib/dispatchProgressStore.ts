import type { AgentDispatchAction, DispatchProgressState } from "@/lib/agentDispatchClient";

const STORAGE_KEY = "treewriter.dispatch-jobs";
const DISPATCH_JOB_EVENT = "treewriter:dispatch-job";

export type PersistedDispatchJob = {
  jobKey: string;
  scope: "unit" | "section";
  targetPath: string;
  pane?: "outline" | "draft";
  action: AgentDispatchAction;
  progress: DispatchProgressState;
  unitPaths?: string[];
  provider?: string;
  customPrompt?: string;
  updatedAt: number;
};

type JobMap = Record<string, PersistedDispatchJob>;

function readJobs(): JobMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as JobMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeJobs(jobs: JobMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
}

export function dispatchJobKey(
  scope: "unit" | "section",
  targetPath: string,
  pane?: "outline" | "draft",
): string {
  return pane ? `${scope}:${targetPath}:${pane}` : `${scope}:${targetPath}`;
}

export function loadDispatchJob(jobKey: string): PersistedDispatchJob | null {
  return readJobs()[jobKey] ?? null;
}

export function saveDispatchJob(job: PersistedDispatchJob): void {
  const jobs = readJobs();
  jobs[job.jobKey] = job;
  writeJobs(jobs);
  window.dispatchEvent(new CustomEvent(DISPATCH_JOB_EVENT, { detail: { jobKey: job.jobKey } }));
}

export function clearDispatchJob(jobKey: string): void {
  const jobs = readJobs();
  if (!(jobKey in jobs)) return;
  delete jobs[jobKey];
  writeJobs(jobs);
  window.dispatchEvent(new CustomEvent(DISPATCH_JOB_EVENT, { detail: { jobKey } }));
}

export function subscribeDispatchJobs(listener: (jobKey: string) => void): () => void {
  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent<{ jobKey: string }>).detail;
    listener(detail.jobKey);
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener("");
  };
  window.addEventListener(DISPATCH_JOB_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(DISPATCH_JOB_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

export function markDispatchInterrupted(jobKey: string): DispatchProgressState | null {
  const job = loadDispatchJob(jobKey);
  if (!job || job.progress.phase !== "running") return job?.progress ?? null;
  const progress: DispatchProgressState = {
    ...job.progress,
    phase: "error",
    logs: [...job.progress.logs, "Interrupted by page reload"],
  };
  saveDispatchJob({ ...job, progress, updatedAt: Date.now() });
  return progress;
}
