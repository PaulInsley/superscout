import { describe, it, expect } from "vitest";
import { transferAdviceSchema } from "../schemas/transfer.js";

describe("transferAdviceSchema", () => {
  it("accepts valid transfer request", () => {
    const result = transferAdviceSchema.safeParse({
      manager_id: 123456,
      vibe: "critic",
    });
    expect(result.success).toBe(true);
  });

  it("coerces string manager_id to number", () => {
    const result = transferAdviceSchema.safeParse({
      manager_id: "789",
      vibe: "expert",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.manager_id).toBe(789);
    }
  });

  it("rejects negative manager_id", () => {
    const result = transferAdviceSchema.safeParse({
      manager_id: -1,
      vibe: "expert",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing vibe", () => {
    const result = transferAdviceSchema.safeParse({
      manager_id: 100,
    });
    expect(result.success).toBe(false);
  });
});
