# apple-calendar-mcp

<p align="center">
  <strong>Apple Calendar automation through MCP, optimized for n8n AI agents.</strong>
</p>

<p align="center">
  <em>Experimental project. Based on <a href="https://github.com/supermemoryai/apple-mcp">supermemoryai/apple-mcp</a>, made with Codex.</em>
</p>

<p align="center">
  <a href="https://github.com/re-fael/apple-mcp-n8n"><img alt="repository" src="https://img.shields.io/badge/github-re--fael%2Fapple--mcp--n8n-111827?style=for-the-badge"></a>
  <img alt="transport" src="https://img.shields.io/badge/transport-stdio%20%2B%20http-1d4ed8?style=for-the-badge">
  <img alt="runtime" src="https://img.shields.io/badge/runtime-bun%20%7C%20node-0f766e?style=for-the-badge">
  <img alt="focus" src="https://img.shields.io/badge/focus-calendar--only-b45309?style=for-the-badge">
</p>

---

## Overview

`apple-calendar-mcp` exposes a single MCP tool: `calendar`.

The server is intentionally narrowed to calendar-only operations for better reliability and cleaner agent behavior in n8n.

Supported operations:

- `listCalendars`
- `list`
- `search`
- `open`
- `create`
- `delete`

---

## Why this version

- Calendar-only scope
- Policy-driven exposure (`config.ini`)
- Strong schema contract (explicit operation enum + `outputSchema`)
- LLM-parser friendly schema (flat, no `oneOf`/`anyOf`/type unions/pattern regex)
- Structured responses (`operation`, `ok`, `isError`, counts, events)
- `structuredContent` is always returned (required by n8n MCP client when `outputSchema` is declared)

---

## Quick Start

### 1. Install dependencies

```bash
bun install
```

### 2. Build

```bash
bun run build
```

### 3. Run HTTP MCP server

```bash
APPLE_MCP_TRANSPORT=http \
APPLE_MCP_HTTP_HOST=127.0.0.1 \
APPLE_MCP_HTTP_PORT=8787 \
APPLE_MCP_HTTP_PATH=/mcp \
APPLE_MCP_CALENDAR_INCOMING="Calendar" \
APPLE_MCP_CALENDAR_OUTGOING="🤖AKAI" \
node dist/index.js
```

MCP endpoint:

```text
http://127.0.0.1:8787/mcp
```

---

## Calendar Safety Model

Calendar access is locked by env vars:

- `APPLE_MCP_CALENDAR_INCOMING` for read scope
- `APPLE_MCP_CALENDAR_OUTGOING` for write scope

Read operations (`list`, `search`, `open`) resolve events across both locked calendars.
Write operations (`create`, `delete`) are restricted to the outgoing calendar.

If either variable is missing, calendar operations are disabled.

---

## Tool Policy (`config.ini`)

Example:

```ini
[tools]
enabled = true
read = true
write = true

[tool.calendar]
enabled = true
read = true
write = false
```

Policy effects:

- blocked operations are hidden from `tools/list`
- blocked calls return explicit policy errors in `tools/call`

---

## Calendar Tool Contract

`calendar` input:

- `operation`: `listCalendars | list | search | open | create | delete`
- Common optional filters: `calendarName`, `fromDate`, `toDate`, `limit`
- `open`: requires `eventId`
- `create`: requires `title`, `startDate`, `endDate`
- `delete`: requires `eventId`

`calendar` output:

- always includes: `operation`, `ok`, `isError`, `content`, `structuredContent`
- `listCalendars`: `calendars`, `calendarsCount`
- `list` / `search`: `events`, `eventsCount`
- `create`: `event`
- `delete`: `deletedEventId`, `deletedFromCalendar`

---

## n8n Integration

- Use n8n MCP Client node with `http://127.0.0.1:8787/mcp`
- Prefer structured fields (`events`, `event`, counters)
- Treat `content[].text` as summary text only
- `structuredContent` is present on success and errors for n8n compatibility

---

## PM2 Runbook

PM2 ecosystem file used in this setup:

- `/Users/cabrera1/pm2-services/mcp-apple-http-streamable/ecosystem.config.js`

Recommended env values:

- `APPLE_MCP_TRANSPORT=http`
- `APPLE_MCP_HTTP_HOST=127.0.0.1`
- `APPLE_MCP_HTTP_PORT=8787`
- `APPLE_MCP_HTTP_PATH=/mcp`
- `APPLE_MCP_CALENDAR_INCOMING=Calendar`
- `APPLE_MCP_CALENDAR_OUTGOING=🤖AKAI`
- `CALENDAR_HTTP_ALLOW_WRITE=1` (enables HTTP write probe during `test:calendar-http`)

Reload env after changes:

```bash
pm2 restart /Users/cabrera1/pm2-services/mcp-apple-http-streamable/ecosystem.config.js --only apple-mcp --update-env
```

---

## Logs

- PM2 runtime logs: `pm2 logs apple-mcp`
- Delete operations are visible in PM2 logs (`deleteEvent - ...`)
- Extended calendar logs are also written to:
  - `~/apple-mcp.out.log` (or `APPLE_MCP_CALENDAR_LOG_FILE` override)

---

## Validation & Tests

```bash
bun run test:policy
bun run test:schema
bun run test:calendar
bun run test:calendar-http
CALENDAR_HTTP_ALLOW_WRITE=1 bun run test:calendar-http
```

---

## Documentation

- Agent notes: [`AGENTS.md`](./AGENTS.md)
- Test guide: [`TEST_README.md`](./TEST_README.md)
- Policy file: [`config.ini`](./config.ini)
- HTTP validation script: [`scripts/test-calendar-http.ts`](./scripts/test-calendar-http.ts)
- n8n MCP docs: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-langchain.mcpClient/
- MCP spec: https://modelcontextprotocol.io/specification

---

## Repository

- Main repo: https://github.com/re-fael/apple-mcp-n8n
- Original base project: https://github.com/supermemoryai/apple-mcp

> Experimental project, made with Codex.

---

## License

MIT (`LICENSE`)
