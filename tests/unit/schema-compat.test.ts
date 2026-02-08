import { describe, expect, it } from "bun:test";
import tools from "../../tools.js";

function walk(value: unknown, visit: (node: unknown) => void): void {
  visit(value);
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const child of Object.values(value as Record<string, unknown>)) {
    walk(child, visit);
  }
}

describe("calendar schema compatibility", () => {
  it("keeps input schema flat and parser-friendly", () => {
    const calendar = tools.find((tool) => tool.name === "calendar");
    expect(calendar).toBeTruthy();

    const inputSchema = calendar?.inputSchema as Record<string, unknown>;
    expect(inputSchema).toBeTruthy();
    expect(inputSchema.oneOf).toBeUndefined();
    expect(inputSchema.anyOf).toBeUndefined();
    expect(inputSchema.allOf).toBeUndefined();

    const operationEnum = (
      (inputSchema?.properties as Record<string, unknown>)?.operation as {
        enum?: unknown;
      }
    )?.enum;
    expect(Array.isArray(operationEnum)).toBe(true);
    expect((operationEnum as string[]).length).toBeGreaterThan(0);
  });

  it("avoids advanced schema keywords that frequently break lightweight parsers", () => {
    const calendar = tools.find((tool) => tool.name === "calendar");
    expect(calendar).toBeTruthy();

    const forbiddenKeywords = new Set(["oneOf", "anyOf", "allOf", "not"]);
    const visitedForbidden: string[] = [];

    walk(calendar, (node) => {
      if (!node || typeof node !== "object" || Array.isArray(node)) return;
      const record = node as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        if (forbiddenKeywords.has(key)) visitedForbidden.push(key);
      }
      if (Array.isArray(record.type)) {
        visitedForbidden.push("type[]");
      }
      if ("pattern" in record) {
        visitedForbidden.push("pattern");
      }
    });

    expect(visitedForbidden).toEqual([]);
  });
});

