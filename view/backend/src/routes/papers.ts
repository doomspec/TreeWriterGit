import type { Express } from "express";

import {
  deletePaper,
  getPaperDetail,
  listJournalTemplateDetails,
  listPapers,
  scaffoldPaper,
  updatePaper,
} from "../papers.js";
import type { ServerDeps } from "./types.js";

export function registerPapersRoutes(app: Express, deps: ServerDeps) {
  app.get("/api/paper/templates", async (_request, response, next) => {
    try {
      const templates = await listJournalTemplateDetails(deps.modelRoot);
      response.json({
        journals: templates.map((template) => template.journal),
        templates,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/papers", async (request, response, next) => {
    try {
      const slug = String(request.query.slug ?? "");
      if (slug) {
        response.json({ paper: await getPaperDetail(deps.modelRoot, slug) });
        return;
      }
      response.json({ papers: await listPapers(deps.modelRoot) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/paper", async (request, response, next) => {
    try {
      const { title, journal, authors, slug, targetWords, sectionOrder, status, overleafRepoPath } =
        request.body as {
          title?: string;
          journal?: string;
          authors?: string[];
          slug?: string;
          targetWords?: number;
          sectionOrder?: string[];
          status?: string;
          overleafRepoPath?: string | null;
        };
      if (!title?.trim() || !journal?.trim()) {
        response.status(400).json({ error: "title and journal required" });
        return;
      }
      const created = await scaffoldPaper(deps.modelRoot, {
        title: title.trim(),
        journal: journal.trim(),
        authors: Array.isArray(authors) ? authors : [],
        slug,
        targetWords,
        sectionOrder,
        status,
        overleafRepoPath,
      });
      deps.broadcastModelEvent({ type: "model-changed", path: `${created.path}/INDEX.md` });
      response.status(201).json({ ok: true, ...created });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/paper", async (request, response, next) => {
    try {
      const { slug, title, journal, authors, targetWords, sectionOrder, status, overleafRepoPath } =
        request.body as {
          slug?: string;
          title?: string;
          journal?: string;
          authors?: string[];
          targetWords?: number;
          sectionOrder?: string[];
          status?: string;
          overleafRepoPath?: string | null;
        };
      if (!slug?.trim() || !title?.trim() || !journal?.trim()) {
        response.status(400).json({ error: "slug, title, and journal required" });
        return;
      }
      const updated = await updatePaper(deps.modelRoot, {
        slug: slug.trim(),
        title: title.trim(),
        journal: journal.trim(),
        authors: Array.isArray(authors) ? authors : [],
        targetWords,
        sectionOrder,
        status,
        overleafRepoPath,
      });
      deps.broadcastModelEvent({ type: "model-changed", path: `${updated.path}/INDEX.md` });
      response.json({ ok: true, ...updated });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/paper", async (request, response, next) => {
    try {
      const slug = String(request.query.slug ?? "").trim();
      if (!slug) {
        response.status(400).json({ error: "slug required" });
        return;
      }
      const deleted = await deletePaper(deps.modelRoot, slug);
      deps.broadcastModelEvent({ type: "model-changed", path: "papers" });
      response.json({ ok: true, ...deleted });
    } catch (error) {
      next(error);
    }
  });
}
