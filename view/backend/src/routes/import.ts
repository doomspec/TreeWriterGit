import type { Express } from "express";

import { importDocxIntoPaper, previewDocxImport } from "../docxImport.js";
import { asyncHandler } from "./asyncHandler.js";
import { requireBody } from "./params.js";
import type { ServerDeps } from "./types.js";

export function registerImportRoutes(app: Express, deps: ServerDeps): void {
  app.post(
    "/api/import/docx/preview",
    asyncHandler(async (request, response) => {
      const paperSlug = requireBody(request, "paperSlug");
      const dataBase64 = requireBody(request, "data");
      const targetSection =
        typeof request.body?.targetSection === "string"
          ? request.body.targetSection.trim()
          : undefined;
      const replaceTarget = request.body?.replaceTarget !== false;

      const buffer = Buffer.from(dataBase64, "base64");
      const preview = await previewDocxImport(deps.modelRoot, paperSlug.trim(), buffer, {
        targetSection,
        replaceTarget,
      });

      response.json(preview);
    }),
  );

  app.post(
    "/api/import/docx",
    asyncHandler(async (request, response) => {
      const paperSlug = requireBody(request, "paperSlug");
      const dataBase64 = requireBody(request, "data");
      const autoApprove = request.body?.autoApprove !== false;
      const approvedBy =
        typeof request.body?.approvedBy === "string" ? request.body.approvedBy.trim() : null;
      const targetSection =
        typeof request.body?.targetSection === "string"
          ? request.body.targetSection.trim()
          : undefined;
      const replaceTarget = request.body?.replaceTarget !== false;
      const importPlan = Array.isArray(request.body?.importPlan)
        ? request.body.importPlan
        : undefined;

      const buffer = Buffer.from(dataBase64, "base64");
      const result = await importDocxIntoPaper(deps.modelRoot, paperSlug.trim(), buffer, {
        autoApprove,
        approvedBy: approvedBy || "docx-import",
        targetSection,
        replaceTarget,
        importPlan,
      });

      for (const rel of result.paths) {
        deps.broadcastModelEvent({ type: "model-changed", path: rel });
      }

      response.status(201).json(result);
    }),
  );
}
