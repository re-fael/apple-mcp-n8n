export const TEST_DATA = {
  CALENDAR: {
    calendarName: "Test-Claude-Calendar",
    testEvent: {
      title: "Claude Test Event",
      location: "Test Location",
      notes: "This is a test calendar event created by Claude",
    },
  },
} as const;

export type TestData = typeof TEST_DATA;
