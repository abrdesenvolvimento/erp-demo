import { advanceBackupRun, reconcileStaleBackupRuns } from "../server/backupWorkflow.ts";

if (typeof advanceBackupRun !== "function" || typeof reconcileStaleBackupRuns !== "function") {
  throw new Error("Fluxo incremental de backup não foi carregado corretamente.");
}

console.log("Backup workflow module loaded successfully.");
process.exit(0);
