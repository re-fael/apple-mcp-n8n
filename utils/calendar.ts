import { createRequire } from "node:module";
import { logCalendar } from "./logger.js";

const require = createRequire(import.meta.url);

const CONFIG = {
	MAX_EVENTS: 50,
};
const CALENDAR_ENV = {
	INCOMING: "APPLE_MCP_CALENDAR_INCOMING",
	OUTGOING: "APPLE_MCP_CALENDAR_OUTGOING",
} as const;

// Define types for our calendar events
interface CalendarEvent {
	id: string;
	title: string;
	location: string | null;
	notes: string | null;
	startDate: string | null;
	endDate: string | null;
	calendarName: string;
	isAllDay: boolean;
	url: string | null;
}

let eventkitModule: any | null = null;

function loadEventKit(): any {
	if (eventkitModule) return eventkitModule;
	try {
		eventkitModule = require("eventkit-node");
		return eventkitModule;
	} catch (error) {
		throw new Error(
			"eventkit-node is not installed or failed to load. Install it with npm install eventkit-node and ensure Xcode Command Line Tools are available.",
		);
	}
}

async function ensureCalendarAccess(): Promise<any> {
	const ek = loadEventKit();
	const granted = await ek.requestFullAccessToEvents();
	if (!granted) {
		throw new Error(
			"Calendar access was denied. Ensure Calendar permissions are granted in System Settings.",
		);
	}
	return ek;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIMESTAMP =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})$/;

function normalizeDateInput(value: unknown, fieldName: string): string | undefined {
	if (value === undefined || value === null) return undefined;
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value.toISOString();
	}
	if (typeof value !== "string") {
		throw new Error(
			`${fieldName} must be a string in ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)`,
		);
	}

	const raw = value.trim();
	if (!raw) {
		throw new Error(
			`${fieldName} must be a non-empty string in ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)`,
		);
	}

	if (DATE_ONLY.test(raw) || ISO_TIMESTAMP.test(raw)) {
		return raw;
	}

	throw new Error(
		`${fieldName} must be ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ). Received: "${raw}"`,
	);
}

function parseDateInput(value: string, fieldName: string): Date {
	if (DATE_ONLY.test(value)) {
		const [year, month, day] = value.split("-").map(Number);
		return new Date(year, month - 1, day, 0, 0, 0);
	}
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		throw new Error(
			`${fieldName} must be ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ). Received: "${value}"`,
		);
	}
	return parsed;
}

function endOfDay(date: Date): Date {
	return new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
		23,
		59,
		59,
		999,
	);
}

function getCalendarTitle(calendar: any): string {
	return String(calendar?.title ?? calendar?.name ?? "");
}

function getEventCalendarName(event: any): string {
	return (
		getCalendarTitle(event?.calendar) ||
		String(event?.calendarTitle ?? event?.calendarName ?? "")
	);
}

function getCalendarId(calendar: any): string {
	return String(
		calendar?.identifier ??
			calendar?.id ??
			calendar?.calendarIdentifier ??
			"",
	);
}

type CalendarLock = {
	incoming: string;
	outgoing: string;
	allowedLower: Set<string>;
};

function getCalendarLock(): CalendarLock {
	const incoming = process.env[CALENDAR_ENV.INCOMING]?.trim() ?? "";
	const outgoing = process.env[CALENDAR_ENV.OUTGOING]?.trim() ?? "";

	if (!incoming || !outgoing) {
		throw new Error(
			`Calendar operations are disabled. Set ${CALENDAR_ENV.INCOMING} and ${CALENDAR_ENV.OUTGOING}.`,
		);
	}

	return {
		incoming,
		outgoing,
		allowedLower: new Set([incoming.toLowerCase(), outgoing.toLowerCase()]),
	};
}

function findCalendarByName(calendars: any[], name: string): any | null {
	const nameLower = name.trim().toLowerCase();
	if (!nameLower) return null;
	return (
		calendars.find(
			(calendar: any) => getCalendarTitle(calendar).toLowerCase() === nameLower,
		) ?? null
	);
}

function resolveLockedCalendars(ek: any, lock: CalendarLock): {
	calendars: any[];
	incomingCalendar: any;
	outgoingCalendar: any;
} {
	const calendars = ek.getCalendars("event") ?? [];
	const incomingCalendar = findCalendarByName(calendars, lock.incoming);
	if (!incomingCalendar) {
		throw new Error(`Incoming calendar "${lock.incoming}" not found.`);
	}

	let outgoingCalendar = incomingCalendar;
	if (lock.outgoing.toLowerCase() !== lock.incoming.toLowerCase()) {
		outgoingCalendar = findCalendarByName(calendars, lock.outgoing);
		if (!outgoingCalendar) {
			throw new Error(`Outgoing calendar "${lock.outgoing}" not found.`);
		}
	}

	return { calendars, incomingCalendar, outgoingCalendar };
}

