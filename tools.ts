import { type Tool } from "@modelcontextprotocol/sdk/types.js";

const CONTACTS_TOOL: Tool = {
    name: "contacts",
    description: "Search and retrieve contacts from Apple Contacts app",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name to search for (optional - if not provided, returns all contacts). Can be partial name to search."
        }
      }
    }
  };
  
  const NOTES_TOOL: Tool = {
    name: "notes", 
    description: "Search, retrieve and create notes in Apple Notes app",
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          description: "Operation to perform: 'search', 'list', or 'create'",
          enum: ["search", "list", "create"]
        },
        searchText: {
          type: "string",
          description: "Text to search for in notes (required for search operation)"
        },
        title: {
          type: "string",
          description: "Title of the note to create (required for create operation)"
        },
        body: {
          type: "string",
          description: "Content of the note to create (required for create operation)"
        },
        folderName: {
          type: "string",
          description: "Name of the folder to create the note in (optional for create operation, defaults to 'Claude')"
        }
      },
      required: ["operation"]
    }
  };
  
const MESSAGES_TOOL: Tool = {
    name: "messages",
    description: "Interact with Apple Messages app - send, read, schedule messages and check unread messages. Returned message dates are ISO 8601 UTC strings.",
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          description: "Operation to perform: 'send', 'read', 'schedule', or 'unread'",
          enum: ["send", "read", "schedule", "unread"]
        },
        phoneNumber: {
          type: "string",
          description: "Phone number to send message to (required for send, read, and schedule operations)"
        },
        message: {
          type: "string",
          description: "Message to send (required for send and schedule operations)"
        },
        limit: {
          type: "number",
          description: "Number of messages to read (optional, for read and unread operations)"
        },
        scheduledTime: {
          type: "string",
          description: "When to send the message in ISO 8601 timestamp format (required for schedule operation): YYYY-MM-DDTHH:mm:ssZ"
        }
      },
      required: ["operation"]
    }
  };
  
  const MAIL_TOOL: Tool = {
    name: "mail",
    description: "Interact with Apple Mail app - read unread emails, search emails, and send emails",
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          description: "Operation to perform: 'unread', 'search', 'send', 'mailboxes', 'accounts', or 'latest'",
          enum: ["unread", "search", "send", "mailboxes", "accounts", "latest"]
        },
        account: {
          type: "string",
          description: "Email account to use (optional - if not provided, searches across all accounts)"
        },
        mailbox: {
          type: "string",
          description: "Mailbox to use (optional - if not provided, uses inbox or searches across all mailboxes)"
        },
        limit: {
          type: "number",
          description: "Number of emails to retrieve (optional, for unread, search, and latest operations)"
        },
        searchTerm: {
          type: "string",
          description: "Text to search for in emails (required for search operation)"
        },
        to: {
          type: "string",
          description: "Recipient email address (required for send operation)"
        },
        subject: {
          type: "string",
          description: "Email subject (required for send operation)"
        },
        body: {
          type: "string",
          description: "Email body content (required for send operation)"
        },
        cc: {
          type: "string",
          description: "CC email address (optional for send operation)"
        },
        bcc: {
          type: "string",
          description: "BCC email address (optional for send operation)"
        }
      },
      required: ["operation"]
    }
  };
  
  const REMINDERS_TOOL: Tool = {
    name: "reminders",
    description: "Search, create, and open reminders in Apple Reminders app",
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          description: "Operation to perform: 'list', 'search', 'open', 'create', or 'listById'",
          enum: ["list", "search", "open", "create", "listById"]
        },
        searchText: {
          type: "string",
          description: "Text to search for in reminders (required for search and open operations)"
        },
        name: {
          type: "string",
          description: "Name of the reminder to create (required for create operation)"
        },
        listName: {
          type: "string",
          description: "Name of the list to create the reminder in (optional for create operation)"
        },
        listId: {
          type: "string",
          description: "ID of the list to get reminders from (required for listById operation)"
        },
        props: {
          type: "array",
          items: {
            type: "string"
          },
          description: "Properties to include in the reminders (optional for listById operation)"
        },
        notes: {
          type: "string",
          description: "Additional notes for the reminder (optional for create operation)"
        },
      dueDate: {
        type: "string",
        description: "Due date in ISO 8601 format (optional for create operation): YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ"
      }
      },
      required: ["operation"]
    }
  };
  
  
