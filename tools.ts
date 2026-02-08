import { type Tool } from "@modelcontextprotocol/sdk/types.js";

const CALENDAR_OPERATIONS = [
  "search",
  "open",
  "list",
  "listCalendars",
  "create",
] as const;

const ISO_DATE_OR_DATETIME_PATTERN =
  "^\\d{4}-\\d{2}-\\d{2}(?:T\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d{1,3})?)?(?:Z|[+-]\\d{2}:?\\d{2})?)?$";

const CALENDAR_TOOL: Tool = {
  name: "calendar",
  description:
    "Search, create, and open calendar events in Apple Calendar app. Use operation=list for date-range availability and operation=search for keyword filtering. Calendar access is locked to incoming/outgoing calendars. Returned startDate/endDate values are ISO 8601 UTC strings.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      operation: {
        type: "string",
        description:
          "Operation to perform: 'search', 'open', 'list', 'listCalendars', or 'create'. Use 'list' for date-only availability checks; use 'search' for keyword filtering.",
        enum: [...CALENDAR_OPERATIONS],
      },
      searchText: {
        type: "string",
        description:
          "Optional keyword filter for event titles, locations, and notes (search operation). For date-only queries, prefer operation='list' or leave this empty.",
      },
      eventId: {
        type: "string",
        description: "ID of the event to open (required for open operation)",
      },
      limit: {
        type: "number",
        description: "Number of events to retrieve (optional, default 10, max 50)",
      },
      fromDate: {
        type: "string",
        description:
          "Start date for search range in ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ",
        pattern: ISO_DATE_OR_DATETIME_PATTERN,
      },
      toDate: {
        type: "string",
        description:
          "End date for search range in ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ",
        pattern: ISO_DATE_OR_DATETIME_PATTERN,
      },
      title: {
        type: "string",
        description: "Title of the event to create (required for create operation)",
      },
      startDate: {
        type: "string",
        description:
          "Event start date/time in ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ",
        pattern: ISO_DATE_OR_DATETIME_PATTERN,
      },
      endDate: {
        type: "string",
        description:
          "Event end date/time in ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ",
        pattern: ISO_DATE_OR_DATETIME_PATTERN,
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
          "Name of the calendar to target (optional for list/search/create; list/search use both allowed locked calendars if omitted, create uses outgoing calendar if omitted)",
      },
    },
    required: ["operation"],
    oneOf: [
      {
        type: "object",
        additionalProperties: false,
        properties: {
          operation: { const: "listCalendars" },
        },
        required: ["operation"],
      },
      {
        type: "object",
        additionalProperties: false,
        properties: {
          operation: { const: "open" },
          eventId: { type: "string", minLength: 1 },
        },
        required: ["operation", "eventId"],
      },
      {
        type: "object",
        additionalProperties: false,
        properties: {
          operation: { const: "list" },
        },
        required: ["operation"],
      },
      {
        type: "object",
        additionalProperties: false,
        properties: {
          operation: { const: "search" },
        },
        required: ["operation"],
      },
      {
        type: "object",
        additionalProperties: false,
        properties: {
          operation: { const: "create" },
          title: { type: "string", minLength: 1 },
          startDate: { type: "string", pattern: ISO_DATE_OR_DATETIME_PATTERN },
          endDate: { type: "string", pattern: ISO_DATE_OR_DATETIME_PATTERN },
        },
        required: ["operation", "title", "startDate", "endDate"],
      },
    ],
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
          additionalProperties: false,
          properties: {
            type: { type: "string" },
            text: { type: "string" },
          },
          required: ["type", "text"],
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
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            location: { type: ["string", "null"] },
            notes: { type: ["string", "null"] },
            startDate: { type: ["string", "null"] },
            endDate: { type: ["string", "null"] },
            calendarName: { type: "string" },
            isAllDay: { type: "boolean" },
            url: { type: ["string", "null"] },
          },
          required: [
            "id",
            "title",
            "location",
            "notes",
            "startDate",
            "endDate",
            "calendarName",
            "isAllDay",
            "url",
          ],
        },
      },
      eventsCount: {
        type: "number",
      },
      event: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: ["string", "null"] },
          title: { type: "string" },
          startDate: { type: ["string", "null"] },
          endDate: { type: ["string", "null"] },
          location: { type: ["string", "null"] },
          notes: { type: ["string", "null"] },
          isAllDay: { type: "boolean" },
          calendarName: { type: ["string", "null"] },
        },
        required: [
          "id",
          "title",
          "startDate",
          "endDate",
          "location",
          "notes",
          "isAllDay",
          "calendarName",
        ],
      },
    },
    required: ["operation", "ok", "isError", "content"],
  },
};

export default [CALENDAR_TOOL];
