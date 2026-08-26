import { advanceBackupRun } from "../server/backupWorkflow.ts";

const result = await advanceBackupRun("manual-validation");
console.log(JSON.stringify(result, null, 2));
process.exit(0);
