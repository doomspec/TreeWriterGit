import path from "node:path";
import { readFile, stat } from "node:fs/promises";
import type { Express } from "express";

import { buildPaperCrossRefIndex } from "../../crossRefIndex.js";
import { resolveEquationMetadata } from "../../equations.js";
import {
  assetContentType,
  isAllowedAssetPath,
  listPaperFigures,
  resolveFigureMetadata,
} from "../../figures.js";
import { resolveModelPath } from "../../modelFs.js";
import { listPaperAssets, listPaperReferences } from "../../paperAssets.js";
import { asyncHandler } from "../asyncHandler.js";
import type { ServerDeps } from "../types.js";

export function registerModelAssetsReadRoutes(app: Express, deps: ServerDeps): void {
  app.get(
    "/api/model/asset",
    asyncHandler(async (request, response) => {
      const relativePath = String(request.query.path ?? "").trim();
      if (!relativePath) {
        response.status(400).json({ error: "path query parameter is required" });
        return;
      }
      if (!isAllowedAssetPath(relativePath)) {
        response.status(400).json({ error: "Unsupported asset type" });
        return;
      }
      const absolutePath = resolveModelPath(deps.modelRoot, relativePath);
      const fileStat = await stat(absolutePath);
      if (!fileStat.isFile()) {
        response.status(400).json({ error: "Path is not a file" });
        return;
      }
      const ext = path.extname(relativePath).toLowerCase();
      const body =
        ext === ".mmd" || ext === ".svg" || ext === ".tex"
          ? await readFile(absolutePath, "utf8")
          : await readFile(absolutePath);
      response.setHeader("Content-Type", assetContentType(relativePath));
      response.send(body);
    }),
  );

  app.get(
    "/api/model/figure",
    asyncHandler(async (request, response) => {
      const pathParam = String(request.query.path ?? "").trim();
      if (!pathParam) {
        response.status(400).json({ error: "path query parameter is required" });
        return;
      }
      resolveModelPath(deps.modelRoot, pathParam.replace(/\.md$/, ""));
      const figure = await resolveFigureMetadata(deps.modelRoot, pathParam);
      if (!figure) {
        response.status(404).json({ error: "Figure not found" });
        return;
      }
      response.json(figure);
    }),
  );

  app.get(
    "/api/model/equation",
    asyncHandler(async (request, response) => {
      const pathParam = String(request.query.path ?? "").trim();
      if (!pathParam) {
        response.status(400).json({ error: "path query parameter is required" });
        return;
      }
      resolveModelPath(deps.modelRoot, pathParam.replace(/\.md$/, ""));
      const equation = await resolveEquationMetadata(deps.modelRoot, pathParam);
      if (!equation) {
        response.status(404).json({ error: "Equation not found" });
        return;
      }
      response.json(equation);
    }),
  );

  app.get(
    "/api/model/figures",
    asyncHandler(async (request, response) => {
      const paperPath = String(request.query.paper ?? "").trim();
      if (!paperPath) {
        response.status(400).json({ error: "paper query parameter is required" });
        return;
      }
      resolveModelPath(deps.modelRoot, paperPath);
      response.json({ figures: await listPaperFigures(deps.modelRoot, paperPath) });
    }),
  );

  app.get(
    "/api/model/assets",
    asyncHandler(async (request, response) => {
      const paperPath = String(request.query.paper ?? "").trim();
      if (!paperPath) {
        response.status(400).json({ error: "paper query parameter is required" });
        return;
      }
      resolveModelPath(deps.modelRoot, paperPath);
      response.json(await listPaperAssets(deps.modelRoot, paperPath));
    }),
  );

  app.get(
    "/api/model/crossref-index",
    asyncHandler(async (request, response) => {
      const paperPath = String(request.query.paper ?? "").trim();
      if (!paperPath) {
        response.status(400).json({ error: "paper query parameter is required" });
        return;
      }
      resolveModelPath(deps.modelRoot, paperPath);
      response.json(await buildPaperCrossRefIndex(deps.modelRoot, paperPath));
    }),
  );

  app.get(
    "/api/model/references/index",
    asyncHandler(async (request, response) => {
      const paperPath = String(request.query.paper ?? "").trim();
      if (!paperPath) {
        response.status(400).json({ error: "paper query parameter is required" });
        return;
      }
      resolveModelPath(deps.modelRoot, paperPath);
      response.json({ references: await listPaperReferences(deps.modelRoot, paperPath) });
    }),
  );
}
