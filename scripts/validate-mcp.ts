import { scenarios, type Scenario, type Step } from "../tests/scenarios.js";

type StepResult = {
  scenario: string;
  step: string;
  status: "passed" | "failed" | "skipped";
  message?: string;
};

type Options = {
  url: string;
  scenarioFilter?: string;
  failFast: boolean;
  listScenarios: boolean;
  timeoutMultiplier: number;
  skipTimeouts: boolean;
};

const ANSI = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
};

function color(text: string, tint: keyof typeof ANSI): string {
  if (!process.stdout.isTTY || process.env.NO_COLOR) return text;
  return `${ANSI[tint]}${text}${ANSI.reset}`;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    url: process.env.MCP_HTTP_URL ?? "http://127.0.0.1:8787/mcp",
    failFast: false,
    listScenarios: false,
    timeoutMultiplier: Number(process.env.MCP_TIMEOUT_MULTIPLIER ?? "1") || 1,
    skipTimeouts: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--url") {
      options.url = argv[++i] ?? options.url;
    } else if (arg === "--scenario") {
      options.scenarioFilter = argv[++i];
    } else if (arg === "--fail-fast") {
      options.failFast = true;
    } else if (arg === "--list") {
      options.listScenarios = true;
    } else if (arg === "--timeout-multiplier") {
      options.timeoutMultiplier = Number(argv[++i] ?? "1") || 1;
    } else if (arg === "--skip-timeouts") {
      options.skipTimeouts = true;
    }
  }

  return options;
}

function extractText(result: any): string {
  const content = Array.isArray(result?.content) ? result.content : [];
  return content
    .filter((item: any) => item?.type === "text" && typeof item.text === "string")
    .map((item: any) => item.text)
    .join("\n");
}

function isAccessError(message: string): boolean {
  const lowered = message.toLowerCase();
  return (
    lowered.includes("access") ||
    lowered.includes("permission") ||
    lowered.includes("privacy") ||
    lowered.includes("automation")
  );
}

async function callWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);
}

function assertStep(step: Step, result: any) {
  const text = extractText(result);

  if (step.expect?.isError !== undefined) {
    const isError = Boolean(result?.isError);
    if (isError !== step.expect.isError) {
      throw new Error(`Expected isError=${step.expect.isError}, got ${isError}`);
    }
  }

  if (step.expect?.textIncludes) {
    for (const chunk of step.expect.textIncludes) {
      if (!text.includes(chunk)) {
        throw new Error(`Expected text to include "${chunk}". Got: ${text}`);
      }
    }
  }

  if (step.expect?.textRegex && !step.expect.textRegex.test(text)) {
    throw new Error(`Expected text to match ${step.expect.textRegex}. Got: ${text}`);
  }
}

type McpClient = {
  connect: () => Promise<void>;
  close: () => Promise<void>;
  callTool: (name: string, args: Record<string, unknown>) => Promise<any>;
  listTools: () => Promise<any>;
};

function createHttpClient(options: Options): McpClient {
  let nextId = 1;
  const url = options.url;

  async function post(message: any): Promise<any | undefined> {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    const text = await response.text().catch(() => "");
    if (!text) return undefined;
    return JSON.parse(text);
  }

  async function request(method: string, params?: Record<string, unknown>) {
    const id = nextId++;
    const response = await post({ jsonrpc: "2.0", id, method, params });
    if (!response) {
      throw new Error("Empty response");
    }
    if (response.error) {
      throw new Error(response.error.message || "Unknown error");
    }
    return response.result;
  }

  async function notify(method: string, params?: Record<string, unknown>) {
    await post({ jsonrpc: "2.0", method, params });
  }

  return {
    connect: async () => {
      await request("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        clientInfo: { name: "validate-mcp", version: "0.1.0" },
      });
      await notify("notifications/initialized", {});
    },
    close: async () => {},
    callTool: (name, args) =>
      request("tools/call", { name, arguments: args }),
    listTools: () => request("tools/list", {}),
  };
}

async function runScenario(
  client: McpClient,
  scenario: Scenario,
  options: Options,
): Promise<StepResult[]> {
  const results: StepResult[] = [];

  for (const step of scenario.steps) {
    if (step.requiresEnv && process.env[step.requiresEnv] !== "true") {
      results.push({
        scenario: scenario.name,
        step: step.name,
        status: "skipped",
        message: `Skipped (set ${step.requiresEnv}=true to enable)`,
      });
      continue;
    }

    try {
      const call = client.callTool(step.tool, step.args);
      const timeoutMs = Math.max(
        1000,
        Math.round((step.timeoutMs ?? 15000) * options.timeoutMultiplier),
      );
      const result = await callWithTimeout(call, timeoutMs);

      if (result?.isError) {
        throw new Error(extractText(result) || "Tool returned isError=true");
      }

      assertStep(step, result);

      results.push({
        scenario: scenario.name,
        step: step.name,
        status: "passed",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isTimeout = message.toLowerCase().includes("timeout after");
      const canSkip =
        step.onError === "skip" ||
        (step.onError !== "fail" && isAccessError(message)) ||
        (options.skipTimeouts && isTimeout);

      results.push({
        scenario: scenario.name,
        step: step.name,
        status: canSkip ? "skipped" : "failed",
        message,
      });

      if (!canSkip && options.failFast) {
        break;
      }
    }
  }

  return results;
}

async function run() {
  const options = parseArgs(process.argv.slice(2));

  if (options.listScenarios) {
    for (const scenario of scenarios) {
      console.log(scenario.name);
    }
    return;
  }

  const filteredScenarios = options.scenarioFilter
    ? scenarios.filter((scenario) =>
        scenario.name
          .toLowerCase()
          .includes(options.scenarioFilter!.toLowerCase()),
      )
    : scenarios;

  if (filteredScenarios.length === 0) {
    console.error(
      `No scenarios matched "${options.scenarioFilter ?? ""}". Use --list.`,
    );
    process.exit(1);
  }

  console.log(
    `Running ${filteredScenarios.length} scenarios against ${options.url}`,
  );

  const client = createHttpClient(options);

  await client.connect();

  try {
    const toolsResult = await client.listTools();
    const toolCount = Array.isArray(toolsResult?.tools)
      ? toolsResult.tools.length
      : 0;
    console.log(color(`Tools available: ${toolCount}`, "blue"));
  } catch (error) {
    console.log(
      color(
        `Warning: tools/list failed (${error instanceof Error ? error.message : String(error)})`,
        "yellow",
      ),
    );
  }

  const allResults: StepResult[] = [];

  for (const scenario of filteredScenarios) {
    console.log(color(`Scenario: ${scenario.name}`, "blue"));
    const results = await runScenario(client, scenario, options);
    allResults.push(...results);

    for (const result of results) {
      const status =
        result.status === "passed"
          ? color("OK  ", "green")
          : result.status === "skipped"
            ? color("SKIP", "yellow")
            : color("FAIL", "red");

      const line = `${status} ${result.step}${
        result.message ? ` - ${result.message}` : ""
      }`;
      console.log(line);
    }

    if (options.failFast && results.some((r) => r.status === "failed")) {
      break;
    }
  }

  await client.close();

  const passed = allResults.filter((r) => r.status === "passed").length;
  const failed = allResults.filter((r) => r.status === "failed").length;
  const skipped = allResults.filter((r) => r.status === "skipped").length;

  console.log("Validation complete");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Skipped: ${skipped}`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
