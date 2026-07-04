/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import {
  AuthorsAffiliationsEditor,
  type AuthorsAffiliationsValue,
} from "@/components/paper/AuthorsAffiliationsEditor";
import type { AuthorEntry, ContributorsRegistry } from "@treewriter/shared";

function author(partial: Partial<AuthorEntry> = {}): AuthorEntry {
  return { firstName: "", lastName: "", affiliations: [], ...partial };
}

type SetupOptions = AuthorsAffiliationsValue & { registry?: ContributorsRegistry };

function setup(initial: SetupOptions) {
  let value: AuthorsAffiliationsValue = initial;
  const registry = initial.registry;
  const onChange = vi.fn((next: AuthorsAffiliationsValue) => {
    value = next;
  });
  const { rerender } = render(
    <AuthorsAffiliationsEditor value={value} onChange={onChange} registry={registry} />,
  );
  const flush = () => rerender(<AuthorsAffiliationsEditor value={value} onChange={onChange} registry={registry} />);
  return { get: () => value, onChange, flush };
}

describe("AuthorsAffiliationsEditor", () => {
  afterEach(() => cleanup());

  it("adds an author with empty structured fields", () => {
    const h = setup({ authors: [], affiliations: [] });
    fireEvent.click(screen.getByRole("button", { name: /^Author$/i }));
    expect(h.get().authors).toEqual([{ firstName: "", lastName: "", affiliations: [] }]);
  });

  it("edits separate name parts", () => {
    const h = setup({ authors: [author()], affiliations: [] });
    fireEvent.change(screen.getByLabelText("Author 1 first name"), { target: { value: "Ada" } });
    h.flush();
    fireEvent.change(screen.getByLabelText("Author 1 last name"), { target: { value: "Lovelace" } });
    expect(h.get().authors[0]).toMatchObject({ firstName: "Ada", lastName: "Lovelace" });
  });

  it("captures an ORCID", () => {
    const h = setup({ authors: [author({ firstName: "Ada" })], affiliations: [] });
    fireEvent.change(screen.getByLabelText("Author 1 ORCID"), {
      target: { value: "0000-0002-1825-0097" },
    });
    expect(h.get().authors[0].orcid).toBe("0000-0002-1825-0097");
  });

  it("toggles an affiliation on an author", () => {
    const h = setup({ authors: [author({ firstName: "Ada" })], affiliations: ["Cambridge", "Bletchley"] });
    fireEvent.click(screen.getByRole("button", { name: /Toggle affiliation 2 for author 1/i }));
    expect(h.get().authors[0].affiliations).toEqual([2]);
  });

  it("marks equal contribution and corresponding, revealing an email field", () => {
    const h = setup({ authors: [author({ firstName: "Ada" })], affiliations: [] });
    fireEvent.click(screen.getByLabelText("Author 1 equal contribution"));
    expect(h.get().authors[0].equalContribution).toBe(true);
    fireEvent.click(screen.getByLabelText("Author 1 corresponding"));
    expect(h.get().authors[0].corresponding).toBe(true);
    h.flush();
    fireEvent.change(screen.getByLabelText("Author 1 email"), { target: { value: "ada@x.org" } });
    expect(h.get().authors[0].email).toBe("ada@x.org");
  });

  it("renumbers author affiliation references when an affiliation is removed", () => {
    const h = setup({
      authors: [author({ affiliations: [1] }), author({ affiliations: [1, 2] })],
      affiliations: ["Cambridge", "Bletchley"],
    });
    fireEvent.click(screen.getByRole("button", { name: /Remove affiliation 1/i }));
    expect(h.get().affiliations).toEqual(["Bletchley"]);
    expect(h.get().authors.map((a) => a.affiliations)).toEqual([[], [1]]);
  });

  it("removing an author drops its row", () => {
    const h = setup({
      authors: [author({ firstName: "Ada" }), author({ firstName: "Alan" })],
      affiliations: ["Cambridge"],
    });
    fireEvent.click(screen.getByRole("button", { name: /Remove author 1/i }));
    expect(h.get().authors.map((a) => a.firstName)).toEqual(["Alan"]);
  });

  it("shows a hint and no affiliation toggles when there are no affiliations", () => {
    setup({ authors: [author({ firstName: "Ada" })], affiliations: [] });
    expect(screen.getByText(/number authors in the LaTeX title block/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Toggle affiliation/i })).not.toBeTruthy();
  });

  it("adds an author from the global library with affiliations", () => {
    const h = setup({
      authors: [],
      affiliations: [],
      registry: {
        affiliations: ["Cambridge", "Bletchley"],
        authors: [
          {
            firstName: "Ada",
            lastName: "Lovelace",
            orcid: "0000-0002-1825-0097",
            affiliationTexts: ["Cambridge"],
          },
        ],
      },
    });
    fireEvent.change(screen.getByLabelText("Add author from library"), { target: { value: "0" } });
    expect(h.get().authors).toEqual([
      {
        firstName: "Ada",
        lastName: "Lovelace",
        orcid: "0000-0002-1825-0097",
        affiliations: [1],
      },
    ]);
    expect(h.get().affiliations).toEqual(["Cambridge"]);
  });

  it("adds an affiliation from the global library without duplicating", () => {
    const h = setup({
      authors: [],
      affiliations: ["Cambridge"],
      registry: {
        affiliations: ["Cambridge", "Bletchley"],
        authors: [],
      },
    });
    fireEvent.change(screen.getByLabelText("Add affiliation from library"), { target: { value: "0" } });
    expect(h.get().affiliations).toEqual(["Cambridge", "Bletchley"]);
  });
});
