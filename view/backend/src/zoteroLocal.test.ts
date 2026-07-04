import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  extractBbtCiteKey,
  normalizeZoteroItem,
  importZoteroItemsToMainBib,
} from "./zoteroLocal.js";
import {
  assertLocalZoteroBaseUrl,
  loadZoteroLocalConfig,
  saveZoteroLocalPreferences,
} from "./zoteroLocalConfig.js";

describe("assertLocalZoteroBaseUrl", () => {
  it("accepts localhost loopback hosts", () => {
    expect(assertLocalZoteroBaseUrl("http://127.0.0.1:23119/api")).toBe(
      "http://127.0.0.1:23119/api",
    );
    expect(assertLocalZoteroBaseUrl("http://localhost:23119/api/")).toBe(
      "http://localhost:23119/api",
    );
  });

  it("rejects non-local hosts", () => {
    expect(() => assertLocalZoteroBaseUrl("http://192.168.1.1:23119/api")).toThrow(/localhost/i);
    expect(() => assertLocalZoteroBaseUrl("http://evil.com/api")).toThrow(/localhost/i);
  });
});

describe("extractBbtCiteKey", () => {
  it("parses Better BibTeX citation key from extra", () => {
    expect(extractBbtCiteKey("Citation Key: smith2020\nOther: x")).toBe("smith2020");
    expect(extractBbtCiteKey("bibtex: foo2021")).toBe("foo2021");
  });

  it("returns null when no key", () => {
    expect(extractBbtCiteKey("")).toBeNull();
    expect(extractBbtCiteKey("notes only")).toBeNull();
  });
});

describe("normalizeZoteroItem", () => {
  it("maps Zotero JSON to search hit", () => {
    const hit = normalizeZoteroItem({
      key: "ABC123",
      data: {
        title: "Test Paper",
        creators: [{ lastName: "Smith", firstName: "A." }],
        date: "2020-05-01",
        DOI: "10.1234/example",
        extra: "Citation Key: smith2020",
        itemType: "journalArticle",
      },
    });
    expect(hit).toEqual({
      itemKey: "ABC123",
      title: "Test Paper",
      authors: "Smith, A.",
      year: "2020",
      doi: "10.1234/example",
      citeKey: "smith2020",
      itemType: "journalArticle",
    });
  });
});

describe("zoteroLocalConfig", () => {
  it("loads and saves preferences in .treewriter.json", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "tw-zotero-"));
    await writeFile(path.join(dir, ".treewriter.json"), "{}\n", "utf8");
    const initial = await loadZoteroLocalConfig(dir);
    expect(initial.enabled).toBe(false);
    await saveZoteroLocalPreferences(dir, { enabled: true, baseUrl: "http://127.0.0.1:23119/api" });
    const saved = JSON.parse(await readFile(path.join(dir, ".treewriter.json"), "utf8")) as {
      zoteroLocal: { enabled: boolean; baseUrl: string };
    };
    expect(saved.zoteroLocal.enabled).toBe(true);
    expect(saved.zoteroLocal.baseUrl).toBe("http://127.0.0.1:23119/api");
  });
});

describe("importZoteroItemsToMainBib", () => {
  it("imports bibtex from mocked Zotero export", async () => {
    const modelRoot = await mkdtemp(path.join(os.tmpdir(), "tw-zotero-model-"));
    const config = { enabled: true, baseUrl: "http://127.0.0.1:23119/api" };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        '@article{smith2020,\n  title={Test Paper},\n  author={Smith, A.},\n  year={2020}\n}\n',
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await importZoteroItemsToMainBib(modelRoot, config, ["ABC123"]);
      expect(result.created).toContain("smith2020");
      expect(result.citeKeys).toContain("smith2020");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
