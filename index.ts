#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import tools from "./tools.js";
import calendarModule from "./utils/calendar.js";
import { startStreamableHttpServer } from "./utils/streamable-http.js";
import {
  getConfiguredTools,
  getToolAccessDecision,
  isKnownToolName,
  loadToolAccessConfig,
  summarizeToolAccess,
} from "./utils/tool-policy.js";

type CalendarOperation =
  | "search"
  | "open"
  | "list"
  | "listCalendars"
  | "create"
  | "delete";
type ToolContentItem = { type: "text"; text: string };

type CalendarStructuredContent = {
  operation: CalendarOperation;
  ok: boolean;
  isError: boolean;
  content: ToolContentItem[];
  calendars?: string[];
  calendarsCount?: number;
  events?: Awaited<ReturnType<typeof calendarModule.getEvents>>;
  eventsCount?: number;
  event?: {
    id: string | null;
    title: string;
    startDate: string | null;
    endDate: string | null;
    location: string | null;
    notes: string | null;
    isAllDay: boolean;
    calendarName: string | null;
  };
  deletedEventId?: string;
  deletedFromCalendar?: string;
  tool?: string;
};

type CalendarToolArgs = {
  operation: CalendarOperation;
  searchText?: string;
  eventId?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  title?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  notes?: string;
  isAllDay?: boolean;
  calendarName?: string;
};

const SERVER_INSTRUCTIONS_BASE = [
  "Apple Calendar MCP exposes only calendar operations for Apple Calendar.",
  "Use operation=list for date-based availability and operation=search for keyword filtering.",
  "Use operation=delete with eventId to remove an event from the writable calendar.",
  "Calendar operations are locked to APPLE_MCP_CALENDAR_INCOMING (read) and APPLE_MCP_CALENDAR_OUTGOING (write).",
  "Use ISO 8601 dates (YYYY-MM-DD) or timestamps (YYYY-MM-DDTHH:mm:ssZ).",
  "Date/time values returned by tools use ISO 8601 UTC strings.",
  "Treat structured fields (events, event, calendars, counters) as source of truth.",
].join(" ");

function asText(text: string) {
  return [{ type: "text", text }];
}

function isCalendarOperation(value: unknown): value is CalendarOperation {
  return (
    value === "search" ||
    value === "open" ||
    value === "list" ||
    value === "listCalendars" ||
    value === "create" ||
    value === "delete"
  );
}

function coerceOperation(value: unknown, fallback: CalendarOperation = "search"): CalendarOperation {
  return isCalendarOperation(value) ? value : fallback;
}

function calendarResult(structured: CalendarStructuredContent) {
  return {
    content: structured.content,
    structuredContent: structured,
    ...structured,
  };
}

function formatEventListHeader(operation: "list" | "search", count: number): string {
  if (operation === "search") {
    return `Found ${count} matching events:`;
  }
  return `Found ${count} events:`;
}

function formatEventsText(
  operation: "list" | "search",
  events: Awaited<ReturnType<typeof calendarModule.getEvents>>,
): string {
  if (!events.length) {
    return operation === "search" ? "No matching events found." : "No events found.";
  }

  const lines = [formatEventListHeader(operation, events.length), ""];
  for (const event of events) {
    lines.push(
      `${event.title} (${event.startDate ?? "N/A"} - ${event.endDate ?? "N/A"})`,
      `Location: ${event.location ?? "Not specified"}`,
      `Calendar: ${event.calendarName}`,
      `ID: ${event.id}`,
      "",
    );
  }
  return lines.join("\n").trimEnd();
}

function toSafeLimit(value: unknown, fallback = 10): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(50, Math.max(1, Math.floor(value)));
}

function isCalendarArgs(value: unknown): value is CalendarToolArgs {
  if (!value || typeof value !== "object") return false;

  const operation = (value as { operation?: unknown }).operation;
  if (!isCalendarOperation(operation)) {
    return false;
  }

  return true;
}

function validateCalendarArgs(args: CalendarToolArgs): void {
  switch (args.operation) {
    case "open":
    case "delete":
      if (!args.eventId?.trim()) {
        throw new Error("eventId is required for open/delete operations");
      }
      return;

    case "create":
      if (!args.title?.trim()) {
        throw new Error("title is required for create operation");
      }
      if (!args.startDate?.trim() || !args.endDate?.trim()) {
        throw new Error("startDate and endDate are required for create operation");
      }
      return;

    case "search":
      if (args.searchText !== undefined && typeof args.searchText !== "string") {
        throw new Error("searchText must be a string when provided");
      }
      return;

    case "list":
    case "listCalendars":
      return;
  }
}

function buildPolicyDeniedResult(toolName: string, operation?: string, reason?: string) {
  const coercedOperation = coerceOperation(operation);
  return calendarResult({
    content: asText(reason ?? `Tool "${toolName}" is blocked by policy.`),
    tool: toolName,
    operation: coercedOperation,
    ok: false,
    isError: true,
  });
}

