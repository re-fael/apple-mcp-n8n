type JsonRpcResponse = {
	result?: any;
	error?: { message?: string };
};

function extractText(result: any): string {
	const content = Array.isArray(result?.content) ? result.content : [];
	return content
		.filter((item: any) => item?.type === "text" && typeof item?.text === "string")
		.map((item: any) => String(item.text))
		.join("\n");
}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) {
		throw new Error(message);
	}
}

function toStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === "string");
}

function sortedUnique(values: string[]): string[] {
	return Array.from(new Set(values)).sort();
}

function getOperationConstsFromOneOf(inputSchema: any): string[] {
	const oneOf = inputSchema?.oneOf;
	if (!Array.isArray(oneOf)) return [];

	return oneOf
		.map((branch: any) => {
			const operationConst = branch?.properties?.operation?.const;
			return typeof operationConst === "string" ? operationConst : null;
		})
		.filter((value: unknown): value is string => typeof value === "string");
}

function getOneOfTypes(inputSchema: any): string[] {
	const oneOf = inputSchema?.oneOf;
	if (!Array.isArray(oneOf)) return [];

	return oneOf
		.map((branch: any) => (typeof branch?.type === "string" ? branch.type : null))
		.filter((value: unknown): value is string => typeof value === "string");
}

async function postJson(url: string, payload: Record<string, unknown>): Promise<JsonRpcResponse> {
	const response = await fetch(url, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			accept: "application/json, text/event-stream",
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const body = await response.text().catch(() => "");
		throw new Error(`HTTP ${response.status}: ${body}`);
	}

	const text = await response.text();
	if (!text.trim()) return {};
	return JSON.parse(text) as JsonRpcResponse;
}

async function callTool(url: string, id: number, name: string, args: Record<string, unknown>) {
	const rpc = await postJson(url, {
		jsonrpc: "2.0",
		id,
		method: "tools/call",
		params: { name, arguments: args },
	});
	if (rpc.error) {
		throw new Error(rpc.error.message || "Unknown tools/call error");
	}
	return rpc.result;
}

async function callMethod(
	url: string,
	id: number,
	method: string,
	params: Record<string, unknown> = {},
) {
	const rpc = await postJson(url, {
		jsonrpc: "2.0",
		id,
		method,
		params,
	});
	if (rpc.error) {
		throw new Error(rpc.error.message || `${method} failed`);
	}
	return rpc.result;
}

