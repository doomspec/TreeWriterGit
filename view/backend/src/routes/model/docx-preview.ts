import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import type { Express } from "express";

import { convertDocxBufferToMarkdown } from "../../import/index.js";
import { ModelFsError, resolveModelPath } from "../../modelFs.js";
import { asyncHandler } from "../asyncHandler.js";
import type { ServerDeps } from "../types.js";

export function registerModelDocxPreviewRoutes(app: Express, deps: ServerDeps): void {
  app.get(
    "/api/model/docx-preview",
    asyncHandler(async (request, response) => {
      const relativePath = String(request.query.path ?? "").trim();
      if (!relativePath) {
        response.status(400).json({ error: "path query parameter is required" });
        return;
      }
      const absolutePath = resolveModelPath(deps.modelRoot, relativePath);
      if (!existsSync(absolutePath)) {
        throw new ModelFsError(`Not found: ${relativePath}`, 404);
      }
      const fileStat = await stat(absolutePath);
      if (!fileStat.isFile()) {
        response.status(400).json({ error: "Path is not a file" });
        return;
      }
      const buffer = await readFile(absolutePath);
      const markdown = await convertDocxBufferToMarkdown(buffer);
      response.json({ markdown });
    }),
  );
}
