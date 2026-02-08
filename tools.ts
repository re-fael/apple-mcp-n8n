import { type Tool } from "@modelcontextprotocol/sdk/types.js";

const CALENDAR_OPERATIONS = [
  "search",
  "open",
  "list",
  "listCalendars",
  "create",
  "delete",
] as const;

const CALENDAR_TOOL: Tool = {
  name: "calendar",
  description:
    "Search, create, delete, and open calendar events in Apple Calendar app. Use operation=list for date-range availability and operation=search for keyword filtering. Calendar access is locked to incoming/outgoing calendars. Returned startDate/endDate values are ISO 8601 UTC strings.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      operation: {
        type: "string",
        description:
          "Operation to perform: 'search', 'open', 'list', 'listCalendars', 'create', or 'delete'. Use 'list' for date-only availability checks; use 'search' for keyword filtering.",
        enum: [...CALENDAR_OPERATIONS],
      },
      searchText: {
        type: "string",
        description:
          "Optional keyword filter for event titles, locations, and notes (search operation). For date-only queries, prefer operation='list' or leave this empty.",
      },
      eventId: {
        type: "string",
        description: "ID of the event to open/delete (required for open/delete operations)",
      },
      limit: {
        type: "integer",
        description: "Number of events to retrieve (optional, default 10, max 50)",
        minimum: 1,
        maximum: 50,
      },
      fromDate: {
        type: "string",
        description:
          "Start date for search range in ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ",
      },
      toDate: {
        type: "string",
        description:
          "End date for search range in ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ",
      },
      title: {
        type: "string",
        description: "Title of the event to create (required for create operation)",
      },
      startDate: {
        type: "string",
        description:
          "Event start date/time in ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ",
      },
      endDate: {
        type: "string",
        description:
          "Event end date/time in ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ",
      },
      location: {
        type: "string",
        description: "Location of the event (optional for create operation)",
      },
      notes: {
        type: "string",
        description: "Additional notes for the event (optional for create operation)",
      },
      isAllDay: {
        type: "boolean",
        description:
          "Whether the event is an all-day event (optional for create operation, default is false)",
      },
      calendarName: {
        type: "string",
        description:
          "Name of the calendar to target (optional for list/search/create/delete; list/search use both allowed locked calendars if omitted, create/delete use outgoing calendar if omitted)",
      },
    },
    required: ["operation"],
  },
  outputSchema: {
    type: "object",
    additionalProperties: true,
    properties: {
      operation: {
        type: "string",
        enum: [...CALENDAR_OPERATIONS],
      },
      ok: {
        type: "boolean",
        description: "Convenience success flag. Equivalent to !isError.",
      },
      isError: {
        type: "boolean",
      },
      content: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: true,
        },
      },
      calendars: {
        type: "array",
        items: { type: "string" },
      },
      calendarsCount: {
        type: "number",
      },
      events: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: true,
        },
      },
      eventsCount: {
        type: "number",
      },
      event: {
        type: "object",
        additionalProperties: true,
      },
      deletedEventId: {
        type: "string",
      },
      deletedFromCalendar: {
        type: "string",
      },
    },
    required: ["operation", "ok", "isError", "content"],
  },
};

export default [CALENDAR_TOOL];
