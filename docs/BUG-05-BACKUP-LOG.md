# BUG-05: Backup com Log - Google Drive

## Descrição do Problema

O sistema de backup para Google Drive parou de funcionar desde 15/01/2026. O backup é crítico como rede de segurança antes de mudanças arquiteturais maiores (multiempresa, contábil, etc.).

## Diagnóstico

### Situação Atual
- **Credenciais configuradas:** OAuth2 (client_id, client_secret, refresh_token)
- **GOOGLE_DRIVE_FOLDER_ID:** Configurado ✓
- **Erro:** `invalid_grant` - O refresh_token expirou ou foi revogado

### Causa Raiz
O `refresh_token` do OAuth2 expirou. Possíveis motivos:
1. Token não usado por período prolongado
2. App em modo "teste" no Google Cloud (tokens expiram em 7 dias)
3. Usuário revogou acesso nas configurações do Google
4. Limite de 50 refresh_tokens por conta atingido

### Inconsistência no Código
- **backupEndpoint.ts:** Usa OAuth2Client com refresh_token
- **backup.test.ts:** Espera Service Account com client_email

---

## Solução Proposta

### Migrar de OAuth2 para Service Account

**Justificativa:**
| Aspecto | OAuth2 | Service Account |
|---------|--------|-----------------|
| Expiração | Pode expirar | Não expira |
| Interação | Requer usuário | Automático |
| Complexidade | Alta | Baixa |
| Ideal para | Apps interativos | Automação/Backups |

---

## Parte 1: Criar Service Account (Manual - Gabriel)

### Passo 1: Acessar Google Cloud Console
1. Acesse: https://console.cloud.google.com/
2. Selecione ou crie um projeto (ex: "ABRWF-Backup")

### Passo 2: Habilitar Google Drive API
1. Menu → APIs e Serviços → Biblioteca
2. Buscar "Google Drive API"
3. Clicar em "Ativar"

### Passo 3: Criar Service Account
1. Menu → APIs e Serviços → Credenciais
2. Clicar em "Criar credenciais" → "Conta de serviço"
3. Nome: `abrwf-backup`
4. Descrição: "Service Account para backup automático do ERP"
5. Clicar em "Criar e continuar"
6. Pular as etapas opcionais → "Concluído"

### Passo 4: Gerar Chave JSON
1. Na lista de Service Accounts, clicar no email criado
2. Aba "Chaves" → "Adicionar chave" → "Criar nova chave"
3. Tipo: JSON
4. Baixar o arquivo (ex: `abrwf-backup-xxxxx.json`)

### Passo 5: Compartilhar Pasta do Drive
1. Abrir Google Drive
2. Localizar a pasta de backup existente
3. Clicar com botão direito → "Compartilhar"
4. Adicionar o email da Service Account (ex: `abrwf-backup@projeto.iam.gserviceaccount.com`)
5. Permissão: **Editor**
6. Desmarcar "Notificar pessoas"
7. Clicar em "Compartilhar"

### Passo 6: Atualizar Credenciais no Sistema
O conteúdo do arquivo JSON baixado deve ser configurado na variável `GOOGLE_DRIVE_CREDENTIALS`.

**Formato esperado do JSON:**
```json
{
  "type": "service_account",
  "project_id": "seu-projeto",
  "private_key_id": "xxxxx",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "abrwf-backup@seu-projeto.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

---

## Parte 2: Alterações de Código (Aurora)

### Arquivo: `server/backupEndpoint.ts`

**Alteração 1:** Substituir função `getOAuth2Client` por `getServiceAccountAuth`

```typescript
// ANTES (OAuth2 - linhas 28-51)
function getOAuth2Client() {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS || '{}');
    
    if (!credentials.client_id || !credentials.client_secret || !credentials.refresh_token) {
      console.log('[Google Drive] ⚠ Credenciais incompletas');
      return null;
    }
    
    const oauth2Client = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret
    );
    
    oauth2Client.setCredentials({
      refresh_token: credentials.refresh_token
    });
    
    return oauth2Client;
  } catch (error) {
    console.error('[Google Drive] Erro ao criar cliente OAuth2:', error);
    return null;
  }
}

