import type { Express } from "express";

import {
  addMainBibEntryFromCrossref,
  deleteMainBibEntries,
  importMainBibtex,
  markMainBibEntryVerified,
  previewMainBibEntryFromCrossref,
  previewNewBibEntryFromCrossref,
  searchCrossrefCandidates,
  updateMainBibEntry,
  updateMainBibEntryFromCrossref,
} from "../../bibLibrary.js";
import { uploadFigureImage } from "../../figures.js";
import { removeCiteKeyFromPaperDrafts } from "../../paperCitations.js";
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
      const result = await importMainBibtex(deps.modelRoot, bibtex);
      if (result.created.length > 0) {
        deps.broadcastModelEvent({ type: "model-changed", path: "main.bib" });
      }
      response.status(201).json(result);
    }),
  );

  app.post(
    "/api/model/references/remove-from-text",
    asyncHandler(async (request, response) => {
      const paperPath = requireBody(request, "paper");
      const citeKey = requireBody(request, "citeKey");
      resolveModelPath(deps.modelRoot, paperPath);
      const result = await removeCiteKeyFromPaperDrafts(deps.modelRoot, paperPath, citeKey);
      for (const relPath of result.modified) {
        deps.broadcastModelEvent({ type: "model-changed", path: relPath });
      }
      response.json(result);
    }),
  );

  app.post(
    "/api/model/bib/import",
    asyncHandler(async (request, response) => {
      const bibtex = requireBody(request, "bibtex");
      const result = await importMainBibtex(deps.modelRoot, bibtex);
      if (result.created.length > 0) {
        deps.broadcastModelEvent({ type: "model-changed", path: "main.bib" });
      }
      response.status(201).json(result);
    }),
  );

  app.put(
    "/api/model/bib/entry",
    asyncHandler(async (request, response) => {
      const citeKey = requireBody(request, "citeKey");
      const fields =
        request.body?.fields && typeof request.body.fields === "object"
          ? (request.body.fields as Record<string, string>)
          : {};
      const entry = await updateMainBibEntry(deps.modelRoot, citeKey, {
        nextCiteKey: bodyString(request, "nextCiteKey") || citeKey,
        type: bodyString(request, "type") || undefined,
        fields,
      });
      deps.broadcastModelEvent({ type: "model-changed", path: "main.bib" });
      response.json({ entry });
    }),
  );

  app.post(
    "/api/model/bib/verify",
    asyncHandler(async (request, response) => {
      const citeKey = requireBody(request, "citeKey");
      const entry = await markMainBibEntryVerified(deps.modelRoot, citeKey);
      deps.broadcastModelEvent({ type: "model-changed", path: "main.bib" });
      response.json({ entry });
    }),
  );

  app.post(
    "/api/model/bib/delete",
    asyncHandler(async (request, response) => {
      const raw = request.body?.citeKeys;
      const citeKeys = Array.isArray(raw)
        ? raw.filter((key): key is string => typeof key === "string")
        : [];
      const result = await deleteMainBibEntries(deps.modelRoot, citeKeys);
      if (result.deleted.length > 0) {
        deps.broadcastModelEvent({ type: "model-changed", path: "main.bib" });
      }
      response.json(result);
    }),
  );

  app.post(
    "/api/model/bib/crossref/search",
    asyncHandler(async (request, response) => {
      const title = requireBody(request, "title");
      const rows = Number(request.body?.rows ?? 5);
      response.json({ candidates: await searchCrossrefCandidates(title, rows) });
    }),
  );

  app.post(
    "/api/model/bib/crossref/preview",
    asyncHandler(async (request, response) => {
      const citeKey = requireBody(request, "citeKey");
      const doi = requireBody(request, "doi");
      const entry = await previewMainBibEntryFromCrossref(deps.modelRoot, citeKey, doi);
      response.json({ entry });
    }),
  );

  app.post(
    "/api/model/bib/crossref/preview-new",
    asyncHandler(async (request, response) => {
      const doi = requireBody(request, "doi");
      const entry = await previewNewBibEntryFromCrossref(deps.modelRoot, doi);
      response.json({ entry });
    }),
  );

  app.post(
    "/api/model/bib/crossref/add",
    asyncHandler(async (request, response) => {
      const doi = requireBody(request, "doi");
      const result = await addMainBibEntryFromCrossref(deps.modelRoot, doi);
      deps.broadcastModelEvent({ type: "model-changed", path: "main.bib" });
      response.status(result.created ? 201 : 200).json(result);
    }),
  );

  app.post(
    "/api/model/bib/crossref/update",
    asyncHandler(async (request, response) => {
      const citeKey = requireBody(request, "citeKey");
      const doi = requireBody(request, "doi");
      const entry = await updateMainBibEntryFromCrossref(deps.modelRoot, citeKey, doi);
      deps.broadcastModelEvent({ type: "model-changed", path: "main.bib" });
      response.json({ entry });
    }),
  );
}
