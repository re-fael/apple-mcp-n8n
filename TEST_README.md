# Calendar MCP Test Suite

This document explains how to run tests for the calendar-only Apple MCP server.

## Quick Start

```bash
bun run test
bun run test:policy
bun run test:calendar
bun run test:calendar-http
```

## Prerequisites

- Calendar permissions granted to Terminal/PM2 process.
- Calendar lock env vars configured:
  - `APPLE_MCP_CALENDAR_INCOMING`
  - `APPLE_MCP_CALENDAR_OUTGOING`

## Tool Policy (`config.ini`)

You can control read/write behavior for calendar with `config.ini`.

```ini
[tool.calendar]
enabled = true
read = true
write = false
```

When disabled by policy:

- `tools/list` hides blocked operations
- `tools/call` returns explicit policy errors

## Test Structure

```text
tests/
├── setup.ts
├── fixtures/test-data.ts
├── helpers/test-utils.ts
├── integration/calendar.test.ts
└── unit/tool-policy.test.ts
```

## HTTP Validation

`bun run test:calendar-http` validates:

- `tools/list` exposes `calendar`
- operation enum is policy-aware
- `inputSchema.oneOf` and `outputSchema` are present and aligned
- blocked calendar enforcement (`not allowed`, `not writable`, policy blocks)
- structured response keys (`operation`, `ok`, counters, arrays, event)

Optional write probe:

```bash
CALENDAR_HTTP_ALLOW_WRITE=1 bun run test:calendar-http
```

## Troubleshooting

- If `calendar-http` fails to connect, restart PM2 service:

```bash
pm2 restart apple-mcp --update-env
```

- If operations are blocked unexpectedly, inspect `config.ini` and calendar lock env vars.
