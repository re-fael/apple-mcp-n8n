# Agent Notes

## Scope

This repository exposes Apple MCP tools (Contacts, Notes, Messages, Mail, Reminders, Calendar, Maps) with stdio and HTTP transports.

## Tool Policy

- Tool access policy is defined in `config.ini`.
- Loader implementation: `utils/tool-policy.ts`.
- Override config path with `APPLE_MCP_CONFIG_FILE`.
- Policy controls:
  - `enabled` (tool on/off)
  - `read` (read-like operations)
  - `write` (write-like operations)
- `tools/list` output is filtered by policy.
- `tools/call` enforces policy and returns explicit block errors.

## Calendar

- Calendar lock env vars:
  - `APPLE_MCP_CALENDAR_INCOMING` (read)
  - `APPLE_MCP_CALENDAR_OUTGOING` (write)
- Calendar integration tests (`tests/integration/calendar.test.ts`) now skip assertions when calendar lock targets are unavailable in the current process.

## MCP Agent Exposure

- AI agents receive guidance from `initialize.result.instructions`.
- Tool discovery comes from `tools/list` (name, description, `inputSchema`, operation enums).
- Calendar tool discovery also includes `inputSchema.oneOf` and `outputSchema`.
- Runtime outputs come from `tools/call` (`content` plus structured keys where provided).
- For `calendar`:
  - All operations return `operation`, `ok`, `isError`, and `content`.
  - `listCalendars` returns `calendars`, `calendarsCount`.
  - `list`/`search` return `events`, `eventsCount`.
  - `create` returns `event` (on success).
  - `open` returns text content.
- Enforce agent logic on structured keys first; treat `content[].text` as human-readable summary.

## Test Commands

- Unit + integration batch: `bun run test`
- Policy tests: `bun run test:policy`
- Calendar integration: `bun run test:calendar`
- Calendar HTTP validation (PM2/live endpoint): `bun run test:calendar-http`
- Optional live write probe: `CALENDAR_HTTP_ALLOW_WRITE=1 bun run test:calendar-http`
