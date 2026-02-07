#!/usr/bin/env bun
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var bun_1 = require("bun");
var testCommands = {
    "contacts": "bun test tests/integration/contacts-simple.test.ts --preload ./tests/setup.ts",
    "messages": "bun test tests/integration/messages.test.ts --preload ./tests/setup.ts",
    "notes": "bun test tests/integration/notes.test.ts --preload ./tests/setup.ts",
    "mail": "bun test tests/integration/mail.test.ts --preload ./tests/setup.ts",
    "reminders": "bun test tests/integration/reminders.test.ts --preload ./tests/setup.ts",
    "calendar": "bun test tests/integration/calendar.test.ts --preload ./tests/setup.ts",
    "policy": "bun test tests/unit/tool-policy.test.ts",
    "calendar-http": "bun run scripts/test-calendar-http.ts",
    "maps": "bun test tests/integration/maps.test.ts --preload ./tests/setup.ts",
    "mcp": "bun run scripts/test-calendar-http.ts",
    "all": "bun test ./tests --preload ./tests/setup.ts"
};
function runTest(testName) {
    return __awaiter(this, void 0, void 0, function () {
        var command, result, exitCode, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    command = testCommands[testName];
                    if (!command) {
                        console.error("\u274C Unknown test: ".concat(testName));
                        console.log("Available tests:", Object.keys(testCommands).join(", "));
                        process.exit(1);
                    }
                    console.log("\uD83E\uDDEA Running ".concat(testName, " tests..."));
                    console.log("Command: ".concat(command, "\n"));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    result = (0, bun_1.spawn)(command.split(" "), {
                        stdio: ["inherit", "inherit", "inherit"],
                    });
                    return [4 /*yield*/, result.exited];
                case 2:
                    exitCode = _a.sent();
                    if (exitCode === 0) {
                        console.log("\n\u2705 ".concat(testName, " tests completed successfully!"));
                    }
                    else {
                        console.log("\n\u26A0\uFE0F  ".concat(testName, " tests completed with issues (exit code: ").concat(exitCode, ")"));
                    }
                    return [2 /*return*/, exitCode];
                case 3:
                    error_1 = _a.sent();
                    console.error("\n\u274C Error running ".concat(testName, " tests:"), error_1);
                    return [2 /*return*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Get test name from command line arguments
var testName = process.argv[2] || "all";
console.log("🍎 Apple MCP Test Runner");
console.log("=".repeat(50));
runTest(testName).then(function (exitCode) {
    process.exit(exitCode);
});
