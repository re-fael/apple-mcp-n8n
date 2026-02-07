# 🧪 Apple MCP Test Suite

This document explains how to run the comprehensive test suite for Apple MCP tools.

## 🚀 Quick Start

```bash
# Run all tests
bun run test

# Run specific tool tests
bun run test:contacts
bun run test:messages
bun run test:notes
bun run test:mail
bun run test:reminders
bun run test:calendar
bun run test:maps
bun run test:policy
bun run test:calendar-http
```

## 📋 Prerequisites

### Required Permissions

The tests interact with real Apple apps and require appropriate permissions:

1. **Contacts Access**: Grant permission when prompted
2. **Calendar Access**: Grant permission when prompted
3. **Reminders Access**: Grant permission when prompted
4. **Notes Access**: Grant permission when prompted
5. **Mail Access**: Ensure Mail.app is configured
6. **Messages Access**: May require Full Disk Access for Terminal/iTerm2
   - System Preferences > Security & Privacy > Privacy > Full Disk Access
   - Add Terminal.app or iTerm.app

### Calendar Lock Environment Variables

Calendar operations are locked to two calendars. If either env var is missing, **all calendar operations are disabled**.

- `APPLE_MCP_CALENDAR_INCOMING` (read-only)
- `APPLE_MCP_CALENDAR_OUTGOING` (read/write)

The test setup defaults both to the test calendar (`Test-Claude-Calendar`) if you do not set them.

### Tool Policy (`config.ini`)

You can enable/disable tools and read/write capabilities per tool with `config.ini`.

```ini
[tool.calendar]
enabled = true
read = true
write = false
```

When a tool or mode is disabled:
- `tools/list` will hide blocked tools/operations.
- `tools/call` returns an explicit policy error.

### Test Phone Number

All messaging and contact tests use: **+1 9999999999**

This number is used consistently across all tests to ensure deterministic results.

## 🧪 Test Structure

```
tests/
├── setup.ts                    # Test configuration & cleanup
├── fixtures/
│   └── test-data.ts            # Test constants with phone number
├── helpers/
│   └── test-utils.ts          # Test utilities & Apple app helpers
├── integration/               # Real Apple app integration tests
│   ├── contacts-simple.test.ts # Basic contacts tests (recommended)
│   ├── contacts.test.ts       # Full contacts tests
│   ├── messages.test.ts       # Messages functionality
│   ├── notes.test.ts          # Notes functionality
│   ├── mail.test.ts           # Mail functionality
│   ├── reminders.test.ts      # Reminders functionality
│   ├── calendar.test.ts       # Calendar functionality
│   ├── maps.test.ts           # Maps functionality
├── unit/
│   └── tool-policy.test.ts    # config.ini policy parser + enforcement
└── (HTTP scripts)
    └── scripts/test-calendar-http.ts
```

## 🔧 Test Types

### 1. Integration Tests

- **Real Apple App Interaction**: Tests actually call AppleScript/JXA
- **Deterministic Data**: Uses consistent test phone number and data
- **Comprehensive Coverage**: Success, failure, and edge cases

### 2. Handler Tests

- **MCP Tool Validation**: Verifies tool schemas and structure
- **Parameter Validation**: Checks required/optional parameters
- **Error Handling**: Validates graceful error handling

## ⚠️ Troubleshooting

### Common Issues

**Permission Denied Errors:**

- Grant required app permissions in System Preferences
- Restart terminal after granting permissions

**Timeout Errors:**

- Some Apple apps take time to respond
- Tests have generous timeouts but may still timeout on slow systems

**"Command failed" Errors:**

- Usually indicates permission issues
- Check that all required Apple apps are installed and accessible

**JXA/AppleScript Errors:**

- Ensure apps are not busy or in restricted modes
- Close and reopen the relevant Apple app

### Debug Mode

For more detailed output, run individual tests:

```bash
# More verbose contacts testing
bun run test:contacts-full

# Watch mode for development
bun run test:watch

# Calendar PM2 endpoint validation
bun run test:calendar-http
```

`bun run test:calendar-http` now validates:
- `tools/list` includes `calendar` with operation enum (policy-aware; `create` may be hidden when write is disabled)
- `tools/list` includes `calendar.inputSchema.oneOf` and `calendar.outputSchema`
- schema consistency across `operation enum` / `inputSchema.oneOf` / `outputSchema.operation.enum`
- calendar lock enforcement errors (`not allowed`, `not writable`)
- structured response fields (`operation`, `ok`, `calendars`, `calendarsCount`, `events`, `eventsCount`, `event`)

## 📊 Test Coverage

The test suite covers:

- ✅ 8 Apple app integrations
- ✅ 100+ individual test cases
- ✅ Real API interactions (no mocking)
- ✅ Error handling and edge cases
- ✅ Performance and timeout handling
- ✅ Concurrent operation testing

## 🎯 Expected Results

**Successful Calendar-Focused Run Should Show:**

- All Apple apps accessible
- Test data created and cleaned up automatically
- Calendar lock calendars resolved
- Calendar list/read checks passing
- Calendar suppression checks passing (`not allowed` / `not writable`)

**Partial Success is Normal:**

- Some Apple apps may require additional permissions
- Messaging tests require active phone service
- Integration tests may skip calendar assertions when locked calendars are unavailable in the current process

## 🧹 Test Data Cleanup

The test suite automatically:

- Creates test folders/lists in Apple apps
- Uses predictable test data names
- Cleans up test data after completion
- Leaves real user data unchanged

Test data uses prefixes like:

- Notes: "Test-Claude" folder
- Reminders: "Test-Claude-Reminders" list
- Calendar: "Test-Claude-Calendar" calendar
- Contacts: "Test Contact Claude" contact
