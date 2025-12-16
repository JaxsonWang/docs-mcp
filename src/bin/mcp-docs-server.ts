#!/usr/bin/env node
import { runMcpServer } from "../commands/mcp-server.js";

runMcpServer(process.argv).catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
