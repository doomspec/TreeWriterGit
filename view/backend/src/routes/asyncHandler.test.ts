import { describe, expect, it, vi } from "vitest";

import { asyncHandler } from "./asyncHandler.js";

describe("asyncHandler", () => {
  it("forwards resolved handlers", async () => {
    const handler = asyncHandler(async (_req, res) => {
      res.status(200).json({ ok: true });
    });
    const response = { statusCode: 0, body: null as unknown, status(code: number) { this.statusCode = code; return this; }, json(payload: unknown) { this.body = payload; } };
    const next = vi.fn();
    await handler({} as never, response as never, next);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(next).not.toHaveBeenCalled();
  });

  it("forwards rejections to next", async () => {
    const handler = asyncHandler(async () => {
      throw new Error("boom");
    });
    const next = vi.fn();
    await handler({} as never, {} as never, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