// DEPOIS (Service Account)
function getServiceAccountAuth() {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS || '{}');
    
    if (!credentials.client_email || !credentials.private_key) {
      console.log('[Google Drive] ⚠ Credenciais de Service Account incompletas');
      return null;
    }
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    
    return auth;
  } catch (error) {
    console.error('[Google Drive] Erro ao criar cliente Service Account:', error);
    return null;
  }
}
```

**Alteração 2:** Atualizar função `uploadToGoogleDrive` (linha 112)

```typescript
// ANTES
const auth = getOAuth2Client();

// DEPOIS
const auth = getServiceAccountAuth();
```

**Alteração 3:** Atualizar função `cleanOldDriveBackups` (linha 187)

```typescript
// ANTES
const auth = getOAuth2Client();

// DEPOIS
const auth = getServiceAccountAuth();
```

---

## Parte 3: Sistema de Log de Backups

### Nova Tabela: `backupLogs`

```typescript
// drizzle/schema.ts
export const backupLogs = mysqlTable("backupLogs", {
  id: int("id").primaryKey().autoincrement(),
  startedAt: timestamp("startedAt").notNull(),
  completedAt: timestamp("completedAt"),
  status: mysqlEnum("status", ["running", "success", "partial", "failed"]).notNull(),
  
  // Detalhes do backup
  databaseFile: varchar("databaseFile", { length: 255 }),
  databaseSize: int("databaseSize"), // bytes
  codeFile: varchar("codeFile", { length: 255 }),
  codeSize: int("codeSize"), // bytes
  
  // Google Drive
  databaseDriveId: varchar("databaseDriveId", { length: 100 }),
  databaseDriveLink: varchar("databaseDriveLink", { length: 500 }),
  codeDriveId: varchar("codeDriveId", { length: 100 }),
  codeDriveLink: varchar("codeDriveLink", { length: 500 }),
  
  // Limpeza
  localFilesDeleted: int("localFilesDeleted").default(0),
  driveFilesDeleted: int("driveFilesDeleted").default(0),
  
  // Erro (se houver)
  errorMessage: text("errorMessage"),
  
  // Duração
  durationSeconds: decimal("durationSeconds", { precision: 10, scale: 2 }),
  
  // Metadados
  triggeredBy: varchar("triggeredBy", { length: 50 }), // "scheduled", "manual", "webhook"
  serverVersion: varchar("serverVersion", { length: 50 }),
});

export type BackupLog = typeof backupLogs.$inferSelect;
export type InsertBackupLog = typeof backupLogs.$inferInsert;
```

### Funções de Log em `server/db.ts`

```typescript
// Criar log de backup iniciado
export async function createBackupLog(triggeredBy: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(backupLogs).values({
    startedAt: new Date(),
    status: "running",
    triggeredBy,
  });
  
  return result.insertId;
}

