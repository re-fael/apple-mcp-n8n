export type Step = {
  name: string;
  tool: string;
  args: Record<string, unknown>;
  expect?: {
    textIncludes?: string[];
    textRegex?: RegExp;
    isError?: boolean;
  };
  timeoutMs?: number;
  onError?: "fail" | "skip";
  requiresEnv?: string;
};

export type Scenario = {
  name: string;
  steps: Step[];
};

const now = new Date();
const inThirtyMinutes = new Date(now.getTime() + 30 * 60 * 1000);
const inSixtyMinutes = new Date(now.getTime() + 60 * 60 * 1000);
const outgoingCalendar =
  process.env.APPLE_MCP_CALENDAR_OUTGOING ?? "Test-Claude-Calendar";

export const scenarios: Scenario[] = [
  {
    name: "Contacts - list",
    steps: [
      {
        name: "contacts.list",
        tool: "contacts",
        args: {},
        expect: { isError: false },
        onError: "skip",
        timeoutMs: 20000,
      },
    ],
  },
  {
    name: "Notes - create + search",
    steps: [
      {
        name: "notes.create",
        tool: "notes",
        args: {
          operation: "create",
          title: `Scenario Note ${Date.now()}`,
          body: "SCENARIO_SEARCH_KEYWORD",
          folderName: "Test-Claude",
        },
        expect: { textIncludes: ["Created note"] },
        timeoutMs: 15000,
      },
      {
        name: "notes.search",
        tool: "notes",
        args: { operation: "search", searchText: "SCENARIO_SEARCH_KEYWORD" },
        expect: { isError: false },
        timeoutMs: 15000,
      },
    ],
  },
  {
    name: "Reminders - create + list",
    steps: [
      {
        name: "reminders.create",
        tool: "reminders",
        args: {
          operation: "create",
          name: `Scenario Reminder ${Date.now()}`,
          listName: "Test-Claude-Reminders",
          notes: "Created by scenario runner",
        },
        expect: { isError: false },
        timeoutMs: 15000,
      },
      {
        name: "reminders.list",
        tool: "reminders",
        args: { operation: "list" },
        expect: { isError: false },
        timeoutMs: 15000,
      },
    ],
  },
  {
    name: "Calendar - create + list",
    steps: [
      {
        name: "calendar.listCalendars",
        tool: "calendar",
        args: { operation: "listCalendars" },
        expect: { isError: false },
        timeoutMs: 20000,
      },
      {
        name: "calendar.create",
        tool: "calendar",
        args: {
          operation: "create",
          title: `Scenario Event ${Date.now()}`,
          startDate: inThirtyMinutes.toISOString(),
          endDate: inSixtyMinutes.toISOString(),
          location: "Test Location",
          notes: "Created by scenario runner",
          isAllDay: false,
          calendarName: outgoingCalendar,
        },
        expect: { isError: false },
        timeoutMs: 20000,
      },
      {
        name: "calendar.list",
        tool: "calendar",
        args: { operation: "list", limit: 5 },
        expect: { isError: false },
        timeoutMs: 20000,
      },
    ],
  },
  {
    name: "Maps - search + directions",
    steps: [
      {
        name: "maps.search",
        tool: "maps",
        args: { operation: "search", query: "Apple Park", limit: 3 },
        expect: { isError: false },
        timeoutMs: 20000,
      },
      {
        name: "maps.directions",
        tool: "maps",
        args: {
          operation: "directions",
          fromAddress: "Apple Park, Cupertino, CA",
          toAddress: "Googleplex, Mountain View, CA",
          transportType: "driving",
        },
        expect: { isError: false },
        timeoutMs: 20000,
      },
    ],
  },
  {
    name: "Mail - accounts + unread",
    steps: [
      {
        name: "mail.accounts",
        tool: "mail",
        args: { operation: "accounts" },
        expect: { isError: false },
        onError: "skip",
        timeoutMs: 20000,
      },
      {
        name: "mail.unread",
        tool: "mail",
        args: { operation: "unread", limit: 5 },
        expect: { isError: false },
        onError: "skip",
        timeoutMs: 20000,
      },
    ],
  },
  {
    name: "Messages - unread",
    steps: [
      {
        name: "messages.unread",
        tool: "messages",
        args: { operation: "unread", limit: 5 },
        expect: { isError: false },
        onError: "skip",
        timeoutMs: 20000,
      },
    ],
  },
  {
    name: "Messages - send (optional)",
    steps: [
      {
        name: "messages.send",
        tool: "messages",
        args: {
          operation: "send",
          phoneNumber: "+1 9999999999",
          message: `Scenario test message ${new Date().toLocaleString()}`,
        },
        expect: { isError: false },
        onError: "skip",
        requiresEnv: "MCP_ALLOW_SEND",
        timeoutMs: 20000,
      },
    ],
  },
  {
    name: "Mail - send (optional)",
    steps: [
      {
        name: "mail.send",
        tool: "mail",
        args: {
          operation: "send",
          to: "test@example.com",
          subject: `Scenario test email ${new Date().toLocaleString()}`,
          body: "Scenario runner test email body",
        },
        expect: { isError: false },
        onError: "skip",
        requiresEnv: "MCP_ALLOW_SEND",
        timeoutMs: 20000,
      },
    ],
  },
];