async function main() {
  const toolAccessConfig = loadToolAccessConfig();
  const configuredTools = getConfiguredTools(tools, toolAccessConfig);
  const toolPolicySource = toolAccessConfig.sourcePath ?? "default policy (all tools enabled)";

  const serverInstructions = [
    SERVER_INSTRUCTIONS_BASE,
    `Tool policy source: ${toolPolicySource}.`,
    `Active tool modes: ${summarizeToolAccess(toolAccessConfig)}.`,
  ].join(" ");

  if (toolAccessConfig.warnings.length > 0) {
    for (const warning of toolAccessConfig.warnings) {
      console.error(`Tool policy warning: ${warning}`);
    }
  }

  const server = new Server(
    {
      name: "Apple Calendar MCP",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
      instructions: serverInstructions,
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: configuredTools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const { name, arguments: rawArgs } = request.params;

      if (name !== "calendar") {
        return {
          content: asText(`Unknown tool: ${name}. This server only exposes \"calendar\".`),
          tool: name,
          operation: null,
          ok: false,
          isError: true,
        };
      }

      if (!isCalendarArgs(rawArgs)) {
        throw new Error("Invalid arguments for calendar tool");
      }

      validateCalendarArgs(rawArgs);
      const operation = rawArgs.operation;

      if (isKnownToolName(name)) {
        const decision = getToolAccessDecision(toolAccessConfig, name, operation);
        if (!decision.allowed) {
          return buildPolicyDeniedResult(name, operation, decision.reason);
        }
      }

      switch (operation) {
        case "listCalendars": {
          const calendars = await calendarModule.listCalendars();
          return calendarResult({
            content: asText(
              calendars.length > 0
                ? `Available calendars (${calendars.length}):\n\n${calendars.map((c) => `- ${c}`).join("\n")}`
                : "No calendars available.",
            ),
            calendars,
            calendarsCount: calendars.length,
            operation,
            ok: true,
            isError: false,
          });
        }

        case "list": {
          const events = await calendarModule.getEvents(
            toSafeLimit(rawArgs.limit, 10),
            rawArgs.fromDate,
            rawArgs.toDate,
            rawArgs.calendarName,
          );
          return calendarResult({
            content: asText(formatEventsText(operation, events)),
            events,
            eventsCount: events.length,
            operation,
            ok: true,
            isError: false,
          });
        }

        case "search": {
          const events = await calendarModule.searchEvents(
            rawArgs.searchText ?? "",
            toSafeLimit(rawArgs.limit, 10),
            rawArgs.fromDate,
            rawArgs.toDate,
            rawArgs.calendarName,
          );
          return calendarResult({
            content: asText(formatEventsText(operation, events)),
            events,
            eventsCount: events.length,
            operation,
            ok: true,
            isError: false,
          });
        }

        case "open": {
          const result = await calendarModule.openEvent(rawArgs.eventId!);
          return calendarResult({
            content: asText(result.success ? "Event found" : `Error opening event: ${result.message}`),
            operation,
            ok: result.success,
            isError: !result.success,
          });
        }

        case "create": {
          const result = await calendarModule.createEvent(
            rawArgs.title!,
            rawArgs.startDate!,
            rawArgs.endDate!,
            rawArgs.location,
            rawArgs.notes,
            rawArgs.isAllDay,
            rawArgs.calendarName,
          );

          const event = result.success
            ? {
                id: result.eventId ?? null,
                title: rawArgs.title!,
                startDate: result.startDate ?? null,
                endDate: result.endDate ?? null,
                location: rawArgs.location ?? null,
                notes: rawArgs.notes ?? null,
                isAllDay: Boolean(rawArgs.isAllDay),
                calendarName: rawArgs.calendarName ?? null,
              }
            : undefined;

          return calendarResult({
            content: asText(result.success ? result.message : `Error creating event: ${result.message}`),
            ...(event ? { event } : {}),
            operation,
            ok: result.success,
            isError: !result.success,
          });
        }

        case "delete": {
          const result = await calendarModule.deleteEvent(
            rawArgs.eventId!,
            rawArgs.calendarName,
          );

          return calendarResult({
            content: asText(result.success ? result.message : `Error deleting event: ${result.message}`),
            ...(result.success && result.deletedEventId
              ? {
                  deletedEventId: result.deletedEventId,
                  ...(result.deletedFromCalendar
                    ? { deletedFromCalendar: result.deletedFromCalendar }
                    : {}),
                }
              : {}),
            operation,
            ok: result.success,
            isError: !result.success,
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const args = request.params.arguments as { operation?: unknown } | undefined;
      const operation = coerceOperation(args?.operation);
      return calendarResult({
        content: asText(message),
        tool: request.params.name,
        operation,
        ok: false,
        isError: true,
      });
    }
  });

  const transportMode = (process.env.APPLE_MCP_TRANSPORT ?? "stdio").trim().toLowerCase();

  if (transportMode === "http") {
    await startStreamableHttpServer(server);
    console.error("Calendar MCP Streamable HTTP transport initialized");
    return;
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Calendar MCP stdio transport initialized");
}

main().catch((error) => {
  console.error("Failed to initialize Calendar MCP server:", error);
  process.exit(1);
});