// Atualizar log com sucesso
export async function updateBackupLogSuccess(
  logId: number,
  data: {
    databaseFile: string;
    databaseSize: number;
    codeFile: string;
    codeSize: number;
    databaseDriveId?: string;
    databaseDriveLink?: string;
    codeDriveId?: string;
    codeDriveLink?: string;
    localFilesDeleted: number;
    driveFilesDeleted: number;
    durationSeconds: number;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(backupLogs)
    .set({
      completedAt: new Date(),
      status: "success",
      ...data,
    })
    .where(eq(backupLogs.id, logId));
}

// Atualizar log com falha
export async function updateBackupLogFailed(
  logId: number,
  errorMessage: string,
  durationSeconds: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(backupLogs)
    .set({
      completedAt: new Date(),
      status: "failed",
      errorMessage,
      durationSeconds,
    })
    .where(eq(backupLogs.id, logId));
}

// Listar últimos backups
export async function listBackupLogs(limit: number = 20): Promise<BackupLog[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(backupLogs)
    .orderBy(desc(backupLogs.startedAt))
    .limit(limit);
}
```

### Endpoint de Histórico

```typescript
// Em backupEndpoint.ts - adicionar novo endpoint
router.get('/backup/history', async (req: Request, res: Response) => {
  try {
    const logs = await listBackupLogs(20);
    
    res.json({
      success: true,
      logs: logs.map(log => ({
        id: log.id,
        startedAt: log.startedAt,
        completedAt: log.completedAt,
        status: log.status,
        databaseSize: log.databaseSize ? `${(log.databaseSize / 1024 / 1024).toFixed(2)} MB` : null,
        codeSize: log.codeSize ? `${(log.codeSize / 1024 / 1024).toFixed(2)} MB` : null,
        driveLinks: {
          database: log.databaseDriveLink,
          code: log.codeDriveLink,
        },
        duration: log.durationSeconds ? `${log.durationSeconds}s` : null,
        error: log.errorMessage,
        triggeredBy: log.triggeredBy,
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

## Parte 4: Atualizar Testes

### Arquivo: `server/__tests__/backup.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { google } from 'googleapis';

describe('Google Drive Backup - Service Account', () => {
  it('should have GOOGLE_DRIVE_CREDENTIALS configured', () => {
    const credentials = process.env.GOOGLE_DRIVE_CREDENTIALS;
    expect(credentials).toBeDefined();
    expect(credentials).not.toBe('');
  });

  it('should have GOOGLE_DRIVE_FOLDER_ID configured', () => {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    expect(folderId).toBeDefined();
    expect(folderId).not.toBe('');
  });

  it('should parse GOOGLE_DRIVE_CREDENTIALS as valid Service Account JSON', () => {
    const credentials = process.env.GOOGLE_DRIVE_CREDENTIALS;
    expect(credentials).toBeDefined();
    
    let parsed;
    expect(() => {
      parsed = JSON.parse(credentials!);
    }).not.toThrow();
    
    // Service Account deve ter estes campos
    expect(parsed).toHaveProperty('type', 'service_account');
    expect(parsed).toHaveProperty('project_id');
    expect(parsed).toHaveProperty('private_key');
    expect(parsed).toHaveProperty('client_email');
  });

  it('should authenticate with Google Drive API using Service Account', async () => {
    const credentials = JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS!);
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    
    const authClient = await auth.getClient();
    expect(authClient).toBeDefined();
  });

  it('should access the backup folder in Google Drive', async () => {
    const credentials = JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS!);
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    
    const drive = google.drive({ version: 'v3', auth });
    
    const response = await drive.files.get({
      fileId: folderId,
      fields: 'id, name',
    });
    
    expect(response.data).toBeDefined();
    expect(response.data.id).toBe(folderId);
    console.log(`✓ Pasta de backup encontrada: ${response.data.name}`);
  });
});
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `drizzle/schema.ts` | Adicionar tabela `backupLogs` |
| `server/db.ts` | Adicionar funções de log de backup |
| `server/backupEndpoint.ts` | Migrar OAuth2 → Service Account, integrar logs |
| `server/__tests__/backup.test.ts` | Atualizar testes para Service Account |

## Ordem de Execução

1. **Gabriel:** Criar Service Account e compartilhar pasta (Parte 1)
2. **Gabriel:** Atualizar `GOOGLE_DRIVE_CREDENTIALS` com novo JSON
3. **Aurora:** Implementar alterações de código (Partes 2, 3, 4)
4. **Aurora:** Rodar testes e validar
5. **Aurora:** Executar backup manual para confirmar funcionamento

## Impacto
- **Risco:** Médio (alteração em sistema crítico de backup)
- **Escopo:** Backend (backupEndpoint.ts, db.ts, schema.ts)
- **Tempo estimado:** 
  - Parte 1 (Gabriel): 15-20 minutos
  - Partes 2-4 (Aurora): 45-60 minutos

---
**Autor:** Aurora (Manus AI)
**Data:** 2026-02-04
**Status:** ✅ Aprovado por Orion - Aguardando execução da Parte 1 por Gabriel
