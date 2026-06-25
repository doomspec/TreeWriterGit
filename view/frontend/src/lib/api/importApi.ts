import { request } from "@/lib/apiClient";
import type { DocxImportResult } from "@treewriter/shared";

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

export async function importDocxIntoPaper(body: {
  paperSlug: string;
  file: File;
  autoApprove?: boolean;
}): Promise<DocxImportResult> {
  const data = await fileToBase64(body.file);
  return request<DocxImportResult>("/api/import/docx", {
    method: "POST",
    body: JSON.stringify({
      paperSlug: body.paperSlug,
      filename: body.file.name,
      data,
      autoApprove: body.autoApprove !== false,
    }),
  });
}
