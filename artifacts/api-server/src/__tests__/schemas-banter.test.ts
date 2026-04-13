import { describe, it, expect } from "vitest";
import { banterLeaguesSchema } from "../schemas/banter.js";

describe("banterLeaguesSchema", () => {
  it("accepts valid leagues array", () => {
    const result = banterLeaguesSchema.safeParse({
      user_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      leagues: [
        { id: 1, name: "Test League" },
        { id: "2", name: "Another League", rank: 5 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than 3 leagues", () => {
    const result = banterLeaguesSchema.safeParse({
      user_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      leagues: [
        { id: 1, name: "L1" },
        { id: 2, name: "L2" },
        { id: 3, name: "L3" },
        { id: 4, name: "L4" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid UUID for user_id", () => {
    const result = banterLeaguesSchema.safeParse({
      user_id: "not-a-uuid",
      leagues: [],
    });
    expect(result.success).toBe(false);
  });
});