async function run(): Promise<void> {
	const url = process.env.MCP_HTTP_URL ?? "http://127.0.0.1:8787/mcp";
	const allowWriteProbe = process.env.CALENDAR_HTTP_ALLOW_WRITE === "1";

	console.log(`Calendar HTTP validation target: ${url}`);

	const initResult = await postJson(url, {
		jsonrpc: "2.0",
		id: 1,
		method: "initialize",
		params: {
			protocolVersion: "2024-11-05",
			capabilities: { tools: {} },
			clientInfo: { name: "calendar-http-test", version: "1.0.0" },
		},
	});
	if (initResult.error) {
		throw new Error(initResult.error.message || "initialize failed");
	}
	await postJson(url, {
		jsonrpc: "2.0",
		method: "notifications/initialized",
		params: {},
	});

	const toolsResult = await callMethod(url, 2, "tools/list");
	const tools = Array.isArray(toolsResult?.tools) ? toolsResult.tools : [];
	const calendarTool = tools.find((tool: any) => tool?.name === "calendar");
	assert(Boolean(calendarTool), "tools/list does not expose calendar tool.");
	const operationEnum = toStringArray(
		calendarTool?.inputSchema?.properties?.operation?.enum,
	);
	assert(
		operationEnum.length > 0,
		"Calendar tool operation enum is missing from tools/list inputSchema.",
	);
	const requiredReadOps = ["search", "open", "list", "listCalendars"];
	for (const op of requiredReadOps) {
		assert(
			operationEnum.includes(op),
			`Calendar tool operation "${op}" missing from tools/list exposure.`,
		);
	}
	const createExposed = operationEnum.includes("create");
	console.log(`tools/list calendar operations: ${operationEnum.join(", ")}`);
	assert(
		Array.isArray(calendarTool?.inputSchema?.oneOf),
		"Calendar inputSchema.oneOf is missing from tools/list exposure.",
	);
	const oneOfOperations = getOperationConstsFromOneOf(calendarTool?.inputSchema);
	const oneOfTypes = getOneOfTypes(calendarTool?.inputSchema);
	assert(
		oneOfOperations.length > 0,
		"Calendar inputSchema.oneOf operation branches are missing.",
	);
	assert(
		oneOfTypes.length === oneOfOperations.length,
		"Calendar inputSchema.oneOf branches must declare explicit object type.",
	);
	assert(
		oneOfTypes.every((type) => type === "object"),
		'Calendar inputSchema.oneOf branches must have type="object".',
	);
	assert(
		JSON.stringify(sortedUnique(oneOfOperations)) ===
			JSON.stringify(sortedUnique(operationEnum)),
		"Calendar inputSchema.oneOf operation branches are not aligned with operation enum.",
	);
	assert(
		calendarTool?.outputSchema && typeof calendarTool.outputSchema === "object",
		"Calendar outputSchema is missing from tools/list exposure.",
	);
	const outputOperationEnum = toStringArray(
		calendarTool?.outputSchema?.properties?.operation?.enum,
	);
	assert(
		outputOperationEnum.length > 0,
		"Calendar outputSchema operation enum is missing.",
	);
	assert(
		JSON.stringify(sortedUnique(outputOperationEnum)) ===
			JSON.stringify(sortedUnique(operationEnum)),
		"Calendar outputSchema operation enum is not aligned with input operation enum.",
	);

	const listCalendars = await callTool(url, 3, "calendar", {
		operation: "listCalendars",
	});
	assert(!listCalendars?.isError, `listCalendars failed: ${extractText(listCalendars)}`);
	const calendars = Array.isArray(listCalendars?.calendars) ? listCalendars.calendars : [];
	assert(calendars.length > 0, "listCalendars returned no locked calendars.");
	assert(
		typeof listCalendars?.calendarsCount === "number",
		"listCalendars response is missing calendarsCount.",
	);
	assert(
		listCalendars.calendarsCount === calendars.length,
		"listCalendars calendarsCount does not match calendars.length.",
	);
	assert(listCalendars?.operation === "listCalendars", "listCalendars.operation mismatch.");
	assert(listCalendars?.ok === true, "listCalendars.ok should be true.");
	console.log(`Locked calendars visible: ${calendars.join(", ")}`);

	const disallowedList = await callTool(url, 4, "calendar", {
		operation: "list",
		calendarName: "__NOT_ALLOWED_CALENDAR__",
		limit: 2,
	});
	assert(
		disallowedList?.isError === true,
		"Expected calendar.list with disallowed calendarName to return isError=true.",
	);
	assert(
		extractText(disallowedList).toLowerCase().includes("not allowed"),
		'Expected "not allowed" error text for disallowed calendarName in calendar.list.',
	);
	assert(disallowedList?.operation === "list", "disallowed list should include operation=list.");
	assert(disallowedList?.ok === false, "disallowed list should include ok=false.");

	const disallowedCreate = await callTool(url, 5, "calendar", {
		operation: "create",
		title: `Policy probe ${Date.now()}`,
		startDate: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
		endDate: new Date(Date.now() + 75 * 60 * 1000).toISOString(),
		calendarName: "__NON_WRITABLE_CALENDAR__",
	});
	assert(
		disallowedCreate?.isError === true,
		"Expected blocked calendar.create probe to return isError=true.",
	);
	const createErrorText = extractText(disallowedCreate).toLowerCase();
	if (createExposed) {
		assert(
			createErrorText.includes("not writable"),
			'Expected "not writable" error text for blocked calendar.create.',
		);
	} else {
		assert(
			createErrorText.includes("disabled") || createErrorText.includes("blocked"),
			'Expected policy block text ("disabled"/"blocked") when create is not exposed.',
		);
	}
	assert(
		disallowedCreate?.operation === "create",
		"disallowed create should include operation=create.",
	);
	assert(disallowedCreate?.ok === false, "disallowed create should include ok=false.");

	const defaultList = await callTool(url, 6, "calendar", {
		operation: "list",
		limit: 3,
	});
	assert(!defaultList?.isError, `calendar.list failed: ${extractText(defaultList)}`);
	assert(Array.isArray(defaultList?.events), "calendar.list response is missing events array.");
	assert(
		typeof defaultList?.eventsCount === "number",
		"calendar.list response is missing eventsCount.",
	);
	assert(
		defaultList.eventsCount === defaultList.events.length,
		"calendar.list eventsCount does not match events.length.",
	);
	assert(defaultList?.operation === "list", "calendar.list.operation mismatch.");
	assert(defaultList?.ok === true, "calendar.list.ok should be true.");
	for (const event of defaultList.events) {
		assert(typeof event?.id === "string" && event.id.length > 0, "calendar.list event.id is missing.");
		assert(
			typeof event?.title === "string" && event.title.length > 0,
			"calendar.list event.title is missing.",
		);
		assert(
			typeof event?.calendarName === "string" && event.calendarName.length > 0,
			"calendar.list event.calendarName is missing.",
		);
		assert(
			typeof event?.startDate === "string" && typeof event?.endDate === "string",
			"calendar.list event startDate/endDate should be ISO strings.",
		);
		assert(
			typeof event?.isAllDay === "boolean",
			"calendar.list event.isAllDay should be boolean.",
		);
	}
	console.log(`calendar.list succeeded, eventsCount=${defaultList?.eventsCount ?? "n/a"}`);

	const searchProbe = await callTool(url, 7, "calendar", {
		operation: "search",
		searchText: "",
		limit: 2,
	});
	assert(!searchProbe?.isError, `calendar.search failed: ${extractText(searchProbe)}`);
	assert(
		Array.isArray(searchProbe?.events),
		"calendar.search response is missing events array.",
	);
	assert(
		typeof searchProbe?.eventsCount === "number",
		"calendar.search response is missing eventsCount.",
	);
	assert(searchProbe?.operation === "search", "calendar.search.operation mismatch.");
	assert(searchProbe?.ok === true, "calendar.search.ok should be true.");
	console.log(`calendar.search succeeded, eventsCount=${searchProbe.eventsCount}`);

	if (defaultList.events.length > 0) {
		const openProbe = await callTool(url, 8, "calendar", {
			operation: "open",
			eventId: String(defaultList.events[0].id),
		});
		assert(!openProbe?.isError, `calendar.open failed: ${extractText(openProbe)}`);
		assert(openProbe?.operation === "open", "calendar.open.operation mismatch.");
		assert(openProbe?.ok === true, "calendar.open.ok should be true.");
	} else {
		console.log("Skipping calendar.open probe (no events returned by calendar.list).");
	}

	if (allowWriteProbe && createExposed) {
		const outgoingCalendar =
			typeof calendars[calendars.length - 1] === "string"
				? calendars[calendars.length - 1]
				: undefined;
		assert(Boolean(outgoingCalendar), "No outgoing calendar available for write probe.");
		const writeResult = await callTool(url, 9, "calendar", {
			operation: "create",
			title: `Calendar write probe ${Date.now()}`,
			startDate: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
			endDate: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
			calendarName: outgoingCalendar,
		});
		assert(!writeResult?.isError, `Outgoing create probe failed: ${extractText(writeResult)}`);
		assert(writeResult?.event, "calendar.create response is missing event object.");
		assert(writeResult?.operation === "create", "calendar.create.operation mismatch.");
		assert(writeResult?.ok === true, "calendar.create.ok should be true.");
		assert(
			typeof writeResult.event?.id === "string" && writeResult.event.id.length > 0,
			"calendar.create response event.id is missing.",
		);
		console.log(`calendar.create write probe succeeded on "${outgoingCalendar}".`);
	} else if (allowWriteProbe && !createExposed) {
		console.log(
			"Skipping outgoing calendar write probe because create is hidden by tool policy.",
		);
	} else {
		console.log("Skipping outgoing calendar write probe (set CALENDAR_HTTP_ALLOW_WRITE=1 to enable).");
	}

	console.log("Calendar HTTP validation passed.");
}

run().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
