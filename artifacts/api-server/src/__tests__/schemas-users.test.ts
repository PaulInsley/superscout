import { describe, it, expect } from "vitest";
import { userProfileSchema } from "../schemas/users.js";

describe("userProfileSchema", () => {
  it("accepts valid user profile", () => {
    const result = userProfileSchema.safeParse({
      user_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      email: "user@example.com",
      fpl_manager_id: 123456,
      default_persona: "expert",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null fpl_manager_id (unlinking)", () => {
    const result = userProfileSchema.safeParse({
      user_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      fpl_manager_id: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts beginner mode fields", () => {
    const result = userProfileSchema.safeParse({
      user_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      is_beginner: true,
      beginner_rounds_completed: 2,
      beginner_lessons_seen: ["captain_intro", "transfer_basics"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = userProfileSchema.safeParse({
      user_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid persona", () => {
    const result = userProfileSchema.safeParse({
      user_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      default_persona: "casual",
    });
    expect(result.success).toBe(false);
  });
});
