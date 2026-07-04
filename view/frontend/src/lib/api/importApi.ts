import { request } from "@/lib/apiClient";
import type { DocxImportPreview, DocxImportPreviewNode, DocxImportResult } from "@treewriter/shared";

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function docxRequestBody(body: {
  paperSlug: string;
  file: File;
  autoApprove?: boolean;
  targetSection?: string;
  replaceTarget?: boolean;
  importPlan?: import("@treewriter/shared").DocxImportPreviewNode[];
}) {
  const data = await fileToBase64(body.file);
  return {
    paperSlug: body.paperSlug,
    filename: body.file.name,
    data,
    autoApprove: body.autoApprove !== false,
    targetSection: body.targetSection || undefined,
    replaceTarget: body.replaceTarget !== false,
    importPlan: body.importPlan,
  };
}

export async function previewDocxImport(body: {
  paperSlug: string;
  file: File;
  targetSection?: string;
  replaceTarget?: boolean;
}): Promise<DocxImportPreview> {
  const payload = await docxRequestBody(body);
  return request<DocxImportPreview>("/api/import/docx/preview", {
    method: "POST",
    body: JSON.stringify({
      paperSlug: payload.paperSlug,
      filename: payload.filename,
      data: payload.data,
      targetSection: payload.targetSection,
      replaceTarget: payload.replaceTarget,
    }),
  });
}

export async function importDocxIntoPaper(body: {
  paperSlug: string;
  file: File;
  autoApprove?: boolean;
  targetSection?: string;
  replaceTarget?: boolean;
  importPlan?: DocxImportPreviewNode[];
}): Promise<DocxImportResult> {
  const payload = await docxRequestBody(body);
  return request<DocxImportResult>("/api/import/docx", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
