/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";

import { collectPendingChangeElements } from "@/lib/pendingChangeNavigation";

describe("collectPendingChangeElements", () => {
  it("orders inserts and pure deletions in document order", () => {
    document.body.innerHTML = `
      <div id="root">
        <p>Keep <del class="highlight-inline--deleted">old</del><mark class="highlight-inline--pending">new</mark> here.</p>
        <p>Remove <del class="highlight-inline--deleted">gone</del> only.</p>
        <p>Add <mark class="highlight-inline--pending">fresh</mark> word.</p>
      </div>
    `;
    const root = document.getElementById("root")!;
    const elements = collectPendingChangeElements(root);
    expect(elements.map((el) => el.textContent)).toEqual(["new", "gone", "fresh"]);
  });

  it("includes full-line pending spans from raw mirror", () => {
    document.body.innerHTML = `
      <div id="root">
        <span class="highlight-line--pending">New paragraph line</span>
      </div>
    `;
    const root = document.getElementById("root")!;
    expect(collectPendingChangeElements(root)).toHaveLength(1);
  });
});
