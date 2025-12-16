#!/usr/bin/env node
import { runIngest } from "../commands/ingest.js";
import { runMcpServer } from "../commands/mcp-server.js";
import { runQuery } from "../commands/query.js";

async function main() {
	const [, , subcommand, ...rest] = process.argv;
	if (!subcommand || ["-h", "--help"].includes(subcommand)) {
		printHelp();
		process.exit(subcommand ? 0 : 1);
	}

	const dispatcher: Record<string, (argv: string[]) => Promise<void>> = {
		ingest: runIngest,
		"ingest-docs": runIngest,
		query: runQuery,
		"query-docs": runQuery,
		mcp: runMcpServer,
		"mcp-docs-server": runMcpServer,
	};

	const handler = dispatcher[subcommand];
	if (!handler) {
		console.error(`Unknown subcommand '${subcommand}'.`);
		printHelp();
		process.exit(1);
		return;
	}

	await handler([process.argv[0], process.argv[1], ...rest]);
}

function printHelp() {
	console.log(
		`Usage: docs-mcp <command> [options]\n\nCommands:\n  ingest            Build the local docs index\n  query             Query the persisted index\n  mcp               Run the MCP docs server\n\nExamples:\n  docs-mcp ingest --docs-root ../docs/en:en --persist-dir storage/llamaindex\n  docs-mcp query "How do I customize navigation?" --model raw\n  docs-mcp mcp --persist-dir storage/llamaindex --default-k 6`,
	);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
