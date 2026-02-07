import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

const KNOWN_TOOLS = [
	"contacts",
	"notes",
	"messages",
	"mail",
	"reminders",
	"calendar",
	"maps",
] as const;

export type KnownToolName = (typeof KNOWN_TOOLS)[number];
export type AccessMode = "read" | "write";

export type ToolAccessRule = {
	enabled: boolean;
	read: boolean;
	write: boolean;
};

export type ToolAccessConfig = {
	sourcePath: string | null;
	tools: Record<KnownToolName, ToolAccessRule>;
	warnings: string[];
};

type Decision = {
	allowed: boolean;
	mode: AccessMode;
	reason?: string;
};

type IniSections = Record<string, Record<string, string>>;

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

const TOOL_DEFAULT_MODE: Record<KnownToolName, AccessMode> = {
	contacts: "read",
	notes: "read",
	messages: "read",
	mail: "read",
	reminders: "read",
	calendar: "read",
	maps: "read",
};

const TOOL_OPERATION_MODE: Record<KnownToolName, Record<string, AccessMode>> = {
	contacts: {},
	notes: {
		search: "read",
		list: "read",
		create: "write",
	},
	messages: {
		read: "read",
		unread: "read",
		send: "write",
		schedule: "write",
	},
	mail: {
		unread: "read",
		search: "read",
		mailboxes: "read",
		accounts: "read",
		latest: "read",
		send: "write",
	},
	reminders: {
		list: "read",
		search: "read",
		open: "read",
		listById: "read",
		create: "write",
	},
	calendar: {
		search: "read",
		open: "read",
		list: "read",
		listCalendars: "read",
		create: "write",
	},
	maps: {
		search: "read",
		directions: "read",
		listGuides: "read",
		save: "write",
		pin: "write",
		addToGuide: "write",
		createGuide: "write",
	},
};

function createDefaultRules(): Record<KnownToolName, ToolAccessRule> {
	return KNOWN_TOOLS.reduce(
		(acc, tool) => {
			acc[tool] = { enabled: true, read: true, write: true };
			return acc;
		},
		{} as Record<KnownToolName, ToolAccessRule>,
	);
}

function normalizeSectionName(name: string): string {
	return name.trim().toLowerCase();
}

function normalizeKey(name: string): string {
	return name.trim().toLowerCase();
}

function stripMatchingQuotes(value: string): string {
	const trimmed = value.trim();
	if (trimmed.length < 2) return trimmed;
	const first = trimmed[0];
	const last = trimmed[trimmed.length - 1];
	if ((first === `"` && last === `"`) || (first === `'` && last === `'`)) {
		return trimmed.slice(1, -1).trim();
	}
	return trimmed;
}

function parseIni(content: string): IniSections {
	const sections: IniSections = {};
	let currentSection = "default";
	sections[currentSection] = {};

	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith(";") || line.startsWith("#")) continue;

		if (line.startsWith("[") && line.endsWith("]")) {
			currentSection = normalizeSectionName(line.slice(1, -1));
			if (!sections[currentSection]) {
				sections[currentSection] = {};
			}
			continue;
		}

		const separatorIndex = line.indexOf("=");
		const colonIndex = line.indexOf(":");
		let splitAt = separatorIndex;
		if (splitAt < 0 || (colonIndex >= 0 && colonIndex < splitAt)) {
			splitAt = colonIndex;
		}
		if (splitAt < 0) continue;

		const key = normalizeKey(line.slice(0, splitAt));
		const value = stripMatchingQuotes(line.slice(splitAt + 1));
		if (!sections[currentSection]) {
			sections[currentSection] = {};
		}
		sections[currentSection][key] = value;
	}

	return sections;
}

function parseBoolean(value: string): boolean | null {
	const normalized = value.trim().toLowerCase();
	if (TRUE_VALUES.has(normalized)) return true;
	if (FALSE_VALUES.has(normalized)) return false;
	return null;
}

