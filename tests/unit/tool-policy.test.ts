import { afterEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import tools from "../../tools.js";
import {
  getConfiguredTools,
  getToolAccessDecision,
  loadToolAccessConfig,
} from "../../utils/tool-policy.js";

const ORIGINAL_CONFIG_ENV = process.env.APPLE_MCP_CONFIG_FILE;

function withTempConfig(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "apple-mcp-policy-"));
  const filePath = path.join(dir, "config.ini");
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

function cleanupPath(filePath: string): void {
  const dir = path.dirname(filePath);
  fs.rmSync(dir, { recursive: true, force: true });
}

afterEach(() => {
  if (ORIGINAL_CONFIG_ENV === undefined) {
    delete process.env.APPLE_MCP_CONFIG_FILE;
  } else {
    process.env.APPLE_MCP_CONFIG_FILE = ORIGINAL_CONFIG_ENV;
  }
});

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function getOperationEnumFromInputSchema(tool: any): string[] {
  const operationEnum = (
    (tool?.inputSchema as {
      properties?: Record<string, { enum?: unknown }>;
    })?.properties?.operation?.enum ?? []
  ) as unknown[];
  return operationEnum.filter(
    (value): value is string => typeof value === "string",
  );
}

function getOperationEnumFromOutputSchema(tool: any): string[] {
  const operationEnum = (
    (tool?.outputSchema as {
      properties?: Record<string, { enum?: unknown }>;
    })?.properties?.operation?.enum ?? []
  ) as unknown[];
  return operationEnum.filter(
    (value): value is string => typeof value === "string",
  );
}

describe("tool policy config", () => {
  it("should enforce read/write modes for calendar", () => {
    const configPath = withTempConfig(`
[tool.calendar]
enabled = true
read = true
write = false
`);

    try {
      process.env.APPLE_MCP_CONFIG_FILE = configPath;
      const config = loadToolAccessConfig();

      const readDecision = getToolAccessDecision(config, "calendar", "list");
      const writeDecision = getToolAccessDecision(config, "calendar", "create");
      const updateDecision = getToolAccessDecision(config, "calendar", "update");
      const deleteDecision = getToolAccessDecision(config, "calendar", "delete");

      expect(readDecision.allowed).toBe(true);
      expect(writeDecision.allowed).toBe(false);
      expect(updateDecision.allowed).toBe(false);
      expect(deleteDecision.allowed).toBe(false);
      expect(writeDecision.reason).toContain(
        'Write operations are disabled for tool "calendar"',
      );
    } finally {
      cleanupPath(configPath);
    }
  });

  it("should hide calendar from tools/list when disabled", () => {
    const configPath = withTempConfig(`
[tool.calendar]
enabled = false
`);

    try {
      process.env.APPLE_MCP_CONFIG_FILE = configPath;
      const config = loadToolAccessConfig();
      const configuredTools = getConfiguredTools(tools, config);
      const names = configuredTools.map((tool) => tool.name);

      expect(names.includes("calendar")).toBe(false);
    } finally {
      cleanupPath(configPath);
    }
  });

  it("should trim write operations from calendar schema enums", () => {
    const configPath = withTempConfig(`
[tool.calendar]
enabled = true
read = true
write = false
`);

    try {
      process.env.APPLE_MCP_CONFIG_FILE = configPath;
      const config = loadToolAccessConfig();
      const configuredTools = getConfiguredTools(tools, config);
      const calendarTool = configuredTools.find((tool) => tool.name === "calendar");

      expect(calendarTool).toBeTruthy();

      const operations = getOperationEnumFromInputSchema(calendarTool);
      const outputOperations = getOperationEnumFromOutputSchema(calendarTool);

      expect(operations.includes("create")).toBe(false);
      expect(operations.includes("update")).toBe(false);
      expect(operations.includes("delete")).toBe(false);
      expect(operations.includes("list")).toBe(true);
      expect(operations.includes("search")).toBe(true);
      expect(outputOperations.includes("create")).toBe(false);
      expect(outputOperations.includes("update")).toBe(false);
      expect(outputOperations.includes("delete")).toBe(false);

      expect(sortedUnique(outputOperations)).toEqual(sortedUnique(operations));
    } finally {
      cleanupPath(configPath);
    }
  });

  it("should expose parser warnings for invalid boolean values", () => {
    const configPath = withTempConfig(`
[tool.calendar]
write = maybe
`);

    try {
      process.env.APPLE_MCP_CONFIG_FILE = configPath;
      const config = loadToolAccessConfig();

      expect(config.warnings.length).toBeGreaterThan(0);
      expect(config.warnings.join("\n")).toContain("must be boolean");
    } finally {
      cleanupPath(configPath);
    }
  });
});
