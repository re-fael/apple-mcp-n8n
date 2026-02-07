# 🍎 Apple MCP - Better Siri that can do it all :)

> **Plot twist:** Your Mac can do more than just look pretty. Turn your Apple apps into AI superpowers!

Love this MCP? Check out supermemory MCP too - https://mcp.supermemory.ai


Click below for one click install with `.dxt`

<a href="https://github.com/supermemoryai/apple-mcp/releases/download/1.0.0/apple-mcp.dxt">
  <img  width="280" alt="Install with Claude DXT" src="https://github.com/user-attachments/assets/9b0fa2a0-a954-41ee-ac9e-da6e63fc0881" />
</a>

[![smithery badge](https://smithery.ai/badge/@Dhravya/apple-mcp)](https://smithery.ai/server/@Dhravya/apple-mcp)


<a href="https://glama.ai/mcp/servers/gq2qg6kxtu">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/gq2qg6kxtu/badge" alt="Apple Server MCP server" />
</a>

## 🤯 What Can This Thing Do?

**Basically everything you wish your Mac could do automatically (but never bothered to set up):**

### 💬 **Messages** - Because who has time to text manually?

- Send messages to anyone in your contacts (even that person you've been avoiding)
- Read your messages (finally catch up on those group chats)
- Schedule messages for later (be that organized person you pretend to be)

### 📝 **Notes** - Your brain's external hard drive

- Create notes faster than you can forget why you needed them
- Search through that digital mess you call "organized notes"
- Actually find that brilliant idea you wrote down 3 months ago

### 👥 **Contacts** - Your personal network, digitized

- Find anyone in your contacts without scrolling forever
- Get phone numbers instantly (no more "hey, what's your number again?")
- Actually use that contact database you've been building for years

### 📧 **Mail** - Email like a pro (or at least pretend to)

- Send emails with attachments, CC, BCC - the whole professional shebang
- Search through your email chaos with surgical precision
- Schedule emails for later (because 3 AM ideas shouldn't be sent at 3 AM)
- Check unread counts (prepare for existential dread)

### ⏰ **Reminders** - For humans with human memory

- Create reminders with due dates (finally remember to do things)
- Search through your reminder graveyard
- List everything you've been putting off
- Open specific reminders (face your procrastination)

### 📅 **Calendar** - Time management for the chronically late

- Create events faster than you can double-book yourself
- Search for that meeting you're definitely forgetting about
- List upcoming events (spoiler: you're probably late to something)
- Open calendar events directly (skip the app hunting)

### 🗺️ **Maps** - For people who still get lost with GPS

- Search locations (find that coffee shop with the weird name)
- Save favorites (bookmark your life's important spots)
- Get directions (finally stop asking Siri while driving)
- Create guides (be that friend who plans everything)
- Drop pins like you're claiming territory

## 🎭 The Magic of Chaining Commands

Here's where it gets spicy. You can literally say:

_"Read my conference notes, find contacts for the people I met, and send them a thank you message"_

And it just... **works**. Like actual magic, but with more code.

## 🚀 Installation (The Easy Way)

### Option 1: Smithery (For the Sophisticated)

```bash
npx -y install-mcp apple-mcp --client claude
```

For Cursor users (we see you):

```bash
npx -y install-mcp apple-mcp --client cursor
```

### Option 2: Manual Setup (For the Brave)

<details>
<summary>Click if you're feeling adventurous</summary>

First, get bun (if you don't have it already):

```bash
brew install oven-sh/bun/bun
```

Then add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "apple-mcp": {
      "command": "bunx",
      "args": ["--no-cache", "apple-mcp@latest"]
    }
  }
}
```

</details>

## 🎬 See It In Action

Here's a step-by-step video walkthrough: https://x.com/DhravyaShah/status/1892694077679763671

(Yes, it's actually as cool as it sounds)

## 📆 Calendar Access Lock

Calendar operations are locked to **two named calendars**:

- **Incoming (read-only):** `APPLE_MCP_CALENDAR_INCOMING`
- **Outgoing (read/write):** `APPLE_MCP_CALENDAR_OUTGOING`

If **either** env var is missing, **all calendar operations are disabled**.

Example (Claude Desktop config):

```json
{
  "mcpServers": {
    "apple-mcp": {
      "command": "bunx",
      "args": ["--no-cache", "apple-mcp@latest"],
      "env": {
        "APPLE_MCP_CALENDAR_INCOMING": "Team Calendar",
        "APPLE_MCP_CALENDAR_OUTGOING": "Personal Calendar"
      }
    }
  }
}
```

## ⚙️ Tool Policy (`config.ini`)

Tool availability and per-tool read/write permissions are controlled by `config.ini`.

- Default lookup order:
  1. `APPLE_MCP_CONFIG_FILE` (if set)
  2. `./config.ini` (current working directory)
  3. project `config.ini` (next to `index.ts`)
- If no config file is found, all tools are enabled with both read and write.

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

Notes:
- `enabled=false` disables the entire tool.
- `read=false` blocks read-like operations for that tool.
- `write=false` blocks write-like operations for that tool.
- `tools/list` is filtered to only show tools/operations currently allowed by policy.

## 🤖 MCP Exposure Contract (AI Agent / n8n)

The most important surfaces exposed to AI agents are:

- `initialize` response `instructions` (server guidance + operational constraints)
- `tools/list` (tool names, descriptions, input schemas, operation enums)
- `tools/call` result payloads (text + structured fields)

### Current `tools/list` exposure (live)

As tested against `http://127.0.0.1:8787/mcp` on **2026-02-07**, `tools/list` exposed:
- `contacts`
- `notes`
- `messages`
- `mail`
- `reminders`
- `calendar`
- `maps`

For `calendar`, `inputSchema.properties.operation.enum` is:
- `search`
- `open`
- `list`
- `listCalendars`
- `create`

For `calendar`, `tools/list` now also exposes:
- `inputSchema.oneOf` with operation-specific requirements (for example `open` requires `eventId`, `create` requires `title`, `startDate`, `endDate`)
- `outputSchema` describing structured return fields (`operation`, `ok`, `isError`, `events`, `eventsCount`, `calendars`, `calendarsCount`, `event`)

### Calendar `tools/call` result shapes

`calendar` returns `content` + `operation` + `ok` + `isError` for all operations, with structured fields by operation:

- `listCalendars`:
  - `calendars: string[]`
  - `calendarsCount: number`
  - `operation: "listCalendars"`
  - `ok: true`
  - `isError: false`
- `list`:
  - `events: CalendarEvent[]`
  - `eventsCount: number`
  - `operation: "list"`
  - `ok: true`
  - `isError: false`
- `search`:
  - `events: CalendarEvent[]`
  - `eventsCount: number`
  - `operation: "search"`
  - `ok: true`
  - `isError: false`
- `create` (success):
  - `event: { id, title, startDate, endDate, location, notes, isAllDay, calendarName }`
  - `operation: "create"`
  - `ok: true`
  - `isError: false`
- `open`:
  - `content` text (`"Event found"` on success)
  - `operation: "open"`
  - `ok: true`
  - `isError: false`
- Any failure:
  - `operation: <requested operation>`
  - `ok: false`
  - `isError: true`
  - `content[0].text` with actionable error message (`not allowed`, `not writable`, validation, permissions, etc.)

`CalendarEvent` fields currently include:
- `id`, `title`, `location`, `notes`, `startDate`, `endDate`, `calendarName`, `isAllDay`, `url`

Important:
- MCP clients should consume structured fields (`events`, `event`, counters) first, and only use `content` text for narration.
- Some wrappers (including chat tool wrappers) may only display the `content` text even when raw MCP includes structured fields.

## 🎯 Example Commands That'll Blow Your Mind

```
"Send a message to mom saying I'll be late for dinner"
```

```
"Find all my AI research notes and email them to sarah@company.com"
```

```
"Create a reminder to call the dentist tomorrow at 2pm"
```

```
"Show me my calendar for next week and create an event for coffee with Alex on Friday"
```

```
"Find the nearest pizza place and save it to my favorites"
```

## 🛠️ Local Development (For the Tinkerers)

```bash
git clone https://github.com/dhravya/apple-mcp.git
cd apple-mcp
bun install
bun run index.ts
```

Now go forth and automate your digital life! 🚀

---

## ✅ HTTP Streamable (Recommended)

This server supports **HTTP Streamable** (single endpoint, modern MCP transport).

### Build + Run

```bash
bun run build
APPLE_MCP_TRANSPORT=http APPLE_MCP_HTTP_PORT=8787 node dist/index.js
```

Or use the shortcut script:

```bash
bun run serve:http
```

**Endpoint:**
```
http://127.0.0.1:8787/mcp
```

### Claude Desktop / Clients
Use **HTTP Streamable URL** and set it to:
```
http://127.0.0.1:8787/mcp
```

### HTTP env vars
- `APPLE_MCP_TRANSPORT=http`
- `APPLE_MCP_HTTP_PORT=8787`
- `APPLE_MCP_HTTP_HOST=127.0.0.1`
- `APPLE_MCP_HTTP_PATH=/mcp`
- `APPLE_MCP_HTTP_ALLOWED_ORIGINS=http://localhost:8787,http://127.0.0.1:8787`
- `APPLE_MCP_HTTP_ALLOW_ANY_ORIGIN=1` (disable origin checks)

---

## 🧪 Standalone Validation CLI (No Server Spawn)

This script **does NOT start a server**. It only validates a running MCP server.

```bash
bun run validate:mcp -- --url http://127.0.0.1:8787/mcp
```

Options:
```bash
# List scenarios
bun run validate:mcp -- --list

# Run only Calendar scenarios
bun run validate:mcp -- --scenario Calendar

# Multiply timeouts (slow AppleScript)
bun run validate:mcp -- --timeout-multiplier 2

# Treat timeouts as SKIP
bun run validate:mcp -- --skip-timeouts
```

---

## 🧰 PM2 (Production-ish)

An `ecosystem.config.cjs` is included for HTTP Streamable.

```bash
bun run build
pm2 start ecosystem.config.cjs
pm2 logs apple-mcp
pm2 save
pm2 startup
```

---

## ▶️ Start Commands (All Modes)

### Stdio (local, direct)
```bash
node /Users/cabrera1/Workbench_offline/mcp/apple-mcp/dist/index.js
```

### HTTP Streamable
```bash
APPLE_MCP_TRANSPORT=http APPLE_MCP_HTTP_PORT=8787 node /Users/cabrera1/Workbench_offline/mcp/apple-mcp/dist/index.js
```

### PM2
```bash
pm2 start /Users/cabrera1/Workbench_offline/mcp/apple-mcp/ecosystem.config.cjs
```

---

## 🧪 Tests (All Commands)

### Unit/Integration (Bun)
```bash
bun run test
bun run test:contacts
bun run test:notes
bun run test:messages
bun run test:mail
bun run test:reminders
bun run test:calendar
bun run test:policy
bun run test:calendar-http
bun run test:maps
bun run test:mcp
bun run test:scenarios
```

### Watch mode
```bash
bun run test:watch
```

### Standalone validation (running server required)
```bash
bun run validate:mcp -- --url http://127.0.0.1:8787/mcp
```

### Scenario runner (spawns stdio server)
```bash
bun run test:scenarios
```

---

## 📂 File Locations

- Server entry (built): `dist/index.js`
- Server entry (source): `index.ts`
- Tool policy config: `config.ini`
- Tool policy loader: `utils/tool-policy.ts`
- HTTP streamable server logic: `utils/streamable-http.ts`
- PM2 config: `ecosystem.config.cjs`
- Scenario runner (stdio): `scripts/run-scenarios.ts`
- Standalone validator (HTTP): `scripts/validate-mcp.ts`
- Calendar HTTP validator: `scripts/test-calendar-http.ts`
- Scenario definitions: `tests/scenarios.ts`
- Integration tests: `tests/integration/*`

---

## 🧩 MCP Config Examples

### Claude / MCP JSON (HTTP Streamable)
```json
{
  "mcpServers": {
    "apple-mcp": {
      "command": "node",
      "args": ["/Users/cabrera1/Workbench_offline/mcp/apple-mcp/dist/index.js"],
      "env": {
        "APPLE_MCP_TRANSPORT": "http",
        "APPLE_MCP_HTTP_PORT": "8787"
      }
    }
  }
}
```

### MCP JSON (Stdio)
```json
{
  "mcpServers": {
    "apple-mcp": {
      "command": "node",
      "args": ["/Users/cabrera1/Workbench_offline/mcp/apple-mcp/dist/index.js"]
    }
  }
}
```

### HTTP Streamable URL (clients that ask for a URL)
```
http://127.0.0.1:8787/mcp
```

---

## 🧯 Troubleshooting

### No access / permission errors
- macOS Privacy & Security -> Automation: enable access for your terminal/app to Calendar, Contacts, Notes, Reminders, Mail, Messages, Maps.
- If using HTTP Streamable + PM2, the permission must be granted to the PM2-hosted process (restart after granting).

### Tool disabled / operation blocked by policy
- Check `config.ini` (or `APPLE_MCP_CONFIG_FILE`) for `[tool.<name>]` values.
- Ensure both the tool and required mode are enabled (`enabled=true`, `read=true` and/or `write=true`).
- Restart the server after editing policy.

### Empty calendar results
- Ensure `fromDate` / `toDate` are ISO (see Calendar Notes below).
- If events start before `fromDate` but overlap the range, they will be missed (ask to enable overlap logic).
- Try restricting with `calendarName` to reduce scanning time.

### Timeouts in validation
- Use `--timeout-multiplier 2` or `--skip-timeouts`.
- AppleScript can be slow on large datasets.

### HTTP Streamable "not reachable"
- Make sure the server is running: `lsof -nP -iTCP:8787 -sTCP:LISTEN`
- Confirm URL is `/mcp` and port matches `APPLE_MCP_HTTP_PORT`.

---

## 📅 Date & Time Contract (Important)

All date/time fields exposed to MCP clients (including N8N agents) use ISO 8601.

### Accepted input formats
- `YYYY-MM-DD` (date only)
- `YYYY-MM-DDTHH:mm:ssZ` (timestamp, UTC or offset)

Examples:
```
2026-02-11
2026-02-11T09:30:00Z
```

### Tool-specific date inputs
- `calendar.fromDate`, `calendar.toDate`, `calendar.startDate`, `calendar.endDate`: ISO 8601.
- `messages.scheduledTime`: ISO 8601 timestamp (`YYYY-MM-DDTHH:mm:ssZ`).
- `reminders.dueDate`: ISO 8601 date or timestamp.

### Returned date formats
- Calendar events are returned with `startDate` and `endDate` as ISO 8601 UTC strings.
- Message timestamps are returned as ISO 8601 UTC strings.
- Text summaries also show ISO values (no locale-formatted dates).

### Target a specific calendar
`calendarName` can be used with **list** and **search** to restrict the scope:
```json
{
  "operation": "search",
  "searchText": "ADAPT",
  "fromDate": "2026-02-01",
  "toDate": "2026-02-28",
  "calendarName": "Work",
  "limit": 10
}
```

### List available calendars
```
{ "operation": "listCalendars" }
```

---

## 📝 Calendar Logs

Calendar operations write a human-readable log file:
```
~/apple-mcp.out.log
```

Override path:
```
APPLE_MCP_CALENDAR_LOG_FILE=/tmp/apple-mcp.out.log
```

---

_Made with ❤️ by supermemory (and honestly, claude code)_
