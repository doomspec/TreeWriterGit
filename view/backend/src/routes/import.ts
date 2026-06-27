import type { Express } from "express";

import { importDocxIntoPaper } from "../docxImport.js";
import { asyncHandler } from "./asyncHandler.js";
import { requireBody } from "./params.js";
import type { ServerDeps } from "./types.js";

export function registerImportRoutes(app: Express, deps: ServerDeps): void {
  app.post(
    "/api/import/docx",
    asyncHandler(async (request, response) => {
      const paperSlug = requireBody(request, "paperSlug");
      const dataBase64 = requireBody(request, "data");
      const autoApprove = request.body?.autoApprove !== false;
      const approvedBy =
        typeof request.body?.approvedBy === "string" ? request.body.approvedBy.trim() : null;

      const buffer = Buffer.from(dataBase64, "base64");
      const result = await importDocxIntoPaper(deps.modelRoot, paperSlug.trim(), buffer, {
        autoApprove,
        approvedBy: approvedBy || "docx-import",
      });

      for (const rel of result.paths) {
        deps.broadcastModelEvent({ type: "model-changed", path: rel });
      }

      response.status(201).json(result);
    }),
  );
}
