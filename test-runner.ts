#!/usr/bin/env bun

import { spawn } from "bun";

const testCommands = {
  calendar: "bun test tests/integration/calendar.test.ts --preload ./tests/setup.ts",
  policy: "bun test tests/unit/tool-policy.test.ts",
  "calendar-http": "bun run scripts/test-calendar-http.ts",
  mcp: "bun run scripts/test-calendar-http.ts",
  all: "bun test ./tests --preload ./tests/setup.ts",
};

async function runTest(testName: string) {
  const command = testCommands[testName as keyof typeof testCommands];

  if (!command) {
    console.error(`Unknown test: ${testName}`);
    console.log("Available tests:", Object.keys(testCommands).join(", "));
    process.exit(1);
  }

  console.log(`Running ${testName} tests...`);
  console.log(`Command: ${command}\n`);

  try {
    const result = spawn(command.split(" "), {
      stdio: ["inherit", "inherit", "inherit"],
    });

    const exitCode = await result.exited;

    if (exitCode === 0) {
      console.log(`\n${testName} tests completed successfully.`);
    } else {
      console.log(`\n${testName} tests completed with issues (exit code: ${exitCode})`);
    }

    return exitCode;
  } catch (error) {
    console.error(`\nError running ${testName} tests:`, error);
    return 1;
  }
}

const testName = process.argv[2] || "all";
runTest(testName).then((exitCode) => {
  process.exit(exitCode);
});
