import type { Express } from "express";

import {
  getPaperDetail,
  listJournalTemplates,
  listPapers,
  scaffoldPaper,
} from "../papers.js";
import type { ServerDeps } from "./types.js";

export function registerPapersRoutes(app: Express, deps: ServerDeps) {
  app.get("/api/paper/templates", async (_request, response, next) => {
    try {
      response.json({ journals: await listJournalTemplates(deps.modelRoot) });
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
      const { title, journal, authors, slug } = request.body as {
        title?: string;
        journal?: string;
        authors?: string[];
        slug?: string;
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
      });
      deps.broadcastModelEvent({ type: "model-changed", path: `${created.path}/INDEX.md` });
      response.status(201).json({ ok: true, ...created });
    } catch (error) {
      next(error);
    }
  });
}
