import { describe, it, expect } from "vitest";

function extractJSON(text: string): unknown | null {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    /* fallback */
  }
  let depth = 0;
  let start = -1;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (cleaned[i] === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          return JSON.parse(cleaned.substring(start, i + 1));
        } catch (_) {
          /* keep scanning */
        }
      }
    }
  }
  return null;
}

describe("extractJSON", () => {
  it("parses clean JSON", () => {
    const result = extractJSON('{"name": "Salah", "score": 10}');
    expect(result).toEqual({ name: "Salah", score: 10 });
  });

  it("handles markdown code fences", () => {
    const result = extractJSON('```json\n{"captain": "Haaland"}\n```');
    expect(result).toEqual({ captain: "Haaland" });
  });

  it("extracts JSON from surrounding text", () => {
    const result = extractJSON('Here is my pick: {"player": "Saka"} hope this helps!');
    expect(result).toEqual({ player: "Saka" });
  });

  it("returns null for non-JSON text", () => {
    const result = extractJSON("No JSON here at all");
    expect(result).toBeNull();
  });

  it("handles nested objects", () => {
    const result = extractJSON('{"a": {"b": 1}}');
    expect(result).toEqual({ a: { b: 1 } });
  });

  it("handles empty object", () => {
    const result = extractJSON("{}");
    expect(result).toEqual({});
  });
});