function isCalendarLockError(message: string): boolean {
	return (
		message.includes("Calendar operations are disabled") ||
		message.includes("Incoming calendar") ||
		message.includes("Outgoing calendar") ||
		message.includes("not allowed")
	);
}

function normalizeEventDate(value: any): string | null {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString();
}

function mapEvent(event: any, fallbackCalendarName: string): CalendarEvent {
	const calendarName =
		(event?.calendar && getCalendarTitle(event.calendar)) ||
		String(event?.calendarTitle ?? event?.calendarName ?? "") ||
		fallbackCalendarName;

	const urlValue = event?.url ?? event?.URL ?? null;
	const url = urlValue ? String(urlValue) : null;

	return {
		id: String(
			event?.identifier ??
				event?.id ??
				event?.eventIdentifier ??
				`unknown-${Date.now()}`,
		),
		title: String(event?.title ?? event?.summary ?? event?.name ?? "Untitled Event"),
		location: event?.location ? String(event.location) : null,
		notes: event?.notes ? String(event.notes) : null,
		startDate: normalizeEventDate(event?.startDate ?? event?.start),
		endDate: normalizeEventDate(event?.endDate ?? event?.end),
		calendarName: calendarName || "Calendar",
		isAllDay: Boolean(event?.isAllDay ?? event?.allDay ?? false),
		url,
	};
}

async function listCalendars(): Promise<string[]> {
	try {
		const lock = getCalendarLock();
		const ek = await ensureCalendarAccess();
		logCalendar("listCalendars start");
		const { incomingCalendar, outgoingCalendar } = resolveLockedCalendars(ek, lock);
		const names = Array.from(
			new Set(
				[incomingCalendar, outgoingCalendar]
					.map((calendar) => getCalendarTitle(calendar))
					.filter((name) => name.length > 0),
			),
		);
		logCalendar("listCalendars result", { count: names.length });
		return names;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`Error listing calendars: ${message}`);
		logCalendar("listCalendars error", { error: message });
		if (isCalendarLockError(message)) {
			throw new Error(message);
		}
		return [];
	}
}

async function getEvents(
	limit = 10,
	fromDate?: string,
	toDate?: string,
	calendarName?: string,
): Promise<CalendarEvent[]> {
	console.error("getEvents - Starting to fetch calendar events");
	try {
		const lock = getCalendarLock();
		const ek = await ensureCalendarAccess();
		console.error("getEvents - Calendar access check passed");

		const normalizedFromDate = normalizeDateInput(fromDate, "fromDate");
		const normalizedToDate = normalizeDateInput(toDate, "toDate");

		const today = new Date();
		const defaultEndDate = new Date();
		defaultEndDate.setDate(today.getDate() + 7);

		const startDateInput =
			normalizedFromDate ?? today.toISOString().split("T")[0];
		const endDateInput =
			normalizedToDate ?? defaultEndDate.toISOString().split("T")[0];

		const startDate = parseDateInput(startDateInput, "fromDate");
		const endDateRaw = parseDateInput(endDateInput, "toDate");
		const endDate = DATE_ONLY.test(endDateInput)
			? endOfDay(endDateRaw)
			: endDateRaw;

		const safeLimit = Math.min(CONFIG.MAX_EVENTS, Math.max(1, Math.floor(limit)));
		const { incomingCalendar, outgoingCalendar } = resolveLockedCalendars(ek, lock);

		let targetCalendars = [incomingCalendar, outgoingCalendar];
		if (calendarName) {
			const nameLower = calendarName.trim().toLowerCase();
			if (!lock.allowedLower.has(nameLower)) {
				throw new Error(
					`Calendar "${calendarName}" is not allowed. Allowed calendars: "${lock.incoming}", "${lock.outgoing}".`,
				);
			}
			targetCalendars = [
				nameLower === lock.outgoing.toLowerCase()
					? outgoingCalendar
					: incomingCalendar,
			];
		}

		const calendarIds = Array.from(
			new Set(
				targetCalendars
					.map((calendar: any) => getCalendarId(calendar))
					.filter(Boolean),
			),
		);
		if (calendarIds.length === 0) {
			throw new Error(
				`Unable to resolve calendar identifiers for "${lock.incoming}" and "${lock.outgoing}".`,
			);
		}
		const calendarNames = Array.from(
			new Set(
				targetCalendars
					.map((calendar: any) => getCalendarTitle(calendar))
					.filter((name: string) => name.length > 0),
			),
		);

		logCalendar("getEvents start", {
			limit: safeLimit,
			fromDate: startDate.toISOString(),
			toDate: endDate.toISOString(),
			calendarNames,
		});

		const predicate = ek.createEventPredicate(
			startDate,
			endDate,
			calendarIds.length > 0 ? calendarIds : undefined,
		);

		const rawEvents = ek.getEventsWithPredicate(predicate) ?? [];
		const events = rawEvents
			.map((event: any) =>
				mapEvent(event, calendarNames[0] ?? "Calendar"),
			)
			.filter((event: CalendarEvent) => event.startDate && event.endDate)
			.sort((a: CalendarEvent, b: CalendarEvent) =>
				(a.startDate ?? "").localeCompare(b.startDate ?? ""),
			)
			.slice(0, safeLimit);

		logCalendar("getEvents result", { count: events.length });
		return events;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`Error getting events: ${message}`);
		logCalendar("getEvents error", { error: message });
		if (isCalendarLockError(message)) {
			throw new Error(message);
		}
		if (
			message.includes("fromDate") ||
			message.includes("toDate") ||
			message.includes("ISO 8601")
		) {
			throw error;
		}
		return [];
	}
}

