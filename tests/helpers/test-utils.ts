import { run } from "@jxa/run";
import { runAppleScript } from "run-applescript";
import { createRequire } from "node:module";
import { TEST_DATA } from "../fixtures/test-data.js";

export interface TestDataManager {
  setupTestData: () => Promise<void>;
  cleanupTestData: () => Promise<void>;
}

const require = createRequire(import.meta.url);

function loadEventKit() {
  try {
    return require("eventkit-node");
  } catch (error) {
    throw new Error(
      "eventkit-node is not installed or failed to load. Run npm install eventkit-node.",
    );
  }
}

async function ensureCalendarAccess() {
  const ek = loadEventKit();
  const granted = await ek.requestFullAccessToEvents();
  if (!granted) {
    throw new Error("Calendar access denied");
  }
  return ek;
}

function getCalendarId(calendar: any): string | undefined {
  return (
    calendar?.identifier ||
    calendar?.id ||
    calendar?.calendarIdentifier ||
    undefined
  );
}

function getCalendarTitle(calendar: any): string {
  return String(calendar?.title ?? calendar?.name ?? "");
}

function getEventId(event: any): string | undefined {
  return event?.identifier || event?.id || event?.eventIdentifier || undefined;
}

export function createTestDataManager(): TestDataManager {
  return {
    async setupTestData() {
      console.log("Setting up test contacts...");
      await setupTestContact();
      
      console.log("Setting up test notes folder...");
      await setupTestNotesFolder();
      
      console.log("Setting up test reminders list...");
      await setupTestRemindersList();
      
      console.log("Setting up test calendar...");
      await setupTestCalendar();
    },

    async cleanupTestData() {
      console.log("Cleaning up test notes...");
      await cleanupTestNotes();
      
      console.log("Cleaning up test reminders...");
      await cleanupTestReminders();
      
      console.log("Cleaning up test calendar events...");
      await cleanupTestCalendarEvents();
      
      // Note: We don't clean up contacts as they might be useful to keep
      console.log("Leaving test contact for manual cleanup if needed");
    }
  };
}

// Setup functions
async function setupTestContact(): Promise<void> {
  try {
    const script = `
tell application "Contacts"
    -- Check if test contact already exists
    set existingContacts to (every person whose name is "${TEST_DATA.CONTACT.name}")
    
    if (count of existingContacts) is 0 then
        -- Create new contact
        set newPerson to make new person with properties {first name:"Test Contact", last name:"Claude"}
        make new phone at end of phones of newPerson with properties {label:"iPhone", value:"${TEST_DATA.PHONE_NUMBER}"}
        save
        return "Created test contact"
    else
        return "Test contact already exists"
    end if
end tell`;
    
    await runAppleScript(script);
  } catch (error) {
    console.warn("Could not set up test contact:", error);
  }
}

async function setupTestNotesFolder(): Promise<void> {
  try {
    const script = `
tell application "Notes"
    set existingFolders to (every folder whose name is "${TEST_DATA.NOTES.folderName}")
    
    if (count of existingFolders) is 0 then
        make new folder with properties {name:"${TEST_DATA.NOTES.folderName}"}
        return "Created test notes folder"
    else
        return "Test notes folder already exists"
    end if
end tell`;
    
    await runAppleScript(script);
  } catch (error) {
    console.warn("Could not set up test notes folder:", error);
  }
}

async function setupTestRemindersList(): Promise<void> {
  try {
    const script = `
tell application "Reminders"
    set existingLists to (every list whose name is "${TEST_DATA.REMINDERS.listName}")
    
    if (count of existingLists) is 0 then
        make new list with properties {name:"${TEST_DATA.REMINDERS.listName}"}
        return "Created test reminders list"
    else
        return "Test reminders list already exists"
    end if
end tell`;
    
    await runAppleScript(script);
  } catch (error) {
    console.warn("Could not set up test reminders list:", error);
  }
}

async function setupTestCalendar(): Promise<void> {
  try {
    const ek = await ensureCalendarAccess();
    const calendars = ek.getCalendars("event") ?? [];
    const existing = calendars.find(
      (calendar: any) =>
        getCalendarTitle(calendar).toLowerCase() ===
        TEST_DATA.CALENDAR.calendarName.toLowerCase(),
    );
    if (existing) {
      return;
    }

    // Try to create a test calendar using the default calendar source
    const defaultCalendar =
      ek.getDefaultCalendarForNewEvents?.() ?? calendars[0];
    const sourceId =
      defaultCalendar?.sourceId ||
      defaultCalendar?.sourceIdentifier ||
      defaultCalendar?.source?.id ||
      defaultCalendar?.source?.identifier ||
      undefined;

    if (!sourceId) {
      console.warn(
        "Could not determine calendar source; skipping test calendar creation.",
      );
      return;
    }

    const calendarData: any = {
      title: TEST_DATA.CALENDAR.calendarName,
      sourceId,
    };

    ek.saveCalendar(calendarData, true);
  } catch (error) {
    console.warn("Could not set up test calendar:", error);
  }
}

