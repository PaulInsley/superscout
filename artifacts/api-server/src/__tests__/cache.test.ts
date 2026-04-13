import { describe, it, expect, beforeEach } from "vitest";
import { getCached, setCache, cacheKey } from "../lib/fplCache.js";

describe("cache utilities", () => {
  beforeEach(() => {
    setCache("test-key", null, 0);
  });

  it("returns null for missing key", () => {
    const result = getCached("nonexistent-key-xyz");
    expect(result).toBeNull();
  });

  it("stores and retrieves cached data", () => {
    const data = { players: [1, 2, 3] };
    setCache("test-store", data, 60);
    const result = getCached<typeof data>("test-store");
    expect(result).not.toBeNull();
    expect(result!.data).toEqual(data);
  });

  it("cacheKey creates deterministic keys", () => {
    const key1 = cacheKey("bootstrap-static");
    const key2 = cacheKey("bootstrap-static");
    expect(key1).toBe(key2);
  });

  it("cacheKey with args creates unique keys", () => {
    const key1 = cacheKey("picks", "123", "20");
    const key2 = cacheKey("picks", "456", "20");
    expect(key1).not.toBe(key2);
  });
});
