/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { ExplorerImageViewer } from "@/components/explorer/viewers/ExplorerImageViewer";

describe("ExplorerImageViewer", () => {
  afterEach(() => cleanup());

  it("renders an img pointing at the model asset URL", () => {
    render(<ExplorerImageViewer path="explorer/photo.png" />);
    const img = screen.getByAltText("explorer/photo.png") as HTMLImageElement;
    expect(img.src).toContain("/api/model/asset?path=explorer%2Fphoto.png");
  });
});
