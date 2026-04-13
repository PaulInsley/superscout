import { describe, it, expect } from "vitest";
import { squadCardGenerateSchema, squadCardShareSchema } from "../schemas/squadCard.js";

describe("squadCardGenerateSchema", () => {
  it("accepts valid squad card request", () => {
    const result = squadCardGenerateSchema.safeParse({
      manager_id: 12345,
      gameweek: 20,
      vibe: "fanboy",
    });
    expect(result.success).toBe(true);
  });

  it("rejects gameweek over 50", () => {
    const result = squadCardGenerateSchema.safeParse({
      manager_id: 12345,
      gameweek: 51,
    });
    expect(result.success).toBe(false);
  });
});

describe("squadCardShareSchema", () => {
  it("accepts valid share request", () => {
    const result = squadCardShareSchema.safeParse({
      user_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      platform: "ios",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing user_id", () => {
    const result = squadCardShareSchema.safeParse({
      platform: "ios",
    });
    expect(result.success).toBe(false);
  });
});
