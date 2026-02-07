import http from "node:http";
import contentType from "content-type";
import getRawBody from "raw-body";
import { JSONRPCMessageSchema } from "@modelcontextprotocol/sdk/types.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

const MAXIMUM_MESSAGE_SIZE = "4mb";
const REQUEST_TIMEOUT_MS = 60000;

type PendingResponse = {
	res: http.ServerResponse;
	timeoutId: NodeJS.Timeout;
};

class StreamableHttpTransport implements Transport {
	private pendingResponses = new Map<string, PendingResponse>();

	onclose?: () => void;
	onerror?: (error: Error) => void;
	onmessage?: (message: any) => void;

	async start(): Promise<void> {
		// No-op: HTTP server drives messages.
	}

	async send(message: any): Promise<void> {
		const id =
			typeof message?.id === "number" || typeof message?.id === "string"
				? String(message.id)
				: null;
		if (!id) {
			// No response channel for server-initiated notifications/requests.
			return;
		}

		const pending = this.pendingResponses.get(id);
		if (!pending) return;

		clearTimeout(pending.timeoutId);
		this.pendingResponses.delete(id);

		pending.res.writeHead(200, { "Content-Type": "application/json" });
		pending.res.end(JSON.stringify(message));
	}

	async close(): Promise<void> {
		for (const pending of this.pendingResponses.values()) {
			clearTimeout(pending.timeoutId);
			if (!pending.res.writableEnded) {
				pending.res.writeHead(500).end("Server closed");
			}
		}
		this.pendingResponses.clear();
		this.onclose?.();
	}

	handleIncoming(message: any, res: http.ServerResponse): void {
		const id =
			typeof message?.id === "number" || typeof message?.id === "string"
				? String(message.id)
				: null;

		if (id) {
			const timeoutId = setTimeout(() => {
				if (!res.writableEnded) {
					res.writeHead(504).end("Request timed out");
				}
				this.pendingResponses.delete(id);
			}, REQUEST_TIMEOUT_MS);

			this.pendingResponses.set(id, { res, timeoutId });
		}

		this.onmessage?.(message);
	}
}

function isOriginAllowed(origin: string | undefined, port: number): boolean {
	if (!origin || origin === "null") return true;
	if (process.env.APPLE_MCP_HTTP_ALLOW_ANY_ORIGIN === "1") return true;

	const allowed = process.env.APPLE_MCP_HTTP_ALLOWED_ORIGINS
		?.split(",")
		.map((value) => value.trim())
		.filter(Boolean);
	if (allowed && allowed.length > 0) {
		return allowed.includes(origin);
	}

	const allowedLocalOrigins = new Set([
		`http://localhost`,
		`http://localhost:${port}`,
		`http://127.0.0.1`,
		`http://127.0.0.1:${port}`,
		`http://[::1]`,
		`http://[::1]:${port}`,
	]);
	return allowedLocalOrigins.has(origin);
}

function acceptHeaderSupportsStreamable(accept: string | undefined): boolean {
	if (!accept) return false;
	const lower = accept.toLowerCase();
	return lower.includes("application/json") && lower.includes("text/event-stream");
}

function applyCors(res: http.ServerResponse, origin?: string) {
	if (origin) {
		res.setHeader("Access-Control-Allow-Origin", origin);
		res.setHeader("Vary", "Origin");
	}
	res.setHeader(
		"Access-Control-Allow-Headers",
		"content-type, accept, mcp-session-id",
	);
	res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
}

export async function startStreamableHttpServer(server: Server) {
	const port = Number(process.env.APPLE_MCP_HTTP_PORT ?? "8787");
	const host = process.env.APPLE_MCP_HTTP_HOST ?? "127.0.0.1";
	const endpointPath = process.env.APPLE_MCP_HTTP_PATH ?? "/mcp";

	const transport = new StreamableHttpTransport();
	await server.connect(transport);

	const httpServer = http.createServer(async (req, res) => {
		const origin = req.headers.origin;
		if (!isOriginAllowed(origin, port)) {
			res.writeHead(403).end("Forbidden origin");
			return;
		}

		applyCors(res, origin);

		if (req.method === "OPTIONS") {
			res.writeHead(204).end();
			return;
		}

		const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
		if (url.pathname !== endpointPath) {
			res.writeHead(404).end("Not found");
			return;
		}

		if (req.method === "GET") {
			res.writeHead(405).end("SSE stream not supported at this endpoint");
			return;
		}

		if (req.method !== "POST") {
			res.writeHead(405).end("Method not allowed");
			return;
		}

		if (!acceptHeaderSupportsStreamable(req.headers.accept)) {
			res
				.writeHead(406)
				.end("Accept must include application/json and text/event-stream");
			return;
		}

		let rawBody: string;
		try {
			const ct = contentType.parse(req.headers["content-type"] ?? "");
			if (ct.type !== "application/json") {
				throw new Error(`Unsupported content-type: ${ct.type}`);
			}
			rawBody = await getRawBody(req, {
				limit: MAXIMUM_MESSAGE_SIZE,
				encoding: ct.parameters.charset ?? "utf-8",
			});
		} catch (error) {
			res.writeHead(400).end(String(error));
			return;
		}

		let message: unknown;
		try {
			message = JSON.parse(rawBody);
		} catch (error) {
			res.writeHead(400).end("Invalid JSON body");
			return;
		}

		if (Array.isArray(message)) {
			res.writeHead(400).end("Batch requests are not supported");
			return;
		}

		try {
			message = JSONRPCMessageSchema.parse(message);
		} catch (error) {
			res.writeHead(400).end("Invalid JSON-RPC message");
			return;
		}

		const isRequest = "method" in (message as any) && "id" in (message as any);
		if (!isRequest) {
			transport.handleIncoming(message, res);
			res.writeHead(202).end();
			return;
		}

		transport.handleIncoming(message, res);
	});

	httpServer.listen(port, host, () => {
		console.error(
			`Streamable HTTP MCP server listening on http://${host}:${port}${endpointPath}`,
		);
	});

	return httpServer;
}
