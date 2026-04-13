import { describe, it, expect, vi } from "vitest";
import { validateBody } from "../lib/validateRequest.js";
import { z } from "zod";

function mockReqResNext(body: unknown) {
  const req = { body } as any;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
  const next = vi.fn();
  return { req, res, next };
}

describe("validateBody middleware", () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive(),
  });

  it("calls next() on valid body", () => {
    const { req, res, next } = mockReqResNext({ name: "Test", age: 25 });
    validateBody(schema)(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid body", () => {
    const { req, res, next } = mockReqResNext({ name: "", age: -1 });
    validateBody(schema)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Invalid request" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("includes field-level error details", () => {
    const { req, res, next } = mockReqResNext({ name: 123 });
    validateBody(schema)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    const jsonArg = res.json.mock.calls[0][0];
    expect(jsonArg.details).toBeDefined();
    expect(Array.isArray(jsonArg.details)).toBe(true);
    expect(jsonArg.details.length).toBeGreaterThan(0);
  });

  it("parses and transforms req.body on success", () => {
    const coerceSchema = z.object({
      count: z.number({ coerce: true }),
    });
    const { req, res, next } = mockReqResNext({ count: "42" });
    validateBody(coerceSchema)(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.body.count).toBe(42);
  });

  it("rejects completely missing body fields", () => {
    const { req, res, next } = mockReqResNext({});
    validateBody(schema)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
