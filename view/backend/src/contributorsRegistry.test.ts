import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  importRegistryAffiliation,
  importRegistryAuthor,
  mergeContributorsRegistry,
} from "@treewriter/shared";

import {
  CONTRIBUTORS_REGISTRY_FILE,
  readContributorsRegistry,
  upsertContributorsFromManuscript,
  writeContributorsRegistry,
} from "./contributorsRegistry.js";

let modelRoot: string;

beforeEach(async () => {
  modelRoot = await mkdtemp(path.join(os.tmpdir(), "tw-contributors-"));
});

afterEach(async () => {
  await rm(modelRoot, { recursive: true, force: true });
});

describe("contributors registry merge helpers", () => {
  it("dedupes affiliations and authors by normalized keys", () => {
    const merged = mergeContributorsRegistry(
      { affiliations: ["Cambridge"], authors: [] },
      [
        {
          firstName: "Ada",
          lastName: "Lovelace",
          affiliations: [1],
          orcid: "0000-0002-1825-0097",
        },
      ],
      ["Cambridge", "  Bletchley  "],
    );

    expect(merged.affiliations).toEqual(["Cambridge", "Bletchley"]);
    expect(merged.authors).toHaveLength(1);
    expect(merged.authors[0]).toMatchObject({
      firstName: "Ada",
      lastName: "Lovelace",
      orcid: "0000-0002-1825-0097",
      affiliationTexts: ["Cambridge"],
    });
  });

  it("imports a registry author with affiliations appended and linked", () => {
    const result = importRegistryAuthor(
      {
        firstName: "Alan",
        lastName: "Turing",
        affiliationTexts: ["Bletchley Park"],
      },
      [],
      ["Cambridge"],
    );

    expect(result.affiliations).toEqual(["Cambridge", "Bletchley Park"]);
    expect(result.authors).toEqual([
      {
        firstName: "Alan",
        lastName: "Turing",
        affiliations: [2],
      },
    ]);
  });

  it("skips duplicate registry affiliations on import", () => {
    const next = importRegistryAffiliation("Cambridge", ["Cambridge"]);
    expect(next).toEqual(["Cambridge"]);
  });
});

describe("contributors registry file I/O", () => {
  it("writes and reads contributors.yaml", async () => {
    await writeContributorsRegistry(modelRoot, {
      affiliations: ["MIT"],
      authors: [
        {
          firstName: "Grace",
          lastName: "Hopper",
          affiliationTexts: ["MIT"],
          email: "grace@example.org",
        },
      ],
    });

    const registry = await readContributorsRegistry(modelRoot);
    expect(registry.affiliations).toEqual(["MIT"]);
    expect(registry.authors[0]?.email).toBe("grace@example.org");
  });

  it("upserts from manuscript save and merges across papers", async () => {
    await upsertContributorsFromManuscript(
      modelRoot,
      [{ firstName: "Ada", lastName: "Lovelace", affiliations: [1] }],
      ["Cambridge"],
    );
    await upsertContributorsFromManuscript(
      modelRoot,
      [{ firstName: "Alan", lastName: "Turing", affiliations: [1, 2] }],
      ["Cambridge", "Bletchley"],
    );

    const raw = await readFile(path.join(modelRoot, CONTRIBUTORS_REGISTRY_FILE), "utf8");
    expect(raw).toContain("Ada");
    expect(raw).toContain("Alan");
    const registry = await readContributorsRegistry(modelRoot);
    expect(registry.affiliations).toEqual(["Cambridge", "Bletchley"]);
    expect(registry.authors.map((author) => author.lastName).sort()).toEqual(["Lovelace", "Turing"]);
  });

  it("reads snake_case YAML fields and normalizes affiliation spacing", async () => {
    const yamlPath = path.join(modelRoot, CONTRIBUTORS_REGISTRY_FILE);
    const raw = [
      "affiliations:",
      "  - '  MIT  '",
      "authors:",
      "  - first_name: Grace",
      "    last_name: Hopper",
      "    affiliation_texts:",
      "      - MIT",
    ].join("\n");
    const { writeFile } = await import("node:fs/promises");
    await writeFile(yamlPath, raw, "utf8");

    const registry = await readContributorsRegistry(modelRoot);
    expect(registry.affiliations).toEqual(["MIT"]);
    expect(registry.authors[0]).toMatchObject({ firstName: "Grace", lastName: "Hopper" });
  });
});
