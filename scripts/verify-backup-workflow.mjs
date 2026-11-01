import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const workflow = fs.readFileSync(path.join(projectRoot, "server", "backupWorkflow.ts"), "utf-8");
const entrypoint = fs.readFileSync(path.join(projectRoot, "server", "_core", "index.ts"), "utf-8");

const requiredSnippets = [
  "export async function advanceBackupRun",
  "export async function reconcileStaleBackupRuns",
  "backup_single_active_idx",
  "activeSlot: 1",
  "await sdk.authenticateRequest(req)",
];

for (const snippet of requiredSnippets) {
  const source = snippet.includes("authenticateRequest") ? entrypoint : workflow;
  if (!source.includes(snippet)) {
    throw new Error(`Fluxo incremental incompleto: trecho obrigatório ausente (${snippet}).`);
  }
}

console.log("Backup workflow static verification passed.");