function applyModesFromValue(
	rule: ToolAccessRule,
	rawValue: string,
	context: string,
	warnings: string[],
): void {
	const tokens = rawValue
		.split(",")
		.map((token) => token.trim().toLowerCase())
		.filter(Boolean);

	if (tokens.length === 0) {
		warnings.push(`${context}: modes is empty; expected read/write.`);
		return;
	}

	if (tokens.includes("none")) {
		rule.read = false;
		rule.write = false;
		return;
	}

	const allowed = new Set(["read", "write"]);
	for (const token of tokens) {
		if (!allowed.has(token)) {
			warnings.push(`${context}: unknown mode "${token}" (expected read/write).`);
			return;
		}
	}

	rule.read = tokens.includes("read");
	rule.write = tokens.includes("write");
}

function applySectionRule(
	rule: ToolAccessRule,
	section: Record<string, string>,
	context: string,
	warnings: string[],
): void {
	const modesValue = section.modes ?? section.mode;
	if (typeof modesValue === "string") {
		applyModesFromValue(rule, modesValue, context, warnings);
	}

	for (const key of ["enabled", "read", "write"] as const) {
		if (!(key in section)) continue;
		const parsed = parseBoolean(section[key]);
		if (parsed === null) {
			warnings.push(
				`${context}: ${key} must be boolean (true/false/1/0/yes/no/on/off).`,
			);
			continue;
		}
		rule[key] = parsed;
	}
}

function dedupePaths(paths: string[]): string[] {
	const seen = new Set<string>();
	const output: string[] = [];
	for (const candidate of paths) {
		if (!candidate) continue;
		const resolved = path.resolve(candidate);
		if (seen.has(resolved)) continue;
		seen.add(resolved);
		output.push(resolved);
	}
	return output;
}

function getCandidateConfigPaths(): string[] {
	const explicitPath = process.env.APPLE_MCP_CONFIG_FILE?.trim() ?? "";
	const moduleDir = path.dirname(fileURLToPath(import.meta.url));
	const projectConfigPath = path.resolve(moduleDir, "..", "config.ini");
	const cwdConfigPath = path.resolve(process.cwd(), "config.ini");

	return dedupePaths([explicitPath, cwdConfigPath, projectConfigPath]);
}

function findConfigPath(paths: string[]): string | null {
	for (const candidate of paths) {
		try {
			if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
				return candidate;
			}
		} catch {
			// Ignore inaccessible paths and continue searching.
		}
	}
	return null;
}

function getSectionForTool(
	sections: IniSections,
	tool: KnownToolName,
): Record<string, string> | null {
	const explicit = sections[`tool.${tool}`];
	if (explicit) return explicit;
	return sections[tool] ?? null;
}

export function isKnownToolName(name: string): name is KnownToolName {
	return KNOWN_TOOLS.includes(name as KnownToolName);
}

export function loadToolAccessConfig(): ToolAccessConfig {
	const warnings: string[] = [];
	const rules = createDefaultRules();
	const candidates = getCandidateConfigPaths();
	const configPath = findConfigPath(candidates);

	if (!configPath) {
		if (process.env.APPLE_MCP_CONFIG_FILE) {
			warnings.push(
				`APPLE_MCP_CONFIG_FILE points to "${process.env.APPLE_MCP_CONFIG_FILE}" but no readable file was found.`,
			);
		}
		return { sourcePath: null, tools: rules, warnings };
	}

	let content = "";
	try {
		content = fs.readFileSync(configPath, "utf8");
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		warnings.push(`Failed to read "${configPath}": ${message}`);
		return { sourcePath: configPath, tools: rules, warnings };
	}

	const sections = parseIni(content);
	const defaultSection =
		sections.tools ?? sections["tool.defaults"] ?? sections["tool.default"] ?? null;

	if (defaultSection) {
		for (const tool of KNOWN_TOOLS) {
			applySectionRule(rules[tool], defaultSection, "[tools]", warnings);
		}
	}

	for (const tool of KNOWN_TOOLS) {
		const section = getSectionForTool(sections, tool);
		if (!section) continue;
		applySectionRule(rules[tool], section, `[tool.${tool}]`, warnings);
	}

	return {
		sourcePath: configPath,
		tools: rules,
		warnings,
	};
}

export function getOperationMode(
	toolName: KnownToolName,
	operation?: string,
): AccessMode {
	if (operation) {
		return TOOL_OPERATION_MODE[toolName][operation] ?? TOOL_DEFAULT_MODE[toolName];
	}
	return TOOL_DEFAULT_MODE[toolName];
}

