/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SidebarCollapsibleSection } from "@/components/layout/SidebarCollapsibleSection";

describe("SidebarCollapsibleSection", () => {
  afterEach(() => cleanup());

  it("toggles content visibility when the header is clicked", () => {
    render(
      <SidebarCollapsibleSection title="Info" defaultOpen>
        <p>Section body</p>
      </SidebarCollapsibleSection>,
    );

    expect(screen.getByText("Section body")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Info" }));
    expect(screen.queryByText("Section body")).not.toBeTruthy();
  });

  it("does not toggle the section when header actions are clicked", () => {
    render(
      <SidebarCollapsibleSection
        title="Authors"
        defaultOpen
        headerActions={
          <button type="button" aria-label="Add author">
            Add
          </button>
        }
      >
        <p>Section body</p>
      </SidebarCollapsibleSection>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add author" }));
    expect(screen.getByText("Section body")).toBeTruthy();
  });
});
