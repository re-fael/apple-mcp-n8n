import { beforeAll } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { TEST_DATA } from "./fixtures/test-data.js";

const LOG_FILE =
  process.env.MCP_TEST_LOG_FILE ||
  process.env.APPLE_MCP_CALENDAR_LOG_FILE ||
  path.join(process.cwd(), "test-output.log");

process.env.APPLE_MCP_CALENDAR_LOG_FILE = LOG_FILE;
if (!process.env.APPLE_MCP_CALENDAR_INCOMING) {
  process.env.APPLE_MCP_CALENDAR_INCOMING = TEST_DATA.CALENDAR.calendarName;
}
if (!process.env.APPLE_MCP_CALENDAR_OUTGOING) {
  process.env.APPLE_MCP_CALENDAR_OUTGOING = TEST_DATA.CALENDAR.calendarName;
}

function formatLogLine(level: string, args: unknown[]): string {
  const timestamp = new Date().toISOString();
  const message = args
    .map((item) => {
      if (typeof item === "string") return item;
      try {
        return JSON.stringify(item);
      } catch {
        return String(item);
      }
    })
    .join(" ");
  return `${timestamp} [${level}] ${message}\n`;
}

beforeAll(() => {
  try {
    fs.writeFileSync(LOG_FILE, "");
  } catch (error) {
    console.error("Failed to initialize test log file:", error);
  }

  const originalLog = console.log.bind(console);
  const originalError = console.error.bind(console);
  const originalWarn = console.warn.bind(console);

  console.log = (...args: unknown[]) => {
    originalLog(...args);
    try {
      fs.appendFileSync(LOG_FILE, formatLogLine("INFO", args));
    } catch {
      // Ignore logging failures.
    }
  };

  console.error = (...args: unknown[]) => {
    originalError(...args);
    try {
      fs.appendFileSync(LOG_FILE, formatLogLine("ERROR", args));
    } catch {
      // Ignore logging failures.
    }
  };

  console.warn = (...args: unknown[]) => {
    originalWarn(...args);
    try {
      fs.appendFileSync(LOG_FILE, formatLogLine("WARN", args));
    } catch {
      // Ignore logging failures.
    }
  };

  console.log("Calendar test setup ready");
  console.log(`Calendar lock: incoming=${process.env.APPLE_MCP_CALENDAR_INCOMING} outgoing=${process.env.APPLE_MCP_CALENDAR_OUTGOING}`);
  console.log(`Calendar log file: ${LOG_FILE}`);
});

export { TEST_DATA };
