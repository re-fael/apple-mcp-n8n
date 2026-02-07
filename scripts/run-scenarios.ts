import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { scenarios, type Scenario, type Step } from "../tests/scenarios.js";

type StepResult = {
  scenario: string;
  step: string;
  status: "passed" | "failed" | "skipped";
  message?: string;
};

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

async function callWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
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

async function runScenario(client: Client, scenario: Scenario): Promise<StepResult[]> {
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
      const call = client.callTool({
        name: step.tool,
        arguments: step.args,
      });

      const result = await callWithTimeout(call, step.timeoutMs ?? 15000);

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
      const canSkip =
        step.onError === "skip" ||
        (step.onError !== "fail" && isAccessError(message));

      results.push({
        scenario: scenario.name,
        step: step.name,
        status: canSkip ? "skipped" : "failed",
        message,
      });

      if (!canSkip) {
        break;
      }
    }
  }

  return results;
}

async function run() {
  const command = process.env.MCP_SERVER_COMMAND || "bun";
  const args =
    process.env.MCP_SERVER_ARGS?.split(" ").filter(Boolean) ?? [
      "run",
      "index.ts",
    ];

  const transport = new StdioClientTransport({ command, args });
  const client = new Client(
    { name: "scenario-runner", version: "0.1.0" },
    { capabilities: {} },
  );

  await client.connect(transport);

  const allResults: StepResult[] = [];

  for (const scenario of scenarios) {
    const results = await runScenario(client, scenario);
    allResults.push(...results);
  }

  await client.close();

  const passed = allResults.filter((r) => r.status === "passed").length;
  const failed = allResults.filter((r) => r.status === "failed").length;
  const skipped = allResults.filter((r) => r.status === "skipped").length;

  console.log("Scenario run complete");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Skipped: ${skipped}`);

  if (failed > 0) {
    const failures = allResults.filter((r) => r.status === "failed");
    for (const failure of failures) {
      console.log(
        `[FAIL] ${failure.scenario} :: ${failure.step} - ${failure.message}`,
      );
    }
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
