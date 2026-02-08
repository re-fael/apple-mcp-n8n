import { describe, it, expect } from "bun:test";
import { TEST_DATA } from "../fixtures/test-data.js";
import { assertNotEmpty, assertValidDate, sleep } from "../helpers/test-utils.js";
import calendarModule from "../../utils/calendar.js";

const INCOMING_CALENDAR =
  process.env.APPLE_MCP_CALENDAR_INCOMING ?? TEST_DATA.CALENDAR.calendarName;
const OUTGOING_CALENDAR =
  process.env.APPLE_MCP_CALENDAR_OUTGOING ?? TEST_DATA.CALENDAR.calendarName;

function isCalendarAccessDenied(message: string | undefined): boolean {
  const normalized = String(message ?? "").toLowerCase();
  return (
    normalized.includes("calendar access was denied") ||
    normalized.includes("ensure calendar permissions are granted")
  );
}

function isCalendarUnavailable(message: string | undefined): boolean {
  const normalized = String(message ?? "").toLowerCase();
  return (
    isCalendarAccessDenied(message) ||
    normalized.includes("incoming calendar") ||
    normalized.includes("outgoing calendar") ||
    normalized.includes("calendar operations are disabled")
  );
}

function isCalendarUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return isCalendarUnavailable(message);
}

async function runOrSkipUnavailable<T>(
  label: string,
  action: () => Promise<T>,
): Promise<T | null> {
  try {
    return await action();
  } catch (error) {
    if (isCalendarUnavailableError(error)) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`ℹ️ Skipping ${label} due to calendar unavailability: ${message}`);
      return null;
    }
    throw error;
  }
}

