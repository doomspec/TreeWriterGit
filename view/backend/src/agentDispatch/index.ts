export type { AiProvider, ProviderConfig } from "./providers.js";
export {
  DEFAULT_PROVIDERS,
  GEMINI_WORKSPACE_PREAMBLE,
  isGeminiProvider,
  loadProviders,
  saveDefaultProvider,
} from "./providers.js";

export type { DispatchAction } from "./templates.js";
export { actionNeedsDraft, TEMPLATES } from "./templates.js";

export type { ContextCandidate } from "./context.js";
export {
  collectDescendantManuscriptPaths,
  collectUnitPaths,
  gatherContextFromPaths,
  gatherSummarizeOutlineContext,
  listContextCandidates,
  listSummarizeOutlineContextPaths,
  paperRelFromUnitPath,
} from "./context.js";

export type { PreviewResult } from "./commands.js";
export {
  buildFanOutPreviews,
  buildPreview,
  buildProviderCommand,
  promptFileRelFromModelCwd,
  promptSessionId,
  promptsDirectory,
} from "./commands.js";

export {
  buildGitSyncResolvePreview,
  dispatchExecEnv,
  execDispatchCommand,
  runDispatch,
  runFanOutDispatch,
} from "./exec.js";