// Cleanup functions
async function cleanupTestNotes(): Promise<void> {
  try {
    const script = `
tell application "Notes"
    set testFolders to (every folder whose name is "${TEST_DATA.NOTES.folderName}")
    
    repeat with testFolder in testFolders
        try
            -- Delete all notes in the folder first
            set folderNotes to notes of testFolder
            repeat with noteItem in folderNotes
                delete noteItem
            end repeat
            
            -- Then delete the folder
            delete testFolder
        on error
            -- Folder deletion might fail, just clear notes
            try
                set folderNotes to notes of testFolder
                repeat with noteItem in folderNotes
                    delete noteItem
                end repeat
            end try
        end try
    end repeat
    
    return "Test notes cleaned up"
end tell`;
    
    await runAppleScript(script);
  } catch (error) {
    console.warn("Could not clean up test notes:", error);
  }
}

async function cleanupTestReminders(): Promise<void> {
  try {
    const script = `
tell application "Reminders"
    set testLists to (every list whose name is "${TEST_DATA.REMINDERS.listName}")
    
    repeat with testList in testLists
        delete testList
    end repeat
    
    return "Test reminders cleaned up"
end tell`;
    
    await runAppleScript(script);
  } catch (error) {
    console.warn("Could not clean up test reminders:", error);
  }
}

async function cleanupTestCalendarEvents(): Promise<void> {
  try {
    const ek = await ensureCalendarAccess();
    const calendars = ek.getCalendars("event") ?? [];

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 45);

    const predicate = ek.createEventPredicate(startDate, endDate);
    const events = ek.getEventsWithPredicate(predicate) ?? [];

    const prefixes = [
      "Claude Test Event",
      "All Day Test Event",
      "Specific Calendar Event",
      "Searchable Test Event",
      "Past Event Test",
      "Invalid Date Test",
      "Invalid Time Range Test",
      "Scenario Event",
    ];

    for (const event of events) {
      const title = String(event?.title ?? event?.summary ?? "");
      if (!prefixes.some((prefix) => title.startsWith(prefix))) {
        continue;
      }
      const eventId = getEventId(event);
      if (!eventId) continue;
      try {
        ek.removeEvent(eventId, 0, true);
      } catch (removeError) {
        console.warn("Failed to remove test event:", removeError);
      }
    }

    // Remove the test calendar if it exists
    const testCalendar = calendars.find(
      (calendar: any) =>
        getCalendarTitle(calendar).toLowerCase() ===
        TEST_DATA.CALENDAR.calendarName.toLowerCase(),
    );
    const calendarId = testCalendar ? getCalendarId(testCalendar) : undefined;
    if (calendarId) {
      try {
        ek.removeCalendar(calendarId, true);
      } catch (removeCalendarError) {
        console.warn("Failed to remove test calendar:", removeCalendarError);
      }
    }
  } catch (error) {
    console.warn("Could not clean up test calendar:", error);
  }
}

// Test assertion helpers
export function assertNotEmpty<T>(value: T[], message: string): void {
  if (!value || value.length === 0) {
    throw new Error(message);
  }
}

export function assertContains(haystack: string, needle: string, message: string): void {
  if (!haystack.toLowerCase().includes(needle.toLowerCase())) {
    throw new Error(`${message}. Expected "${haystack}" to contain "${needle}"`);
  }
}

export function assertValidPhoneNumber(phoneNumber: string | null): void {
  if (!phoneNumber) {
    throw new Error("Expected valid phone number, got null or undefined");
  }
  const normalized = phoneNumber.replace(/[^0-9+]/g, '');
  if (!normalized.includes('4803764369')) {
    throw new Error(`Expected phone number to contain test number, got: ${phoneNumber}`);
  }
}

export function assertValidDate(dateString: string | null): void {
  if (!dateString) {
    throw new Error("Expected valid date string, got null");
  }
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date string: ${dateString}`);
  }
}

// Utility to wait for async operations
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
