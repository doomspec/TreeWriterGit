import type { Express } from "express";

import { importBibtexReferences } from "../../bibtexImport.js";
import { uploadFigureImage } from "../../figures.js";
import { resolveModelPath } from "../../modelFs.js";
import { asyncHandler } from "../asyncHandler.js";
import { bodyString, requireBody } from "../params.js";
import type { ServerDeps } from "../types.js";

export function registerModelAssetRoutes(app: Express, deps: ServerDeps): void {
  app.post(
    "/api/model/figure/upload",
    asyncHandler(async (request, response) => {
      const figurePath = requireBody(request, "path");
      const filename = bodyString(request, "filename") || "preview.png";
      const dataBase64 = requireBody(request, "data");
      resolveModelPath(deps.modelRoot, figurePath.replace(/\.md$/, ""));
      const buffer = Buffer.from(dataBase64, "base64");
      if (buffer.length === 0) {
        response.status(400).json({ error: "Empty file data" });
        return;
      }
      if (buffer.length > 20 * 1024 * 1024) {
        response.status(400).json({ error: "File too large (max 20MB)" });
        return;
      }
      const roleRaw = bodyString(request, "role");
      const role =
        roleRaw === "preview" || roleRaw === "source" || roleRaw === "both" ? roleRaw : "auto";
      const result = await uploadFigureImage(deps.modelRoot, figurePath, filename, buffer, role);
      deps.broadcastModelEvent({ type: "model-changed", path: result.assetPath });
      response.status(201).json(result);
    }),
  );

  app.post(
    "/api/model/references/import",
    asyncHandler(async (request, response) => {
      const paperPath = requireBody(request, "paper");
      const bibtex = requireBody(request, "bibtex");
      resolveModelPath(deps.modelRoot, paperPath);
      const result = await importBibtexReferences(deps.modelRoot, paperPath, bibtex);
      if (result.created.length > 0) {
        deps.broadcastModelEvent({ type: "model-changed", path: `${paperPath}/notes/literature` });
      }
      response.status(201).json(result);
    }),
  );
}
