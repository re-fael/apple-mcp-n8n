module.exports = {
  apps: [
    {
      name: "apple-mcp",
      script: "dist/index.js",
      cwd: "/Users/cabrera1/Workbench_offline/mcp/apple-mcp",
      env: {
        APPLE_MCP_TRANSPORT: "http",
        APPLE_MCP_HTTP_PORT: "8787",
        APPLE_MCP_HTTP_HOST: "127.0.0.1",
        APPLE_MCP_HTTP_PATH: "/mcp",
        APPLE_MCP_CALENDAR_INCOMING: "Calendar",
        APPLE_MCP_CALENDAR_OUTGOING: "🤖AKAI",
      },
      autorestart: true,
      watch: false,
    },
  ],
};
