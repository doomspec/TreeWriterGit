import type { Express } from "express";

import { exportPaper, exportPaperBatch, resolveExportDownload } from "../export.js";
import { importOverleafFeedback, connectOverleafProject, getOverleafStatus, pushToOverleaf } from "../overleaf.js";
import type { ServerDeps } from "./types.js";

export function registerExportRoutes(app: Express, deps: ServerDeps) {
  app.post("/api/export", async (request, response, next) => {
    try {
      const { paperSlug, format, includeDrafts } = request.body as {
        paperSlug?: string;
        format?: string;
        includeDrafts?: boolean;
      };
      if (!paperSlug?.trim()) {
        response.status(400).json({ error: "paperSlug required" });
        return;
      }
      if (format !== "latex" && format !== "pdf") {
        response.status(400).json({ error: 'format must be "latex" or "pdf"' });
        return;
      }
      const result = await exportPaper(deps.modelRoot, deps.repoRoot, {
        paperSlug: paperSlug.trim(),
        format,
        includeDrafts,
      });
      deps.broadcastModelEvent({ type: "model-changed", path: `papers/${paperSlug.trim()}/INDEX.md` });
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/export/batch", async (request, response, next) => {
    try {
      const { paperSlug, formats, includeDrafts } = request.body as {
        paperSlug?: string;
        formats?: string[];
        includeDrafts?: boolean;
      };
      if (!paperSlug?.trim()) {
        response.status(400).json({ error: "paperSlug required" });
        return;
      }
      const validFormats = (formats ?? ["latex", "pdf"]).filter(
        (f): f is "latex" | "pdf" => f === "latex" || f === "pdf",
      );
      if (validFormats.length === 0) {
        response.status(400).json({ error: "formats must include latex and/or pdf" });
        return;
      }
      const results = await exportPaperBatch(deps.modelRoot, deps.repoRoot, {
        paperSlug: paperSlug.trim(),
        formats: validFormats,
        includeDrafts,
      });
      deps.broadcastModelEvent({ type: "model-changed", path: `papers/${paperSlug.trim()}/INDEX.md` });
      response.json({ results });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/export/download", async (request, response, next) => {
    try {
      const fileName = String(request.query.file ?? "");
      const abs = resolveExportDownload(deps.repoRoot, fileName);
      response.download(abs);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/overleaf/status", async (request, response, next) => {
    try {
      const paperSlug = String(request.query.paperSlug ?? "").trim();
      if (!paperSlug) {
        response.status(400).json({ error: "paperSlug required" });
        return;
      }
      const result = await getOverleafStatus(deps.modelRoot, paperSlug);
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/overleaf/connect", async (request, response, next) => {
    try {
      const { paperSlug, gitUrl, token } = request.body as {
        paperSlug?: string;
        gitUrl?: string;
        token?: string;
      };
      if (!paperSlug?.trim()) {
        response.status(400).json({ error: "paperSlug required" });
        return;
      }
      if (!gitUrl?.trim()) {
        response.status(400).json({ error: "gitUrl required" });
        return;
      }
      const result = await connectOverleafProject(
        deps.modelRoot,
        deps.repoRoot,
        paperSlug.trim(),
        gitUrl.trim(),
        token?.trim(),
      );
      deps.broadcastModelEvent({ type: "model-changed", path: `papers/${paperSlug.trim()}/INDEX.md` });
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/overleaf/push", async (request, response, next) => {
    try {
      const { paperSlug, includeDrafts } = request.body as {
        paperSlug?: string;
        includeDrafts?: boolean;
      };
      if (!paperSlug?.trim()) {
        response.status(400).json({ error: "paperSlug required" });
        return;
      }
      const result = await pushToOverleaf(
        deps.modelRoot,
        deps.repoRoot,
        paperSlug.trim(),
        includeDrafts === true,
      );
      deps.broadcastModelEvent({ type: "model-changed", path: `papers/${paperSlug.trim()}/INDEX.md` });
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/overleaf/import", async (request, response, next) => {
    try {
      const { paperSlug } = request.body as { paperSlug?: string };
      if (!paperSlug?.trim()) {
        response.status(400).json({ error: "paperSlug required" });
        return;
      }
      const result = await importOverleafFeedback(deps.modelRoot, paperSlug.trim());
      if (result.paths.length) {
        for (const rel of result.paths) {
          deps.broadcastModelEvent({ type: "model-changed", path: rel });
        }
      }
      response.json(result);
    } catch (error) {
      next(error);
    }
  });
}
