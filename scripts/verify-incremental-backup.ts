import { eq } from "drizzle-orm";
import { backupRuns } from "../drizzle/schema";
import { getDb } from "../server/db";
import {
  createVerificationPlan,
  downloadVerifiedArtifact,
  validateCompletedBackupRun,
  type CompletedBackupRun,
} from "../server/restoreWorkflow";
import { storageGet } from "../server/storage";

function getRequiredArgument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith("--")) {
    throw new Error(`Uso: tsx scripts/verify-incremental-backup.ts --run <backup-run-id>`);
  }
  return value;
}

async function downloadBuffer(key: string): Promise<Buffer> {
  const { url } = await storageGet(key, 900);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao baixar ${key}: HTTP ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const runId = getRequiredArgument("--run");
  const db = await getDb();
  if (!db) throw new Error("Banco indisponível para consultar o backup.");

  const [row] = await db.select().from(backupRuns).where(eq(backupRuns.id, runId)).limit(1);
  if (!row) throw new Error(`Execução de backup não encontrada: ${runId}`);

  const manifest = validateCompletedBackupRun(row as CompletedBackupRun);
  const plan = createVerificationPlan(manifest);

  console.log(`Validando ${plan.length} artefato(s) da execução ${runId}...`);
  for (const expected of plan) {
    await downloadVerifiedArtifact(downloadBuffer, expected);
    console.log(`✓ ${expected.key} (${expected.bytes} bytes)`);
  }

  console.log(JSON.stringify({
    ok: true,
    runId,
    chunks: manifest.chunks.length,
    rows: manifest.chunks.reduce((sum, chunk) => sum + chunk.rows, 0),
    codeKey: manifest.code.key,
    message: "Manifesto e todos os artefatos foram verificados. Nenhum SQL foi executado.",
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(`Verificação de backup falhou: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
