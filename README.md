# apple-mcp-n8n

<p align="center">
  <strong>Apple app automation through MCP, designed for n8n AI agents.</strong>
</p>

<p align="center">
  <em>Experimental project. Based on <a href="https://github.com/supermemoryai/apple-mcp">supermemoryai/apple-mcp</a>, made with Codex.</em>
</p>

<p align="center">
  <a href="https://github.com/re-fael/apple-mcp-n8n"><img alt="repository" src="https://img.shields.io/badge/github-re--fael%2Fapple--mcp--n8n-111827?style=for-the-badge"></a>
  <img alt="transport" src="https://img.shields.io/badge/transport-stdio%20%2B%20http-1d4ed8?style=for-the-badge">
  <img alt="runtime" src="https://img.shields.io/badge/runtime-bun%20%7C%20node-0f766e?style=for-the-badge">
  <img alt="focus" src="https://img.shields.io/badge/focus-calendar%20safety-b45309?style=for-the-badge">
</p>

---

## Overview

`apple-mcp-n8n` exposes Apple apps as MCP tools with policy controls and predictable outputs for agent workflows.

Available tools:

| Tool | What it does |
|---|---|
| `contacts` | Search contacts and phone numbers |
| `notes` | Search, list, and create notes |
| `messages` | Read, send, schedule, and check unread messages |
| `mail` | Read/search/send emails and list accounts/mailboxes |
| `reminders` | List/search/open/create reminders |
| `calendar` | List/search/open/create events with locked read/write calendars |
| `maps` | Search, save, pin, directions, and guide operations |

---

## Why this version

This fork is focused on safe and reliable agent execution:

- `config.ini` controls tool enablement + read/write capability per tool
- `tools/list` is filtered by active policy
- `calendar` exposes strong MCP contract (`inputSchema.oneOf`, `outputSchema`)
- calendar responses include `operation`, `ok`, `isError`, and structured result fields

---

## Quick start

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

## Basic usage

### List locked calendars

```json
{
  "operation": "listCalendars"
}
```

### List events for a date range

```json
{
  "operation": "list",
  "fromDate": "2026-02-07",
  "toDate": "2026-02-14",
  "limit": 10
}
```

### Search events by keyword

```json
{
  "operation": "search",
  "searchText": "meeting",
  "limit": 10
}
```

### Create an event on writable calendar

```json
{
  "operation": "create",
  "title": "Project sync",
  "startDate": "2026-02-08T15:00:00Z",
  "endDate": "2026-02-08T15:30:00Z",
  "calendarName": "🤖AKAI"
}
```

---

## Calendar model and safety

Calendar access is locked by env vars:

- `APPLE_MCP_CALENDAR_INCOMING`: read scope
- `APPLE_MCP_CALENDAR_OUTGOING`: write scope

If either variable is missing, calendar operations are disabled.

The server explicitly rejects:

- list/search on calendars outside allowed lock set
- create on non-writable calendar names

---

## Tool policy (`config.ini`)

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

[tool.messages]
enabled = true
read = true
write = false
```

Policy effects:

- blocked tools/operations are hidden from `tools/list`
- blocked calls return clear policy errors in `tools/call`

---

## n8n integration notes

- Use n8n MCP Client node against `http://127.0.0.1:8787/mcp`
- Let the agent consume structured fields first (`events`, `event`, counters)
- Treat `content[].text` as human-readable summary, not the only data source

---

## Validation and tests

```bash
bun run test:policy
bun run test:calendar
bun run test:calendar-http
CALENDAR_HTTP_ALLOW_WRITE=1 bun run test:calendar-http
```

---

## Documentation links

- Agent/project notes: [`AGENTS.md`](./AGENTS.md)
- Test guide: [`TEST_README.md`](./TEST_README.md)
- Policy file: [`config.ini`](./config.ini)
- Calendar HTTP validation script: [`scripts/test-calendar-http.ts`](./scripts/test-calendar-http.ts)
- n8n MCP Client docs: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-langchain.mcpClient/
- MCP specification: https://modelcontextprotocol.io/specification

---

## Repository

- Main repo: https://github.com/re-fael/apple-mcp-n8n
- Upstream base: https://github.com/dhravya/apple-mcp
- Original base project: https://github.com/supermemoryai/apple-mcp

> Experimental project, made with Codex.

---

## License

MIT (`LICENSE`)
