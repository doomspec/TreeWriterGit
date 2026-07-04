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
import { listPaperCitedReferences } from "../../paperCitations.js";
import {
  listMainBibReferences,
  readMainBibEntries,
  getMainBibSummary,
  searchMainBibReferences,
  getMainBibEntry,
  type BibVerificationStatus,
} from "../../bibLibrary.js";
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
      const references = await listMainBibReferences(deps.modelRoot);
      response.json({
        references:
          references.length > 0 ? references : await listPaperReferences(deps.modelRoot, paperPath),
      });
    }),
  );

  app.get(
    "/api/model/references/cited",
    asyncHandler(async (request, response) => {
      const paperPath = String(request.query.paper ?? "").trim();
      if (!paperPath) {
        response.status(400).json({ error: "paper query parameter is required" });
        return;
      }
      resolveModelPath(deps.modelRoot, paperPath);
      response.json({ references: await listPaperCitedReferences(deps.modelRoot, paperPath) });
    }),
  );

  app.get(
    "/api/model/bib",
    asyncHandler(async (_request, response) => {
      response.json({ entries: await readMainBibEntries(deps.modelRoot) });
    }),
  );

  app.get(
    "/api/model/bib/summary",
    asyncHandler(async (_request, response) => {
      response.json(await getMainBibSummary(deps.modelRoot));
    }),
  );

  app.get(
    "/api/model/bib/search",
    asyncHandler(async (request, response) => {
      const q = String(request.query.q ?? "").trim();
      const offset = Number.parseInt(String(request.query.offset ?? "0"), 10);
      const limit = Number.parseInt(String(request.query.limit ?? "80"), 10);
      const statusRaw = String(request.query.status ?? "all").trim();
      const status =
        statusRaw === "verified" || statusRaw === "stale" || statusRaw === "unverified"
          ? (statusRaw as BibVerificationStatus)
          : "all";
      response.json(
        await searchMainBibReferences(deps.modelRoot, {
          q: q || undefined,
          offset: Number.isFinite(offset) ? offset : 0,
          limit: Number.isFinite(limit) ? limit : 80,
          status,
        }),
      );
    }),
  );

  app.get(
    "/api/model/bib/entry/:citeKey",
    asyncHandler(async (request, response) => {
      const citeKey = decodeURIComponent(String(request.params.citeKey ?? "").trim());
      if (!citeKey) {
        response.status(400).json({ error: "citeKey is required" });
        return;
      }
      response.json({ entry: await getMainBibEntry(deps.modelRoot, citeKey) });
    }),
  );
}
