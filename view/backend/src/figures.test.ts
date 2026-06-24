import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import matter from "gray-matter";

import {
  assetContentType,
  isAllowedAssetPath,
  isFigureImageExtension,
  resolveFigureMetadata,
  uploadFigureImage,
} from "./figures.js";
import { createNode } from "./modelFs.js";

describe("figures asset helpers", () => {
  it("allows supported asset extensions", () => {
    expect(isAllowedAssetPath("papers/x/preview.png")).toBe(true);
    expect(isAllowedAssetPath("papers/x/source.mmd")).toBe(true);
    expect(isAllowedAssetPath("papers/x/draft.md")).toBe(false);
  });

  it("maps content types", () => {
    expect(assetContentType("x.png")).toBe("image/png");
    expect(assetContentType("x.mmd")).toContain("text/plain");
  });

  it("detects image upload extensions", () => {
    expect(isFigureImageExtension("preview.png")).toBe(true);
    expect(isFigureImageExtension("figure.pdf")).toBe(true);
    expect(isFigureImageExtension("source.mmd")).toBe(false);
  });
});

describe("uploadFigureImage", () => {
  it("writes image and updates figure unit INDEX", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "tw-fig-up-"));
    const paperRel = "papers/demo";
    await mkdir(path.join(root, paperRel, "figures"), { recursive: true });
    await createNode(root, `${paperRel}/figures`, "fig1", "figure");

    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const result = await uploadFigureImage(root, `${paperRel}/figures/fig1`, "preview.png", png);
    expect(result.assetPath).toBe(`${paperRel}/figures/fig1/preview.png`);
    expect(result.figure.previewPath).toBe(`${paperRel}/figures/fig1/preview.png`);

    const indexRaw = await readFile(path.join(root, paperRel, "figures/fig1/INDEX.md"), "utf8");
    const indexData = matter(indexRaw).data as Record<string, unknown>;
    expect(indexData.figure_preview).toBe("preview.png");
    expect(indexData.figure_source).toBe("preview.png");

    const meta = await resolveFigureMetadata(root, `${paperRel}/figures/fig1`);
    expect(meta?.previewPath).toBe(`${paperRel}/figures/fig1/preview.png`);
  });
});
