import type { Express } from "express";

import type { DocumentType } from "@treewriter/shared";
import {
  deletePaper,
  getManuscriptDetail,
  getPaperDetail,
  listManuscriptTemplates,
  listJournalTemplateDetails,
  listManuscripts,
  listPapers,
  scaffoldManuscript,
  scaffoldPaper,
  updateManuscript,
  updatePaper,
} from "../papers.js";
import type { ServerDeps } from "./types.js";

function parseDocType(raw: unknown): DocumentType | undefined {
  if (raw === "paper" || raw === "grant" || raw === "report") return raw;
  return undefined;
}

export function registerPapersRoutes(app: Express, deps: ServerDeps) {
  app.get("/api/manuscript/templates", async (request, response, next) => {
    try {
      const docType = parseDocType(request.query.docType);
      const templates = await listManuscriptTemplates(deps.modelRoot, { docType });
      response.json({ templates });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/paper/templates", async (_request, response, next) => {
    try {
      const templates = await listJournalTemplateDetails(deps.modelRoot);
      response.json({
        journals: templates.map((template) => template.journal ?? template.label),
        templates,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/manuscripts", async (request, response, next) => {
    try {
      const slug = String(request.query.slug ?? "");
      if (slug) {
        response.json({ manuscript: await getManuscriptDetail(deps.modelRoot, slug) });
        return;
      }
      const docType = parseDocType(request.query.docType);
      const tag = String(request.query.tag ?? "").trim() || undefined;
      response.json({ manuscripts: await listManuscripts(deps.modelRoot, { docType, tag }) });
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
      const docType = parseDocType(request.query.docType);
      const tag = String(request.query.tag ?? "").trim() || undefined;
      response.json({ papers: await listPapers(deps.modelRoot, { docType, tag }) });
    } catch (error) {
      next(error);
    }
  });

  const handleCreate = async (body: Record<string, unknown>) => {
    const title = String(body.title ?? "").trim();
    const journal = String(body.journal ?? "").trim();
    const templateId = String(body.templateId ?? body.template_id ?? "").trim();
    const docType = parseDocType(body.docType ?? body.doc_type);
    if (!title) {
      return { status: 400 as const, body: { error: "title required" } };
    }
    if (!templateId && !journal && !docType) {
      return { status: 400 as const, body: { error: "templateId, journal, or docType required" } };
    }
    const created = await scaffoldManuscript(deps.modelRoot, {
      title,
      journal: journal || undefined,
      templateId: templateId || undefined,
      docType,
      authors: Array.isArray(body.authors) ? (body.authors as string[]) : [],
      slug: body.slug ? String(body.slug) : undefined,
      targetWords: typeof body.targetWords === "number" ? body.targetWords : undefined,
      sectionOrder: Array.isArray(body.sectionOrder) ? (body.sectionOrder as string[]) : undefined,
      status: body.status ? String(body.status) : undefined,
      overleafRepoPath: body.overleafRepoPath as string | null | undefined,
      funder: body.funder ? String(body.funder) : undefined,
      program: body.program ? String(body.program) : undefined,
      deadline: body.deadline ? String(body.deadline) : undefined,
      audience: body.audience ? String(body.audience) : undefined,
      tags: Array.isArray(body.tags) ? (body.tags as string[]) : undefined,
      project: body.project != null ? String(body.project) : undefined,
      contributionMode:
        body.contributionMode === "kernel" || body.contributionMode === "repository"
          ? body.contributionMode
          : undefined,
      agentSummary: body.agentSummary ? String(body.agentSummary) : undefined,
    });
    deps.broadcastModelEvent({ type: "model-changed", path: `${created.path}/INDEX.md` });
    return { status: 201 as const, body: { ok: true, ...created } };
  };

  app.post("/api/manuscript", async (request, response, next) => {
    try {
      const result = await handleCreate(request.body as Record<string, unknown>);
      response.status(result.status).json(result.body);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/paper", async (request, response, next) => {
    try {
      const body = request.body as Record<string, unknown>;
      const title = String(body.title ?? "").trim();
      const journal = String(body.journal ?? "").trim();
      if (!title || !journal) {
        response.status(400).json({ error: "title and journal required" });
        return;
      }
      const created = await scaffoldPaper(deps.modelRoot, {
        title,
        journal,
        authors: Array.isArray(body.authors) ? (body.authors as string[]) : [],
        slug: body.slug ? String(body.slug) : undefined,
        targetWords: typeof body.targetWords === "number" ? body.targetWords : undefined,
        sectionOrder: Array.isArray(body.sectionOrder) ? (body.sectionOrder as string[]) : undefined,
        status: body.status ? String(body.status) : undefined,
        overleafRepoPath: body.overleafRepoPath as string | null | undefined,
      });
      deps.broadcastModelEvent({ type: "model-changed", path: `${created.path}/INDEX.md` });
      response.status(201).json({ ok: true, ...created });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/manuscript", async (request, response, next) => {
    try {
      const body = request.body as Record<string, unknown>;
      const slug = String(body.slug ?? "").trim();
      const title = String(body.title ?? "").trim();
      if (!slug || !title) {
        response.status(400).json({ error: "slug and title required" });
        return;
      }
      const updated = await updateManuscript(deps.modelRoot, {
        slug,
        title,
        journal: body.journal ? String(body.journal) : undefined,
        templateId: body.templateId ? String(body.templateId) : undefined,
        authors: Array.isArray(body.authors) ? (body.authors as string[]) : [],
        targetWords: typeof body.targetWords === "number" ? body.targetWords : undefined,
        sectionOrder: Array.isArray(body.sectionOrder) ? (body.sectionOrder as string[]) : undefined,
        status: body.status ? String(body.status) : undefined,
        overleafRepoPath: body.overleafRepoPath as string | null | undefined,
        funder: body.funder != null ? String(body.funder) : undefined,
        program: body.program != null ? String(body.program) : undefined,
        deadline: body.deadline != null ? String(body.deadline) : undefined,
        audience: body.audience != null ? String(body.audience) : undefined,
        tags: Array.isArray(body.tags) ? (body.tags as string[]) : undefined,
        project: body.project != null ? String(body.project) : undefined,
        contributionMode:
          body.contributionMode === "kernel" || body.contributionMode === "repository"
            ? body.contributionMode
            : body.contributionMode === null
              ? null
              : undefined,
        agentSummary: body.agentSummary != null ? String(body.agentSummary) : undefined,
      });
      deps.broadcastModelEvent({ type: "model-changed", path: `${updated.path}/INDEX.md` });
      response.json({ ok: true, ...updated });
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

  app.delete("/api/manuscript", async (request, response, next) => {
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
