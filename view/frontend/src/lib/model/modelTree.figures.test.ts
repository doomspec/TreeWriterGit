import { describe, expect, it } from "vitest";

import {
  ASSET_LINK_PREFIX,
  FIGURE_BLOCK_LANG,
  FIGURE_LINK_PREFIX,
  preprocessFigureEmbeds,
} from "./modelTree";

describe("preprocessFigureEmbeds", () => {
  it("converts ::figure blocks to fenced figure blocks", () => {
    const out = preprocessFigureEmbeds("See ::figure[results/fig-a] below.");
    expect(out).toContain(`\`\`\`${FIGURE_BLOCK_LANG}`);
    expect(out).toContain("results/fig-a");
  });

  it("converts image wikilinks to asset URLs", () => {
    const out = preprocessFigureEmbeds("![[notes/data/chart.png]]");
    expect(out).toContain(`![chart.png](${ASSET_LINK_PREFIX}notes/data/chart.png)`);
  });

  it("converts figure wikilinks to figure protocol links", () => {
    const out = preprocessFigureEmbeds("[[results/fig-a]]");
    expect(out).toContain(`${FIGURE_LINK_PREFIX}results/fig-a`);
  });
});
