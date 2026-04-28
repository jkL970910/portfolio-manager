import { config } from "dotenv";
import { existsSync } from "node:fs";

if (existsSync(".env.local")) {
  config({ path: ".env.local", quiet: true });
} else if (existsSync(".env")) {
  config({ path: ".env", quiet: true });
}

const workerId =
  process.env.EXTERNAL_RESEARCH_WORKER_ID ?? `local-worker-${process.pid}`;

async function main() {
  try {
    const { runExternalResearchWorkerOnce } = await import(
      "@/lib/backend/external-research-jobs"
    );
    const result = await runExternalResearchWorkerOnce({ workerId });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "External research worker failed unexpectedly.";
    console.error(message);
    process.exitCode = 1;
  }
}

void main();
