import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, createNode, deleteNode, moveNode, reorderChildren } from "./modelApi.js";

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(
    (_input: string, _init: RequestInit): Promise<Response> =>
      Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        text: async () => (body === undefined ? "" : JSON.stringify(body))
      } as unknown as Response)
  );
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createNode", () => {
  it("POSTs parent/name/kind and returns the created path", async () => {
    const fetchFn = mockFetch(201, { ok: true, path: "sections/intro", kind: "section" });
    const result = await createNode("sections", "intro", "section");
    expect(result.path).toBe("sections/intro");
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toContain("/api/model/node");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ parent: "sections", name: "intro", kind: "section" });
  });

  it("throws ApiError with status on a 409", async () => {
    mockFetch(409, { error: "Already exists: sections/intro" });
    await expect(createNode("sections", "intro", "section")).rejects.toMatchObject({
      status: 409,
      message: "Already exists: sections/intro"
    });
    await expect(createNode("sections", "intro", "section")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("deleteNode", () => {
  it("encodes the path and omits recursive by default", async () => {
    const fetchFn = mockFetch(200, { ok: true, path: "a/b" });
    await deleteNode("a/b");
    expect(fetchFn.mock.calls[0][0]).toContain("path=a%2Fb");
    expect(fetchFn.mock.calls[0][0]).not.toContain("recursive");
  });

  it("adds recursive=true when requested", async () => {
    const fetchFn = mockFetch(200, { ok: true, path: "a" });
    await deleteNode("a", true);
    expect(fetchFn.mock.calls[0][0]).toContain("recursive=true");
  });
});

describe("moveNode", () => {
  it("POSTs from/to", async () => {
    const fetchFn = mockFetch(200, { ok: true, from: "a/x", to: "b/x" });
    await moveNode("a/x", "b/x");
    expect(JSON.parse(String(fetchFn.mock.calls[0][1].body))).toEqual({ from: "a/x", to: "b/x" });
  });
});

describe("reorderChildren", () => {
  it("sends child_order array", async () => {
    const fetchFn = mockFetch(200, { ok: true, parent: "sections" });
    await reorderChildren("sections", ["b", "a"]);
    expect(JSON.parse(String(fetchFn.mock.calls[0][1].body))).toEqual({
      parent: "sections",
      child_order: ["b", "a"]
    });
  });
});
