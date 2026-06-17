import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AgentDispatchAction, DispatchJobPersistence, DispatchProgressState } from "@/lib/agentDispatchClient";
import {
  runAgentDispatchWithProgress,
  runFanOutDispatchWithProgress,
} from "@/lib/agentDispatchClient";
import {
  dispatchJobKey,
  loadDispatchJob,
  markDispatchInterrupted,
  saveDispatchJob,
  subscribeDispatchJobs,
  type PersistedDispatchJob,
} from "@/lib/dispatchProgressStore";

type UseDispatchJobConfig = {
  scope: "unit" | "section";
  targetPath: string | null;
  pane?: "outline" | "draft";
  onResumeComplete?: () => void;
  onError?: (message: string) => void;
};

export function useDispatchJob({
  scope,
  targetPath,
  pane,
  onResumeComplete,
  onError,
}: UseDispatchJobConfig) {
  const jobKey = targetPath ? dispatchJobKey(scope, targetPath, pane) : null;
  const [progress, setProgress] = useState<DispatchProgressState | null>(() => {
    if (!jobKey) return null;
    return loadDispatchJob(jobKey)?.progress ?? null;
  });
  const [dispatching, setDispatching] = useState(false);
  const resumeStartedRef = useRef(false);
  const extrasRef = useRef<Partial<PersistedDispatchJob>>({});
  const reportProgressRef = useRef<(state: DispatchProgressState) => void>(() => {});

  const reportProgress = useCallback(
    (state: DispatchProgressState) => {
      if (!jobKey || !targetPath) return;
      setProgress(state);
      saveDispatchJob({
        jobKey,
        scope,
        targetPath,
        pane,
        action: state.action,
        progress: state,
        unitPaths: extrasRef.current.unitPaths,
        provider: extrasRef.current.provider,
        customPrompt: extrasRef.current.customPrompt,
        updatedAt: Date.now(),
      });
    },
    [jobKey, pane, scope, targetPath],
  );
  reportProgressRef.current = reportProgress;

  const persistence = useMemo((): DispatchJobPersistence | null => {
    if (!jobKey || !targetPath) return null;
    return {
      jobKey,
      scope,
      targetPath,
      pane,
      extrasRef,
      reportProgress: (state) => reportProgressRef.current(state),
    };
  }, [jobKey, pane, scope, targetPath]);

  useEffect(() => {
    if (!jobKey) {
      setProgress(null);
      return;
    }
    const sync = (changedKey: string) => {
      if (changedKey && changedKey !== jobKey) return;
      setProgress(loadDispatchJob(jobKey)?.progress ?? null);
    };
    sync("");
    return subscribeDispatchJobs(sync);
  }, [jobKey]);

  useEffect(() => {
    if (!jobKey || !targetPath || resumeStartedRef.current) return;
    const job = loadDispatchJob(jobKey);
    if (!job || job.progress.phase !== "running") return;

    if (job.scope === "section" && job.unitPaths && job.unitPaths.length > 0) {
      if (job.progress.completed >= job.unitPaths.length) return;

      resumeStartedRef.current = true;
      extrasRef.current = {
        unitPaths: job.unitPaths,
        provider: job.provider,
        customPrompt: job.customPrompt,
      };
      setDispatching(true);
      const resumeLogs = [...job.progress.logs];
      if (!resumeLogs.some((line) => line.includes("Resuming after reload"))) {
        resumeLogs.push("Resuming after reload…");
      }

      void runFanOutDispatchWithProgress(
        {
          sectionPath: targetPath,
          action: job.action,
          provider: job.provider,
          customPrompt: job.customPrompt,
          resumeFrom: {
            unitPaths: job.unitPaths,
            completed: job.progress.completed,
            logs: resumeLogs,
          },
        },
        (state) => reportProgressRef.current(state),
        persistence ?? undefined,
      )
        .then((count) => {
          if (count > 0) onResumeComplete?.();
        })
        .catch((error) => {
          onError?.(error instanceof Error ? error.message : String(error));
        })
        .finally(() => {
          setDispatching(false);
        });
      return;
    }

    if (job.scope === "unit") {
      resumeStartedRef.current = true;
      markDispatchInterrupted(jobKey);
    }
  }, [jobKey, onError, onResumeComplete, persistence, targetPath]);

  const runUnitDispatch = useCallback(
    async (options: {
      unitPath: string;
      action: AgentDispatchAction;
      provider?: string;
      customPrompt?: string;
    }) => {
      if (!persistence) return;
      extrasRef.current = {
        provider: options.provider,
        customPrompt: options.customPrompt,
      };
      setDispatching(true);
      try {
        await runAgentDispatchWithProgress(
          options,
          (state) => reportProgressRef.current(state),
          persistence,
        );
      } finally {
        setDispatching(false);
      }
    },
    [persistence],
  );

  const runSectionFanOut = useCallback(
    async (options: {
      sectionPath: string;
      action: AgentDispatchAction;
      provider?: string;
      customPrompt?: string;
    }) => {
      if (!persistence) return 0;
      extrasRef.current = {
        provider: options.provider,
        customPrompt: options.customPrompt,
      };
      setDispatching(true);
      try {
        return await runFanOutDispatchWithProgress(
          options,
          (state) => reportProgressRef.current(state),
          persistence,
        );
      } finally {
        setDispatching(false);
      }
    },
    [persistence],
  );

  return {
    progress,
    dispatching,
    runUnitDispatch,
    runSectionFanOut,
  };
}
