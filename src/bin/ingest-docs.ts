#!/usr/bin/env node
import { runIngest } from "../commands/ingest.js";

runIngest(process.argv).catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
