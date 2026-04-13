import { describe, it, expect } from "vitest";
import { registerTokenSchema, sendNotificationSchema, updatePreferencesSchema } from "../schemas/notifications.js";

describe("registerTokenSchema", () => {
  it("accepts valid token registration", () => {
    const result = registerTokenSchema.safeParse({
      user_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      token: "ExponentPushToken[abc123]",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty token", () => {
    const result = registerTokenSchema.safeParse({
      user_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      token: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("sendNotificationSchema", () => {
  it("accepts valid notification", () => {
    const result = sendNotificationSchema.safeParse({
      user_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      notification_type: "deadline_reminder",
      gameweek: 20,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid notification_type", () => {
    const result = sendNotificationSchema.safeParse({
      user_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      notification_type: "invalid_type",
      gameweek: 20,
    });
    expect(result.success).toBe(false);
  });

  it("rejects gameweek out of range", () => {
    const result = sendNotificationSchema.safeParse({
      user_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      notification_type: "deadline_reminder",
      gameweek: 51,
    });
    expect(result.success).toBe(false);
  });
});

describe("updatePreferencesSchema", () => {
  it("accepts partial preferences", () => {
    const result = updatePreferencesSchema.safeParse({
      user_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      preferences: { deadline_reminder: true },
    });
    expect(result.success).toBe(true);
  });
});