export function getToolAccessDecision(
	config: ToolAccessConfig,
	toolName: KnownToolName,
	operation?: string,
): Decision {
	const rule = config.tools[toolName];
	const mode = getOperationMode(toolName, operation);
	const sourceLabel = config.sourcePath ?? "default policy";

	if (!rule.enabled) {
		return {
			allowed: false,
			mode,
			reason: `Tool "${toolName}" is disabled by ${sourceLabel}.`,
		};
	}

	if (mode === "read" && !rule.read) {
		return {
			allowed: false,
			mode,
			reason: `Read operations are disabled for tool "${toolName}" by ${sourceLabel}.`,
		};
	}

	if (mode === "write" && !rule.write) {
		return {
			allowed: false,
			mode,
			reason: `Write operations are disabled for tool "${toolName}" by ${sourceLabel}.`,
		};
	}

	return { allowed: true, mode };
}

function cloneTool(tool: Tool): Tool {
	return JSON.parse(JSON.stringify(tool)) as Tool;
}

function getOperationEnum(tool: Tool): string[] | null {
	const schema = (tool.inputSchema ?? {}) as {
		properties?: Record<string, { enum?: unknown }>;
	};
	const operation = schema.properties?.operation;
	if (!operation || !Array.isArray(operation.enum)) return null;
	return operation.enum.filter((value): value is string => typeof value === "string");
}

function setOperationEnum(tool: Tool, operations: string[]): void {
	const schema = (tool.inputSchema ?? {}) as {
		properties?: Record<string, { enum?: unknown }>;
	};
	if (!schema.properties?.operation) return;
	schema.properties.operation.enum = operations;
}

function filterInputSchemaOneOf(tool: Tool, allowedOperations: Set<string>): void {
	const schema = (tool.inputSchema ?? {}) as {
		oneOf?: unknown;
	};
	if (!Array.isArray(schema.oneOf)) return;

	schema.oneOf = schema.oneOf.filter((branch) => {
		if (!branch || typeof branch !== "object") return true;
		const operationConst = (
			branch as {
				properties?: Record<string, { const?: unknown }>;
			}
		).properties?.operation?.const;
		if (typeof operationConst !== "string") return true;
		return allowedOperations.has(operationConst);
	});
}

function setOutputOperationEnum(tool: Tool, operations: string[]): void {
	const schema = (tool as Tool & {
		outputSchema?: {
			properties?: Record<string, { enum?: unknown }>;
		};
	}).outputSchema;
	if (!schema?.properties?.operation) return;

	const outputEnum = schema.properties.operation.enum;
	if (!Array.isArray(outputEnum)) return;

	schema.properties.operation.enum = outputEnum.filter(
		(value): value is string =>
			typeof value === "string" && operations.includes(value),
	);
}

export function getConfiguredTools(
	availableTools: Tool[],
	config: ToolAccessConfig,
): Tool[] {
	const configuredTools: Tool[] = [];

	for (const rawTool of availableTools) {
		const tool = cloneTool(rawTool);
		if (!isKnownToolName(tool.name)) {
			configuredTools.push(tool);
			continue;
		}

		const operationEnum = getOperationEnum(tool);
		if (!operationEnum) {
			const decision = getToolAccessDecision(config, tool.name);
			if (!decision.allowed) continue;
			configuredTools.push(tool);
			continue;
		}

		const allowedOperations = operationEnum.filter((operation) =>
			getToolAccessDecision(config, tool.name, operation).allowed,
		);
		if (allowedOperations.length === 0) continue;
		setOperationEnum(tool, allowedOperations);
		filterInputSchemaOneOf(tool, new Set(allowedOperations));
		setOutputOperationEnum(tool, allowedOperations);
		configuredTools.push(tool);
	}

	return configuredTools;
}

export function summarizeToolAccess(config: ToolAccessConfig): string {
	const parts = KNOWN_TOOLS.map((tool) => {
		const rule = config.tools[tool];
		const modes: string[] = [];
		if (rule.read) modes.push("read");
		if (rule.write) modes.push("write");
		if (!rule.enabled || modes.length === 0) return `${tool}=disabled`;
		return `${tool}=${modes.join("+")}`;
	});
	return parts.join(", ");
}
