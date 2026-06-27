import type { Express } from "express";

import { registerModelApprovalRoutes } from "./approval.js";
import { registerModelAssetsReadRoutes } from "./assets-read.js";
import { registerModelCrudRoutes } from "./crud.js";
import { registerModelDiscoveryRoutes } from "./discovery.js";
import { registerModelTrashRoutes } from "./trash.js";
import type { ServerDeps } from "../types.js";

export function registerModelRoutes(app: Express, deps: ServerDeps): void {
  registerModelDiscoveryRoutes(app, deps);
  registerModelCrudRoutes(app, deps);
  registerModelTrashRoutes(app, deps);
  registerModelApprovalRoutes(app, deps);
  registerModelAssetsReadRoutes(app, deps);
}
