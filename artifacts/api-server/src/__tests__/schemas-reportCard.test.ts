import { describe, it, expect } from "vitest";
import { reportCardGenerateSchema } from "../schemas/reportCard.js";

describe("reportCardGenerateSchema", () => {
  it("accepts valid report card request", () => {
    const result = reportCardGenerateSchema.safeParse({
      manager_id: 12345,
      vibe: "critic",
    });
    expect(result.success).toBe(true);
  });

  it("defaults vibe to expert", () => {
    const result = reportCardGenerateSchema.safeParse({
      manager_id: 12345,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.vibe).toBe("expert");
    }
  });

  it("coerces string manager_id to number", () => {
    const result = reportCardGenerateSchema.safeParse({
      manager_id: "54321",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.manager_id).toBe(54321);
    }
  });

  it("rejects zero manager_id", () => {
    const result = reportCardGenerateSchema.safeParse({
      manager_id: 0,
    });
    expect(result.success).toBe(false);
  });
});
