#!/usr/bin/env node
import { runQuery } from "../commands/query.js";

runQuery(process.argv).catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
