import { describe, expect, it } from "vitest";

import { scoreCommand, type AppCommand } from "./commandPaletteTypes";

const baseCommand: AppCommand = {
  id: "create.unit",
  label: "New unit",
  category: "Create",
  aliases: ["add unit", "new note"],
  run: () => {},
};

describe("scoreCommand", () => {
  it("returns baseline score for empty query", () => {
    expect(scoreCommand("", baseCommand)).toBe(1);
  });

  it("prefers exact label matches", () => {
    expect(scoreCommand("new unit", baseCommand)).toBe(100);
  });

  it("matches aliases and partial text", () => {
    expect(scoreCommand("note", baseCommand)).toBeGreaterThanOrEqual(50);
    expect(scoreCommand("create", baseCommand)).toBeGreaterThanOrEqual(30);
  });

  it("returns zero when nothing matches", () => {
    expect(scoreCommand("zzzz", baseCommand)).toBe(0);
  });
});
