/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ContributionsEditor } from "@/components/paper/ContributionsEditor";
import type { AuthorEntry } from "@treewriter/shared";

function setup(initial: AuthorEntry[]) {
  let value = initial;
  const onChange = vi.fn((next: AuthorEntry[]) => {
    value = next;
  });
  const { rerender } = render(<ContributionsEditor authors={value} onChange={onChange} />);
  return { get: () => value, onChange, flush: () => rerender(<ContributionsEditor authors={value} onChange={onChange} />) };
}

describe("ContributionsEditor", () => {
  afterEach(() => cleanup());

  it("prompts to add authors first when none are named", () => {
    setup([{ firstName: "", lastName: "", affiliations: [] }]);
    expect(screen.getByText(/Add authors on the Authors tab first/i)).toBeTruthy();
  });

  it("toggles a CRediT role for an author and keeps canonical order", () => {
    const h = setup([{ firstName: "Ada", lastName: "Lovelace", affiliations: [], credit: ["Software"] }]);
    fireEvent.click(screen.getByRole("button", { name: /Conceptualization for Ada Lovelace/i }));
    // Conceptualization precedes Software in the canonical CRediT order.
    expect(h.get()[0].credit).toEqual(["Conceptualization", "Software"]);
  });

  it("removes a role when toggled off", () => {
    const h = setup([{ firstName: "Ada", lastName: "Lovelace", affiliations: [], credit: ["Software"] }]);
    fireEvent.click(screen.getByRole("button", { name: /^Software for Ada Lovelace$/i }));
    expect(h.get()[0].credit).toEqual([]);
  });
});
