import type { Express } from "express";

import {
  registerAgentRoutes,
  registerCommentsRoutes,
  registerContributorsRoutes,
  registerExportRoutes,
  registerImportRoutes,
  registerModelRoutes,
  registerPapersRoutes,
  registerPresenceRoutes,
  registerSettingsRoutes,
} from "../routes/index.js";
import { registerZoteroRoutes } from "../routes/zotero.js";
import { registerModelAssetRoutes } from "../routes/model/assets.js";
import type { ServerDeps } from "../routes/types.js";

/** Register all HTTP API route groups on the Express app. */
export function registerAppRoutes(app: Express, deps: ServerDeps): void {
  registerSettingsRoutes(app, deps);
  registerZoteroRoutes(app, deps);
  registerCommentsRoutes(app, deps);
  registerContributorsRoutes(app, deps);
  registerPresenceRoutes(app, deps);
  registerPapersRoutes(app, deps);
  registerExportRoutes(app, deps);
  registerImportRoutes(app, deps);
  registerAgentRoutes(app, deps);
  registerModelAssetRoutes(app, deps);
  registerModelRoutes(app, deps);
}