const CALENDAR_TOOL: Tool = {
  name: "calendar",
  description:
    "Search, create, and open calendar events in Apple Calendar app. Use operation=list for date-range availability and operation=search for keyword filtering. Calendar access is locked to incoming/outgoing calendars. Returned startDate/endDate values are ISO 8601 UTC strings.",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        description:
          "Operation to perform: 'search', 'open', 'list', 'listCalendars', or 'create'. Use 'list' for date-only availability checks; use 'search' for keyword filtering.",
        enum: ["search", "open", "list", "listCalendars", "create"]
      },
      searchText: {
        type: "string",
        description:
          "Optional keyword filter for event titles, locations, and notes (search operation). For date-only queries, prefer operation='list' or leave this empty."
      },
      eventId: {
        type: "string",
        description: "ID of the event to open (required for open operation)"
      },
      limit: {
        type: "number",
        description: "Number of events to retrieve (optional, default 10, max 50)"
      },
      fromDate: {
        type: "string",
        description:
          "Start date for search range in ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ",
        pattern:
          "^\\d{4}-\\d{2}-\\d{2}(?:T\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d{1,3})?)?(?:Z|[+-]\\d{2}:?\\d{2})?)?$"
      },
      toDate: {
        type: "string",
        description:
          "End date for search range in ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ",
        pattern:
          "^\\d{4}-\\d{2}-\\d{2}(?:T\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d{1,3})?)?(?:Z|[+-]\\d{2}:?\\d{2})?)?$"
      },
      title: {
        type: "string",
        description: "Title of the event to create (required for create operation)"
      },
      startDate: {
        type: "string",
        description:
          "Event start date/time in ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ",
        pattern:
          "^\\d{4}-\\d{2}-\\d{2}(?:T\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d{1,3})?)?(?:Z|[+-]\\d{2}:?\\d{2})?)?$"
      },
      endDate: {
        type: "string",
        description:
          "Event end date/time in ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ",
        pattern:
          "^\\d{4}-\\d{2}-\\d{2}(?:T\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d{1,3})?)?(?:Z|[+-]\\d{2}:?\\d{2})?)?$"
      },
      location: {
        type: "string",
        description: "Location of the event (optional for create operation)"
      },
      notes: {
        type: "string",
        description: "Additional notes for the event (optional for create operation)"
      },
      isAllDay: {
        type: "boolean",
        description: "Whether the event is an all-day event (optional for create operation, default is false)"
      },
      calendarName: {
        type: "string",
        description: "Name of the calendar to target (optional for list/search/create; list/search use both allowed locked calendars if omitted, create uses outgoing calendar if omitted)"
      }
    },
    required: ["operation"],
    oneOf: [
      {
        properties: {
          operation: { const: "listCalendars" }
        },
        required: ["operation"]
      },
      {
        properties: {
          operation: { const: "open" },
          eventId: { type: "string", minLength: 1 }
        },
        required: ["operation", "eventId"]
      },
      {
        properties: {
          operation: { const: "list" }
        },
        required: ["operation"]
      },
      {
        properties: {
          operation: { const: "search" }
        },
        required: ["operation"]
      },
      {
        properties: {
          operation: { const: "create" },
          title: { type: "string", minLength: 1 },
          startDate: {
            type: "string",
            pattern:
              "^\\d{4}-\\d{2}-\\d{2}(?:T\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d{1,3})?)?(?:Z|[+-]\\d{2}:?\\d{2})?)?$"
          },
          endDate: {
            type: "string",
            pattern:
              "^\\d{4}-\\d{2}-\\d{2}(?:T\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d{1,3})?)?(?:Z|[+-]\\d{2}:?\\d{2})?)?$"
          }
        },
        required: ["operation", "title", "startDate", "endDate"]
      }
    ]
  },
  outputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["search", "open", "list", "listCalendars", "create"]
      },
      ok: {
        type: "boolean",
        description: "Convenience success flag. Equivalent to !isError."
      },
      isError: {
        type: "boolean"
      },
      content: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string" },
            text: { type: "string" }
          },
          required: ["type", "text"]
        }
      },
      calendars: {
        type: "array",
        items: { type: "string" }
      },
      calendarsCount: {
        type: "number"
      },
      events: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            location: { type: ["string", "null"] },
            notes: { type: ["string", "null"] },
            startDate: { type: ["string", "null"] },
            endDate: { type: ["string", "null"] },
            calendarName: { type: "string" },
            isAllDay: { type: "boolean" },
            url: { type: ["string", "null"] }
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
            "url"
          ]
        }
      },
      eventsCount: {
        type: "number"
      },
      event: {
        type: "object",
        properties: {
          id: { type: ["string", "null"] },
          title: { type: "string" },
          startDate: { type: ["string", "null"] },
          endDate: { type: ["string", "null"] },
          location: { type: ["string", "null"] },
          notes: { type: ["string", "null"] },
          isAllDay: { type: "boolean" },
          calendarName: { type: ["string", "null"] }
        },
        required: [
          "id",
          "title",
          "startDate",
          "endDate",
          "location",
          "notes",
          "isAllDay",
          "calendarName"
        ]
      }
    },
    required: ["operation", "ok", "isError", "content"]
  }
};
  
const MAPS_TOOL: Tool = {
  name: "maps",
  description: "Search locations, manage guides, save favorites, and get directions using Apple Maps",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        description: "Operation to perform with Maps",
        enum: ["search", "save", "directions", "pin", "listGuides", "addToGuide", "createGuide"]
      },
      query: {
        type: "string",
        description: "Search query for locations (required for search)"
      },
      limit: {
        type: "number",
        description: "Maximum number of results to return (optional for search)"
      },
      name: {
        type: "string",
        description: "Name of the location (required for save and pin)"
      },
      address: {
        type: "string",
        description: "Address of the location (required for save, pin, addToGuide)"
      },
      fromAddress: {
        type: "string",
        description: "Starting address for directions (required for directions)"
      },
      toAddress: {
        type: "string",
        description: "Destination address for directions (required for directions)"
      },
      transportType: {
        type: "string",
        description: "Type of transport to use (optional for directions)",
        enum: ["driving", "walking", "transit"]
      },
      guideName: {
        type: "string",
        description: "Name of the guide (required for createGuide and addToGuide)"
      }
    },
    required: ["operation"]
  }
};

const tools = [CONTACTS_TOOL, NOTES_TOOL, MESSAGES_TOOL, MAIL_TOOL, REMINDERS_TOOL, CALENDAR_TOOL, MAPS_TOOL];

export default tools;