async function searchEvents(
	searchText: string,
	limit = 10,
	fromDate?: string,
	toDate?: string,
	calendarName?: string,
): Promise<CalendarEvent[]> {
	const trimmed = searchText.trim();
	const safeLimit = Math.min(CONFIG.MAX_EVENTS, Math.max(1, Math.floor(limit)));
	const events = await getEvents(CONFIG.MAX_EVENTS, fromDate, toDate, calendarName);

	if (!trimmed) {
		logCalendar("searchEvents result", {
			searchText: "",
			total: events.length,
			matched: Math.min(events.length, safeLimit),
		});
		return events.slice(0, safeLimit);
	}

	const query = trimmed.toLowerCase();
	const filtered = events
		.filter((event) => {
			const haystack = [event.title, event.location, event.notes]
				.filter((value): value is string => Boolean(value && value.trim()))
				.join("\n")
				.toLowerCase();
			return haystack.includes(query);
		})
		.slice(0, safeLimit);

	logCalendar("searchEvents result", {
		searchText: trimmed,
		total: events.length,
		matched: filtered.length,
	});
	return filtered;
}

async function createEvent(
	title: string,
	startDate: string,
	endDate: string,
	location?: string,
	notes?: string,
	isAllDay = false,
	calendarName?: string,
): Promise<{
	success: boolean;
	message: string;
	eventId?: string;
	startDate?: string;
	endDate?: string;
}> {
	try {
		const lock = getCalendarLock();
		const ek = await ensureCalendarAccess();

		if (!title.trim()) {
			return { success: false, message: "Event title cannot be empty" };
		}

		const normalizedStartDate = normalizeDateInput(startDate, "startDate");
		const normalizedEndDate = normalizeDateInput(endDate, "endDate");
		if (!normalizedStartDate || !normalizedEndDate) {
			return { success: false, message: "Start date and end date are required" };
		}

		const start = parseDateInput(normalizedStartDate, "startDate");
		const end = parseDateInput(normalizedEndDate, "endDate");
		if (end <= start) {
			return { success: false, message: "End date must be after start date" };
		}

		const { outgoingCalendar } = resolveLockedCalendars(ek, lock);
		const outgoingLower = lock.outgoing.toLowerCase();

		if (calendarName) {
			const nameLower = calendarName.trim().toLowerCase();
			if (nameLower !== outgoingLower) {
				return {
					success: false,
					message: `Calendar "${calendarName}" is not writable. Use outgoing calendar "${lock.outgoing}".`,
				};
			}
		}

		const targetCalendar = outgoingCalendar;

		const calendarId = targetCalendar ? getCalendarId(targetCalendar) : "";

		console.error(`createEvent - Attempting to create event: "${title}"`);
		logCalendar("createEvent start", {
			title,
			startDate: normalizedStartDate,
			endDate: normalizedEndDate,
			calendarName: targetCalendar ? getCalendarTitle(targetCalendar) : undefined,
		});

		const eventData: any = {
			title,
			startDate: start,
			endDate: end,
			isAllDay: Boolean(isAllDay),
		};

		if (location) eventData.location = location;
		if (notes) eventData.notes = notes;
		if (calendarId) {
			eventData.calendarIdentifier = calendarId;
			eventData.calendarId = calendarId;
			eventData.calendar = targetCalendar;
		}

		const saved = await Promise.resolve(ek.saveEvent(eventData, undefined, true));
		const eventId =
			typeof saved === "string"
				? saved
				: saved?.id ?? saved?.identifier ?? eventData.identifier ?? undefined;

		logCalendar("createEvent result", { success: true, eventId });
		return {
			success: true,
			message: `Event "${title}" created successfully.`,
			eventId,
			startDate: start.toISOString(),
			endDate: end.toISOString(),
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logCalendar("createEvent error", { error: message });
		return {
			success: false,
			message: `Error creating event: ${message}`,
		};
	}
}

async function openEvent(
	eventId: string,
): Promise<{ success: boolean; message: string }> {
	try {
		const lock = getCalendarLock();
		const ek = await ensureCalendarAccess();
		console.error(`openEvent - Attempting to open event with ID: ${eventId}`);
		logCalendar("openEvent start", { eventId });

		const event = ek.getEvent(eventId);
		if (!event) {
			logCalendar("openEvent result", { success: false, eventId });
			return { success: false, message: "Event not found" };
		}

		const { incomingCalendar, outgoingCalendar } = resolveLockedCalendars(ek, lock);
		const allowedIds = new Set(
			[
				getCalendarId(incomingCalendar),
				getCalendarId(outgoingCalendar),
			].filter(Boolean),
		);
		const eventCalendarId =
			getCalendarId(event?.calendar) ||
			String(event?.calendarIdentifier ?? event?.calendarId ?? "");
		const eventCalendarName = getEventCalendarName(event);
		const allowedById =
			eventCalendarId.length > 0 && allowedIds.has(eventCalendarId);
		const allowedByName =
			eventCalendarName.length > 0 &&
			lock.allowedLower.has(eventCalendarName.toLowerCase());

		if (!allowedById && !allowedByName) {
			logCalendar("openEvent denied", { eventId });
			return {
				success: false,
				message: `Event is not in allowed calendars ("${lock.incoming}", "${lock.outgoing}").`,
			};
		}

		logCalendar("openEvent result", { success: true, eventId });
		return { success: true, message: "Event found" };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logCalendar("openEvent error", { error: message });
		return { success: false, message: `Error opening event: ${message}` };
	}
}

async function deleteEvent(
	eventId: string,
	calendarName?: string,
): Promise<{
	success: boolean;
	message: string;
	deletedEventId?: string;
	deletedFromCalendar?: string;
}> {
	try {
		const trimmedEventId = String(eventId ?? "").trim();
		if (!trimmedEventId) {
			return { success: false, message: "eventId is required for delete operation" };
		}

		const lock = getCalendarLock();
		const ek = await ensureCalendarAccess();
		const { outgoingCalendar } = resolveLockedCalendars(ek, lock);
		const outgoingLower = lock.outgoing.toLowerCase();

		if (calendarName) {
			const requested = calendarName.trim().toLowerCase();
			if (requested && requested !== outgoingLower) {
				return {
					success: false,
					message: `Calendar "${calendarName}" is not writable. Use outgoing calendar "${lock.outgoing}".`,
				};
			}
		}

		logCalendar("deleteEvent start", {
			eventId: trimmedEventId,
			calendarName: lock.outgoing,
		});

		const event = ek.getEvent(trimmedEventId);
		if (!event) {
			logCalendar("deleteEvent result", { success: false, eventId: trimmedEventId });
			return { success: false, message: "Event not found" };
		}

		const eventCalendarName = getEventCalendarName(event);
		const outgoingCalendarId = getCalendarId(outgoingCalendar);
		const eventCalendarId =
			getCalendarId(event?.calendar) ||
			String(event?.calendarIdentifier ?? event?.calendarId ?? "");
		const isOutgoingById =
			eventCalendarId.length > 0 &&
			outgoingCalendarId.length > 0 &&
			eventCalendarId === outgoingCalendarId;
		const isOutgoingByName =
			eventCalendarName.length > 0 &&
			eventCalendarName.toLowerCase() === outgoingLower;
		if (!isOutgoingById && !isOutgoingByName) {
			logCalendar("deleteEvent denied", {
				eventId: trimmedEventId,
				eventCalendarName,
			});
			return {
				success: false,
				message: `Event is not in writable calendar "${lock.outgoing}".`,
			};
		}

		const removed = await Promise.resolve(
			ek.removeEvent(trimmedEventId, "thisEvent", true),
		);
		if (!removed) {
			logCalendar("deleteEvent result", {
				success: false,
				eventId: trimmedEventId,
				reason: "removeEvent returned false",
			});
			return { success: false, message: "Failed to delete event" };
		}

		const deletedFromCalendar = eventCalendarName || lock.outgoing;
		logCalendar("deleteEvent result", {
			success: true,
			eventId: trimmedEventId,
			deletedFromCalendar,
		});
		return {
			success: true,
			message: "Event deleted successfully.",
			deletedEventId: trimmedEventId,
			deletedFromCalendar,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logCalendar("deleteEvent error", { error: message });
		return {
			success: false,
			message: message,
		};
	}
}

const calendar = {
	searchEvents,
	openEvent,
	getEvents,
	listCalendars,
	createEvent,
	deleteEvent,
};

export default calendar;
