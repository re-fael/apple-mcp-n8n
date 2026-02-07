import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const LOG_FILE =
	process.env.APPLE_MCP_CALENDAR_LOG_FILE ||
	path.join(os.homedir(), "apple-mcp.out.log");

function formatValue(value: unknown): string {
	if (value === null || value === undefined) return "null";
	if (typeof value === "string") {
		const trimmed = value.length > 200 ? `${value.slice(0, 200)}…` : value;
		return `"${trimmed}"`;
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	if (Array.isArray(value)) {
		const items = value.slice(0, 10).map((item) => formatValue(item));
		const extra = value.length > 10 ? `, …(+${value.length - 10} more)` : "";
		return `[${items.join(", ")}${extra}]`;
	}
	try {
		const json = JSON.stringify(value);
		return json.length > 200 ? `${json.slice(0, 200)}…` : json;
	} catch {
		return "[unserializable]";
	}
}

function formatData(data?: Record<string, unknown>): string {
	if (!data || Object.keys(data).length === 0) return "";
	const parts = Object.entries(data).map(([key, value]) => {
		return `${key}=${formatValue(value)}`;
	});
	return ` | ${parts.join(" ")}`;
}

async function writeLine(line: string): Promise<void> {
	try {
		await fs.appendFile(LOG_FILE, `${line}\n`, "utf8");
	} catch (error) {
		console.error(
			`Calendar logger failed to write to ${LOG_FILE}: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}
}

export function logCalendar(message: string, data?: Record<string, unknown>) {
	const timestamp = new Date().toISOString();
	const line = `${timestamp} [calendar] ${message}${formatData(data)}`;
	void writeLine(line);
}
