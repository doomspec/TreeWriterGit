/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import {
  AuthorsAffiliationsEditor,
  type AuthorsAffiliationsValue,
} from "@/components/paper/AuthorsAffiliationsEditor";

function setup(initial: AuthorsAffiliationsValue) {
  let value = initial;
  const onChange = vi.fn((next: AuthorsAffiliationsValue) => {
    value = next;
  });
  const { rerender } = render(<AuthorsAffiliationsEditor value={value} onChange={onChange} />);
  const flush = () => rerender(<AuthorsAffiliationsEditor value={value} onChange={onChange} />);
  return { get: () => value, onChange, flush };
}

describe("AuthorsAffiliationsEditor", () => {
  afterEach(() => cleanup());

  it("adds an author with an empty affiliation set", () => {
    const h = setup({ authors: [], affiliations: [], authorAffiliations: [] });
    fireEvent.click(screen.getByRole("button", { name: /^Author$/i }));
    expect(h.get().authors).toEqual([""]);
    expect(h.get().authorAffiliations).toEqual([[]]);
  });

  it("toggles an affiliation on an author", () => {
    const h = setup({ authors: ["Ada"], affiliations: ["Cambridge", "Bletchley"], authorAffiliations: [[]] });
    fireEvent.click(screen.getByRole("button", { name: /Toggle affiliation 2 for author 1/i }));
    expect(h.get().authorAffiliations).toEqual([[2]]);
  });

  it("renumbers author affiliation references when an affiliation is removed", () => {
    // Ada -> aff 1; Alan -> affs 1,2. Remove affiliation #1 → old #2 becomes #1.
    const h = setup({
      authors: ["Ada", "Alan"],
      affiliations: ["Cambridge", "Bletchley"],
      authorAffiliations: [[1], [1, 2]],
    });
    fireEvent.click(screen.getByRole("button", { name: /Remove affiliation 1/i }));
    expect(h.get().affiliations).toEqual(["Bletchley"]);
    // Ada's only ref (#1) is dropped; Alan's #1 dropped, #2 shifts to #1.
    expect(h.get().authorAffiliations).toEqual([[], [1]]);
  });

  it("removing an author drops its affiliation-mapping row in lockstep", () => {
    const h = setup({
      authors: ["Ada", "Alan"],
      affiliations: ["Cambridge"],
      authorAffiliations: [[1], []],
    });
    fireEvent.click(screen.getByRole("button", { name: /Remove author 1/i }));
    expect(h.get().authors).toEqual(["Alan"]);
    expect(h.get().authorAffiliations).toEqual([[]]);
  });

  it("shows a hint and no affiliation toggles when there are no affiliations", () => {
    setup({ authors: ["Ada"], affiliations: [], authorAffiliations: [[]] });
    expect(screen.getByText(/number authors in the LaTeX title block/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Toggle affiliation/i })).not.toBeTruthy();
  });
});
