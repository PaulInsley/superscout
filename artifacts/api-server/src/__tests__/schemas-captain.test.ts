import { describe, it, expect } from "vitest";
import { captainPicksSchema } from "../schemas/captain.js";

describe("captainPicksSchema", () => {
  it("accepts valid captain picks request", () => {
    const result = captainPicksSchema.safeParse({
      vibe: "expert",
      user_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      context: "Pick my captain for GW20",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing context field", () => {
    const result = captainPicksSchema.safeParse({
      vibe: "expert",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid vibe value", () => {
    const result = captainPicksSchema.safeParse({
      vibe: "casual",
      context: "Pick my captain",
    });
    expect(result.success).toBe(false);
  });

  it("defaults skip_cache to false", () => {
    const result = captainPicksSchema.safeParse({
      vibe: "fanboy",
      context: "Captain pick please",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.skip_cache).toBe(false);
    }
  });

  it("rejects empty context string", () => {
    const result = captainPicksSchema.safeParse({
      vibe: "expert",
      context: "",
    });
    expect(result.success).toBe(false);
  });
});