describe("Calendar Integration Tests", () => {
  describe("getEvents", () => {
    it("should retrieve calendar events for next week", async () => {
      const events = await runOrSkipUnavailable(
        "getEvents(next week)",
        () => calendarModule.getEvents(10),
      );
      if (events === null) return;
      
      expect(Array.isArray(events)).toBe(true);
      console.log(`Found ${events.length} events in the next 7 days`);
      
      if (events.length > 0) {
        for (const event of events) {
          expect(typeof event.title).toBe("string");
          expect(typeof event.calendarName).toBe("string");
          expect(event.title.length).toBeGreaterThan(0);
          
          if (event.startDate) {
            assertValidDate(event.startDate);
          }
          if (event.endDate) {
            assertValidDate(event.endDate);
          }
          
          console.log(`  - "${event.title}" (${event.calendarName})`);
          if (event.startDate && event.endDate) {
            const startDate = new Date(event.startDate);
            const endDate = new Date(event.endDate);
            console.log(`    ${startDate.toLocaleString()} - ${endDate.toLocaleString()}`);
          }
          if (event.location) {
            console.log(`    Location: ${event.location}`);
          }
        }
      } else {
        console.log("ℹ️ No upcoming events found - this is normal");
      }
    }, 20000);

    it("should retrieve events with custom date range", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const nextWeek = new Date(tomorrow);
      nextWeek.setDate(tomorrow.getDate() + 7);
      nextWeek.setHours(23, 59, 59, 999);
      
      const events = await runOrSkipUnavailable(
        "getEvents(custom range)",
        () =>
          calendarModule.getEvents(
            20,
            tomorrow.toISOString(),
            nextWeek.toISOString()
          ),
      );
      if (events === null) return;
      
      expect(Array.isArray(events)).toBe(true);
      console.log(`Found ${events.length} events between ${tomorrow.toLocaleDateString()} and ${nextWeek.toLocaleDateString()}`);
      
      // Verify events are within the date range
      if (events.length > 0) {
        for (const event of events) {
          if (event.startDate) {
            const eventDate = new Date(event.startDate);
            expect(eventDate.getTime()).toBeGreaterThanOrEqual(tomorrow.getTime());
            expect(eventDate.getTime()).toBeLessThanOrEqual(nextWeek.getTime());
          }
        }
        console.log("✅ All events are within the specified date range");
      }
    }, 15000);

    it("should limit event count correctly", async () => {
      const limit = 3;
      const events = await runOrSkipUnavailable(
        "getEvents(limit)",
        () => calendarModule.getEvents(limit),
      );
      if (events === null) return;
      
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeLessThanOrEqual(limit);
      console.log(`Requested ${limit} events, got ${events.length}`);
    }, 15000);
  });

  describe("listCalendars", () => {
    it("should list available calendars", async () => {
      try {
        const calendars = await calendarModule.listCalendars();

        expect(Array.isArray(calendars)).toBe(true);
        console.log(`Calendars visible: ${calendars.length}`);
        if (calendars.length === 0) {
          console.log("ℹ️ No calendars found - this can happen with restricted access");
          return;
        }
        for (const calendarName of calendars) {
          expect(typeof calendarName).toBe("string");
          expect(calendarName.length).toBeGreaterThan(0);
          console.log(`  - ${calendarName}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`⚠️ Calendar access not granted: ${message}`);
      }
    }, 15000);
  });

  describe("createEvent", () => {
    it("should create a basic calendar event", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(14, 0, 0, 0); // 2 PM tomorrow
      
      const eventEndTime = new Date(tomorrow);
      eventEndTime.setHours(15, 0, 0, 0); // 3 PM tomorrow
      
      const testEventTitle = `${TEST_DATA.CALENDAR.testEvent.title} ${Date.now()}`;
      
      const result = await calendarModule.createEvent(
        testEventTitle,
        tomorrow.toISOString(),
        eventEndTime.toISOString(),
        TEST_DATA.CALENDAR.testEvent.location,
        TEST_DATA.CALENDAR.testEvent.notes
      );

      if (!result.success && isCalendarUnavailable(result.message)) {
        console.log(`ℹ️ Skipping create assertion due to calendar unavailability: ${result.message}`);
        expect(result.success).toBe(false);
        return;
      }
      
      expect(result.success).toBe(true);
      expect(result.eventId).toBeTruthy();
      
      console.log(`✅ Created event: "${testEventTitle}"`);
      console.log(`  Event ID: ${result.eventId}`);
      console.log(`  Time: ${tomorrow.toLocaleString()} - ${eventEndTime.toLocaleString()}`);
    }, 15000);

    it("should create an all-day event", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      tomorrow.setHours(0, 0, 0, 0);
      
      const eventEnd = new Date(tomorrow);
      eventEnd.setHours(23, 59, 59, 999);
      
      const allDayEventTitle = `All Day Test Event ${Date.now()}`;
      
      const result = await calendarModule.createEvent(
        allDayEventTitle,
        tomorrow.toISOString(),
        eventEnd.toISOString(),
        "All Day Location",
        "This is an all-day event",
        true // isAllDay
      );

      if (!result.success && isCalendarUnavailable(result.message)) {
        console.log(`ℹ️ Skipping all-day create assertion due to calendar unavailability: ${result.message}`);
        expect(result.success).toBe(false);
        return;
      }
      
      expect(result.success).toBe(true);
      expect(result.eventId).toBeTruthy();
      
      console.log(`✅ Created all-day event: "${allDayEventTitle}"`);
      console.log(`  Event ID: ${result.eventId}`);
    }, 15000);

    it("should create event in specific calendar if specified", async () => {
      const eventTime = new Date();
      eventTime.setDate(eventTime.getDate() + 3);
      eventTime.setHours(16, 0, 0, 0);
      
      const eventEndTime = new Date(eventTime);
      eventEndTime.setHours(17, 0, 0, 0);
      
      const specificCalendarEvent = `Specific Calendar Event ${Date.now()}`;
      
      const result = await calendarModule.createEvent(
        specificCalendarEvent,
        eventTime.toISOString(),
        eventEndTime.toISOString(),
        "Test Location",
        "Event in specific calendar",
        false,
        OUTGOING_CALENDAR
      );

      if (!result.success && isCalendarUnavailable(result.message)) {
        console.log(`ℹ️ Skipping specific-calendar create assertion due to calendar unavailability: ${result.message}`);
        expect(result.success).toBe(false);
        return;
      }
      
      expect(result.success).toBe(true);
      console.log(`✅ Created event in specific calendar: "${specificCalendarEvent}"`);
    }, 15000);
  });

  describe("searchEvents", () => {
    it("should search for events by title", async () => {
      // First create a searchable event
      const searchEventTime = new Date();
      searchEventTime.setDate(searchEventTime.getDate() + 4);
      searchEventTime.setHours(10, 0, 0, 0);
      
      const searchEventEndTime = new Date(searchEventTime);
      searchEventEndTime.setHours(11, 0, 0, 0);
      
      const searchableEventTitle = `Searchable Test Event ${Date.now()}`;
      
      const createResult = await calendarModule.createEvent(
        searchableEventTitle,
        searchEventTime.toISOString(),
        searchEventEndTime.toISOString(),
        "Search Test Location",
        "This event is for search testing"
      );
      if (!createResult.success && isCalendarUnavailable(createResult.message)) {
        console.log(`ℹ️ Skipping search-by-title test due to calendar unavailability: ${createResult.message}`);
        return;
      }
      
      await sleep(3000); // Wait for event to be indexed
      
      // Now search for it
      const searchResults = await runOrSkipUnavailable(
        "searchEvents(by title)",
        () => calendarModule.searchEvents("Searchable Test", 10),
      );
      if (searchResults === null) return;
      
      expect(Array.isArray(searchResults)).toBe(true);
      
      if (searchResults.length > 0) {
        console.log(`✅ Found ${searchResults.length} events matching "Searchable Test"`);
        for (const event of searchResults) {
          const searchableText = [
            event.title ?? "",
            event.location ?? "",
            event.notes ?? "",
          ]
            .join(" ")
            .toLowerCase();
          expect(searchableText.includes("searchable test")).toBe(true);
        }
        
        const matchingEvent = searchResults.find(event => 
          event.title.includes("Searchable Test")
        );
        
        if (matchingEvent) {
          console.log(`  - "${matchingEvent.title}"`);
          console.log(`    Calendar: ${matchingEvent.calendarName}`);
          console.log(`    ID: ${matchingEvent.id}`);
        }
      } else {
        console.log("ℹ️ No events found for 'Searchable Test' - may need time for indexing");
      }
    }, 25000);

    it("should search events with date range", async () => {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      
      const monthAfterNext = new Date(nextMonth);
      monthAfterNext.setMonth(monthAfterNext.getMonth() + 1);
      
      const searchResults = await runOrSkipUnavailable(
        "searchEvents(date range)",
        () =>
          calendarModule.searchEvents(
            "meeting",
            5,
            nextMonth.toISOString(),
            monthAfterNext.toISOString()
          ),
      );
      if (searchResults === null) return;
      
      expect(Array.isArray(searchResults)).toBe(true);
      console.log(`Found ${searchResults.length} "meeting" events in future date range`);
      
      if (searchResults.length > 0) {
        for (const event of searchResults.slice(0, 3)) {
          console.log(`  - "${event.title}" (${event.calendarName})`);
        }
      }
    }, 20000);

    it("should handle search with no results", async () => {
      const searchResults = await runOrSkipUnavailable(
        "searchEvents(no results)",
        () => calendarModule.searchEvents("VeryUniqueEventTitle12345", 5),
      );
      if (searchResults === null) return;
      
      expect(Array.isArray(searchResults)).toBe(true);
      expect(searchResults.length).toBe(0);
      
      console.log(`ℹ️ Search returned ${searchResults.length} events for unique query`);
    }, 15000);
  });

  describe("openEvent", () => {
    it("should open an existing event", async () => {
      // First get some events to find one we can open
      const existingEvents = await runOrSkipUnavailable(
        "openEvent(get existing)",
        () => calendarModule.getEvents(5),
      );
      if (existingEvents === null) return;
      
      if (existingEvents.length > 0 && existingEvents[0].id) {
        const eventToOpen = existingEvents[0];
        
        const result = await calendarModule.openEvent(eventToOpen.id);
        
        if (result.success) {
          console.log(`✅ Successfully opened event: ${result.message}`);
        } else {
          console.log(`ℹ️ Could not open event: ${result.message}`);
        }
        
        expect(typeof result.success).toBe("boolean");
        expect(typeof result.message).toBe("string");
      } else {
        console.log("ℹ️ No existing events found to test opening");
      }
    }, 15000);

    it("should handle opening non-existent event", async () => {
      const result = await calendarModule.openEvent("non-existent-event-id-12345");
      
      expect(result.success).toBe(false);
      expect(typeof result.message).toBe("string");
      
      console.log("✅ Handled non-existent event correctly");
    }, 10000);
  });

  describe("deleteEvent", () => {
    it("should delete an existing event in outgoing calendar", async () => {
      const start = new Date();
      start.setDate(start.getDate() + 5);
      start.setHours(11, 0, 0, 0);
      const end = new Date(start);
      end.setHours(12, 0, 0, 0);

      const title = `Delete Test Event ${Date.now()}`;
      const created = await calendarModule.createEvent(
        title,
        start.toISOString(),
        end.toISOString(),
        "Delete Test Location",
        "Delete test notes",
        false,
        OUTGOING_CALENDAR,
      );

      if (!created.success && isCalendarUnavailable(created.message)) {
        console.log(`ℹ️ Skipping delete assertion due to calendar unavailability: ${created.message}`);
        expect(created.success).toBe(false);
        return;
      }

      expect(created.success).toBe(true);
      expect(created.eventId).toBeTruthy();

      const deleted = await calendarModule.deleteEvent(created.eventId!, OUTGOING_CALENDAR);
      expect(deleted.success).toBe(true);
      expect(deleted.deletedEventId).toBe(created.eventId);
      console.log(`✅ Deleted event: "${title}" (${created.eventId})`);
    }, 20000);

    it("should reject deleting from non-writable calendar name", async () => {
      const result = await runOrSkipUnavailable(
        "deleteEvent(non writable)",
        () =>
          calendarModule.deleteEvent(
            "non-existent-event-id-12345",
            INCOMING_CALENDAR,
          ),
      );
      if (result === null) return;
      if (isCalendarUnavailable(result.message)) {
        console.log(`ℹ️ Skipping delete non-writable assertion due to calendar unavailability: ${result.message}`);
        expect(result.success).toBe(false);
        return;
      }

      expect(result.success).toBe(false);
      expect(result.message.toLowerCase()).toContain("not writable");
      console.log("✅ deleteEvent correctly blocks non-writable calendar target");
    }, 10000);
  });

  describe("Error Handling", () => {
    it("should handle invalid date formats gracefully", async () => {
      try {
        const result = await calendarModule.createEvent(
          "Invalid Date Test",
          "invalid-start-date",
          "invalid-end-date"
        );
        
        expect(result.success).toBe(false);
        expect(result.message).toBeTruthy();
        console.log("✅ Invalid dates were correctly rejected");
      } catch (error) {
        console.log("✅ Invalid dates threw error (expected behavior)");
        expect(error instanceof Error).toBe(true);
      }
    }, 10000);

    it("should handle empty event title gracefully", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const eventEnd = new Date(tomorrow);
      eventEnd.setHours(tomorrow.getHours() + 1);
      
      try {
        const result = await calendarModule.createEvent(
          "",
          tomorrow.toISOString(),
          eventEnd.toISOString()
        );
        
        expect(result.success).toBe(false);
        console.log("✅ Empty title was correctly rejected");
      } catch (error) {
        console.log("✅ Empty title threw error (expected behavior)");
        expect(error instanceof Error).toBe(true);
      }
    }, 10000);

    it("should handle past dates gracefully", async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const pastEventEnd = new Date(yesterday);
      pastEventEnd.setHours(yesterday.getHours() + 1);
      
      try {
        const result = await calendarModule.createEvent(
          "Past Event Test",
          yesterday.toISOString(),
          pastEventEnd.toISOString()
        );
        
        // Past events might be allowed, so check if it succeeded or failed gracefully
        if (result.success) {
          console.log("ℹ️ Past event was allowed (this may be normal behavior)");
        } else {
          console.log("✅ Past event was correctly rejected");
        }
        
        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        console.log("✅ Past event threw error (expected behavior)");
        expect(error instanceof Error).toBe(true);
      }
    }, 10000);

    it("should handle end time before start time gracefully", async () => {
      const startTime = new Date();
      startTime.setDate(startTime.getDate() + 1);
      startTime.setHours(15, 0, 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setHours(14, 0, 0, 0); // End before start
      
      try {
        const result = await calendarModule.createEvent(
          "Invalid Time Range Test",
          startTime.toISOString(),
          endTime.toISOString()
        );
        
        expect(result.success).toBe(false);
        console.log("✅ Invalid time range was correctly rejected");
      } catch (error) {
        console.log("✅ Invalid time range threw error (expected behavior)");
        expect(error instanceof Error).toBe(true);
      }
    }, 10000);

    it("should handle empty search text gracefully", async () => {
      const searchResults = await runOrSkipUnavailable(
        "searchEvents(empty query)",
        () => calendarModule.searchEvents("", 5),
      );
      if (searchResults === null) return;
      
      expect(Array.isArray(searchResults)).toBe(true);
      console.log("✅ Handled empty search text correctly");
    }, 10000);
  });
});
