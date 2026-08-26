/**
 * Endpoint HTTP para executar backup via webhook
 * Rota: POST /api/backup
 * Header: Authorization: Bearer {BACKUP_SECRET}
 */

import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { google } from 'googleapis';
import {
  createBackupLog,
  updateBackupLogSuccess,
  updateBackupLogPartial,
  updateBackupLogFailed,
  listBackupLogs,
  getLastSuccessfulBackup
} from './db';
import { storagePut, storageGet } from './storage';

const router = Router();

// Configurações
const BACKUP_DIR = path.join(process.cwd(), 'backups');
const RETENTION_DAYS = 7;
const RETENTION_DRIVE_DAYS = 30;

// Criar diretório de backups se não existir
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Criar cliente Service Account autenticado para Google Drive
 * Migrado de OAuth2 para Service Account em 04/02/2026 (BUG-05)
 */
function getServiceAccountAuth() {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS || '{}');
    
    // Verificar se é uma Service Account válida
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

/**
 * Escapar valor SQL para INSERT statements
 */
function escapeSqlValue(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value instanceof Date) {
    return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
  }
  if (Buffer.isBuffer(value)) {
    return `X'${value.toString('hex')}'`;
  }
  // Escapar strings
  const escaped = String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'") 
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\x00/g, '\\0');
  return `'${escaped}'`;
}

/**
 * Fazer dump do banco de dados usando queries SQL puras (sem mysqldump)
 * Compatível com qualquer ambiente Node.js
 */
async function backupDatabase(): Promise<{ file: string; size: number }> {
  console.log('[Backup] Iniciando backup do banco de dados (SQL puro)...');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupFile = path.join(BACKUP_DIR, `database-${timestamp}.sql`);
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL não configurado');
  }
  
  // Parse da URL de conexão
  const urlMatch = databaseUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  if (!urlMatch) {
    throw new Error('DATABASE_URL em formato inválido');
  }
  
  const [, user, password, host, port, database] = urlMatch;
  const cleanDatabase = database.split('?')[0];
  
  // Criar conexão direta via mysql2
  const connection = await mysql.createConnection({
    host,
    port: parseInt(port),
    user,
    password,
    database: cleanDatabase,
    ssl: { rejectUnauthorized: true },
    connectTimeout: 30000,
  });
  
  try {
    const writeStream = fs.createWriteStream(backupFile);
    
    // Header
    const now = new Date().toISOString();
    writeStream.write(`-- ABRWF ERP Database Backup\n`);
    writeStream.write(`-- Generated: ${now}\n`);
    writeStream.write(`-- Method: Pure SQL (Node.js mysql2)\n`);
    writeStream.write(`-- Database: ${cleanDatabase}\n\n`);
    writeStream.write(`SET NAMES utf8mb4;\n`);
    writeStream.write(`SET FOREIGN_KEY_CHECKS = 0;\n\n`);
    
    // Listar todas as tabelas
    const [tables] = await connection.query('SHOW TABLES') as any[];
    const tableKey = Object.keys(tables[0])[0];
    const tableNames = tables.map((t: any) => t[tableKey]) as string[];
    
    console.log(`[Backup] Encontradas ${tableNames.length} tabelas`);
    
    let totalRows = 0;
    
    for (const tableName of tableNames) {
      console.log(`[Backup] Exportando: ${tableName}...`);
      
      // Obter CREATE TABLE
      const [createResult] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``) as any[];
      const createSql = createResult[0]['Create Table'];
      
      writeStream.write(`-- -----------------------------------------------\n`);
      writeStream.write(`-- Table: ${tableName}\n`);
      writeStream.write(`-- -----------------------------------------------\n`);
      writeStream.write(`DROP TABLE IF EXISTS \`${tableName}\`;\n`);
      writeStream.write(`${createSql};\n\n`);
      
      // Exportar dados em lotes de 500 registros
      const BATCH_SIZE = 500;
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const [rows] = await connection.query(
          `SELECT * FROM \`${tableName}\` LIMIT ${BATCH_SIZE} OFFSET ${offset}`
        ) as any[];
        
        if (rows.length === 0) {
          hasMore = false;
          break;
        }
        
        // Gerar INSERT statements
        const columns = Object.keys(rows[0]);
        const columnList = columns.map(c => `\`${c}\``).join(', ');
        
        // Agrupar em INSERT de até 50 rows por statement
        const ROWS_PER_INSERT = 50;
        for (let i = 0; i < rows.length; i += ROWS_PER_INSERT) {
          const batch = rows.slice(i, i + ROWS_PER_INSERT);
          const values = batch.map((row: any) => {
            const vals = columns.map(col => escapeSqlValue(row[col]));
            return `(${vals.join(', ')})`;
          }).join(',\n');
          
          writeStream.write(`INSERT INTO \`${tableName}\` (${columnList}) VALUES\n${values};\n`);
        }
        
        totalRows += rows.length;
        offset += BATCH_SIZE;
        
        if (rows.length < BATCH_SIZE) {
          hasMore = false;
        }
      }
      
      writeStream.write('\n');
    }
    
    // Footer
    writeStream.write(`SET FOREIGN_KEY_CHECKS = 1;\n`);
    writeStream.write(`-- Backup complete: ${tableNames.length} tables, ${totalRows} rows\n`);
    
    // Aguardar finalização da escrita
    await new Promise<void>((resolve, reject) => {
      writeStream.end(() => resolve());
      writeStream.on('error', reject);
    });
    
    const stats = fs.statSync(backupFile);
    console.log(`[Backup] ✓ Banco exportado: ${tableNames.length} tabelas, ${totalRows} registros, ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    
    return { file: backupFile, size: stats.size };
  } finally {
    await connection.end();
  }
}

/**
 * Fazer ZIP do código usando archiver (sem dependência de binário externo)
 */
async function backupCode(): Promise<{ file: string; size: number }> {
  console.log('[Backup] Iniciando backup do código...');
  
  const archiver = (await import('archiver')).default;
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupFile = path.join(BACKUP_DIR, `code-${timestamp}.zip`);
  
  const excludeDirs = ['node_modules', '.git', 'backups', 'dist', 'coverage', '.next'];
  
  return new Promise<{ file: string; size: number }>((resolve, reject) => {
    const output = fs.createWriteStream(backupFile);
    const archive = archiver('zip', { zlib: { level: 6 } });
    
    output.on('close', () => {
      const size = archive.pointer();
      console.log(`[Backup] ✓ Código exportado: ${(size / 1024 / 1024).toFixed(2)} MB`);
      resolve({ file: backupFile, size });
    });
    
    archive.on('error', (err: Error) => reject(err));
    archive.pipe(output);
    
    // Adicionar todos os arquivos exceto os diretórios ignorados
    archive.glob('**/*', {
      cwd: process.cwd(),
      ignore: excludeDirs.map(d => `${d}/**`),
      dot: true,
    });
    
    archive.finalize();
  });
}

/**
 * Fazer upload para Google Drive
 */
async function uploadToGoogleDrive(filePath: string): Promise<{ id: string; link: string } | null> {
  try {
    const auth = getServiceAccountAuth();
    if (!auth) {
      console.log('[Google Drive] ⚠ Cliente Service Account não disponível');
      return null;
    }
    
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
      console.log('[Google Drive] ⚠ GOOGLE_DRIVE_FOLDER_ID não configurado');
      return null;
    }
    
    console.log(`[Google Drive] Fazendo upload de ${path.basename(filePath)}...`);
    
    const drive = google.drive({ version: 'v3', auth });
    
    const fileMetadata = {
      name: path.basename(filePath),
      parents: [folderId],
    };
    
    const mimeType = filePath.endsWith('.sql') ? 'text/plain' : 'application/zip';
    const media = {
      mimeType,
      body: fs.createReadStream(filePath),
    };
    
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink',
    });
    
    console.log(`[Google Drive] ✓ Upload concluído: ${response.data.webViewLink}`);
    return { id: response.data.id!, link: response.data.webViewLink! };
  } catch (error: any) {
    console.error('[Google Drive] ✗ Erro ao fazer upload:', error.message);
    return null;
  }
}

/**
 * Fazer upload para S3 (Manus Storage)
 * Alternativa ao Google Drive - mais estável para backups automáticos
 */
async function uploadToS3(filePath: string): Promise<{ key: string; url: string } | null> {
  try {
    const fileName = path.basename(filePath);
    const s3Key = `backups/${fileName}`;
    const mimeType = filePath.endsWith('.sql') ? 'text/plain' : 'application/zip';
    
    console.log(`[S3] Fazendo upload de ${fileName}...`);
    
    const fileBuffer = fs.readFileSync(filePath);
    const result = await storagePut(s3Key, fileBuffer, mimeType);
    
    console.log(`[S3] ✓ Upload concluído: ${result.url}`);
    return result;
  } catch (error: any) {
    console.error('[S3] ✗ Erro ao fazer upload:', error.message);
    return null;
  }
}

/**
 * Limpar backups antigos localmente
 */
async function cleanOldLocalBackups(): Promise<number> {
  console.log(`[Limpeza Local] Removendo backups com mais de ${RETENTION_DAYS} dias...`);
  
  const cutoffDate = Date.now() - (RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const files = fs.readdirSync(BACKUP_DIR);
  
  let deletedCount = 0;
  for (const file of files) {
    if (!file.endsWith('.sql') && !file.endsWith('.zip')) continue;
    
    const filePath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filePath);
    
    if (stats.mtimeMs < cutoffDate) {
      fs.unlinkSync(filePath);
      deletedCount++;
      console.log(`[Limpeza Local] Removido: ${file}`);
    }
  }
  
  console.log(`[Limpeza Local] ✓ ${deletedCount} arquivo(s) removido(s)`);
  return deletedCount;
}

/**
 * Limpar backups antigos no Google Drive
 */
async function cleanOldDriveBackups(): Promise<number> {
  try {
    const auth = getServiceAccountAuth();
    if (!auth) {
      console.log('[Limpeza Drive] ⚠ Cliente Service Account não disponível');
      return 0;
    }
    
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
      console.log('[Limpeza Drive] ⚠ GOOGLE_DRIVE_FOLDER_ID não configurado');
      return 0;
    }
    
    console.log(`[Limpeza Drive] Removendo backups com mais de ${RETENTION_DRIVE_DAYS} dias...`);
    
    const drive = google.drive({ version: 'v3', auth });
    
    // Calcular data de corte
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DRIVE_DAYS);
    const cutoffDateStr = cutoffDate.toISOString();
    
    // Buscar arquivos antigos na pasta de backup
    const response = await drive.files.list({
      q: `'${folderId}' in parents and createdTime < '${cutoffDateStr}' and trashed = false`,
      fields: 'files(id, name, createdTime)',
      orderBy: 'createdTime asc',
    });
    
    const oldFiles = response.data.files || [];
    
    if (oldFiles.length === 0) {
      console.log('[Limpeza Drive] ✓ Nenhum arquivo antigo encontrado');
      return 0;
    }
    
    console.log(`[Limpeza Drive] Encontrados ${oldFiles.length} arquivo(s) para remover`);
    
    for (const file of oldFiles) {
      try {
        await drive.files.delete({ fileId: file.id! });
        console.log(`[Limpeza Drive] Removido: ${file.name}`);
      } catch (err: any) {
        console.error(`[Limpeza Drive] Erro ao remover ${file.name}:`, err.message);
      }
    }
    
    console.log(`[Limpeza Drive] ✓ ${oldFiles.length} arquivo(s) removido(s)`);
    return oldFiles.length;
  } catch (error: any) {
    console.error('[Limpeza Drive] ✗ Erro:', error.message);
    return 0;
  }
}

/**
 * Enviar notificação via Manus
 */
async function sendManusNotification(title: string, content: string) {
  try {
    if (process.env.BUILT_IN_FORGE_API_URL && process.env.BUILT_IN_FORGE_API_KEY) {
      const response = await fetch(`${process.env.BUILT_IN_FORGE_API_URL}/webdevtoken.v1.WebDevService/SendNotification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}`,
          'Content-Type': 'application/json',
          'accept': 'application/json',
          'connect-protocol-version': '1',
        },
        body: JSON.stringify({ title, content }),
      });
      
      if (response.ok) {
        console.log('[Manus] ✓ Notificação enviada');
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('[Manus] Erro:', error);
    return false;
  }
}

/**
 * Endpoint principal de backup
 * POST /api/backup
 */
router.post('/backup', async (req: Request, res: Response) => {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('Backup Automático - ERP Adega Beira Rio');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════\n');
  
  // Verificar autenticação
  const backupSecret = process.env.BACKUP_SECRET || process.env.JWT_SECRET;
  const clientIp = req.ip || req.connection.remoteAddress || '';
  const isLocalhost = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1';
  
  if (!isLocalhost && backupSecret) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token !== backupSecret) {
      console.log('[Backup] Acesso não autorizado');
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }
  }

  // Compatibilidade: chamadas antigas avançam somente uma etapa persistida.
  // Isso impede que um webhook legado volte a executar dump, ZIP e uploads em uma chamada monolítica.
  try {
    const { advanceBackupRun } = await import('./backupWorkflow');
    const result = await advanceBackupRun(req.body?.triggeredBy || 'legacy-api');
    return res.status(202).json({ success: true, mode: 'incremental', ...result });
  } catch (error: any) {
    return res.status(500).json({ success: false, mode: 'incremental', error: error.message });
  }
  
  const startTime = Date.now();
  const results: any[] = [];
  
  // Determinar origem do backup
  const triggeredBy = req.body?.triggeredBy || 'webhook';
  let logId: number | null = null;
  
  try {
    // Criar log de backup iniciado
    logId = await createBackupLog(triggeredBy);
    console.log(`[Backup] Log criado: ID ${logId}`);
    
    // 1. Fazer backup do banco de dados
    const dbBackup = await backupDatabase();
    results.push({ name: path.basename(dbBackup.file), size: dbBackup.size, file: dbBackup.file });
    
    // 2. Fazer backup do código
    const codeBackup = await backupCode();
    results.push({ name: path.basename(codeBackup.file), size: codeBackup.size, file: codeBackup.file });
    
    // 3. Fazer upload para S3 (principal) e Google Drive (fallback)
    console.log('\n[Upload] Iniciando upload dos arquivos...\n');
    
    // Upload para S3 (Manus Storage) - principal
    for (let i = 0; i < results.length; i++) {
      try {
        const s3Result = await uploadToS3(results[i].file);
        if (s3Result) {
          results[i].s3Key = s3Result.key;
          results[i].s3Url = s3Result.url;
        }
      } catch (error: any) {
        console.error(`[S3] Erro no upload de ${results[i].name}:`, error.message);
      }
    }
    
    // Upload para Google Drive (fallback/opcional)
    const hasGoogleDrive = !!(process.env.GOOGLE_DRIVE_CREDENTIALS && process.env.GOOGLE_DRIVE_FOLDER_ID);
    
    if (hasGoogleDrive) {
      for (let i = 0; i < results.length; i++) {
        const driveResult = await uploadToGoogleDrive(results[i].file);
        if (driveResult) {
          results[i].driveLink = driveResult.link;
          results[i].driveId = driveResult.id;
        }
      }
    }
    
    // 4. Limpar backups antigos
    console.log('');
    const deletedLocal = await cleanOldLocalBackups();
    
    if (hasGoogleDrive) {
      const deletedDrive = await cleanOldDriveBackups();
    }
    
    // 5. Enviar notificação
    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const hasS3Success = results.some(r => r.s3Url);
    let content = `**Data/Hora:** ${timestamp}\n\n**Status:** ✅ Concluído com sucesso\n\n**Arquivos:**\n`;
    
    for (const r of results) {
      content += `- ${r.name} (${(r.size / 1024 / 1024).toFixed(2)} MB)\n`;
      if (r.s3Url) {
        content += `  ☁️ S3: ${r.s3Url}\n`;
      }
      if (r.driveLink) {
        content += `  📁 Google Drive: ${r.driveLink}\n`;
      }
    }
    
    content += `\n**Limpeza:** ${deletedLocal} arquivo(s) local(is) removido(s)`;
    
    await sendManusNotification('Backup Concluído - ABRWF', content);
    
    // Resumo final
    const duration = ((Date.now() - startTime) / 1000);
    const totalSize = results.reduce((sum, r) => sum + r.size, 0);
    
    // Atualizar log de backup
    if (logId) {
      const dbResult = results.find(r => r.name.includes('database'));
      const codeResult = results.find(r => r.name.includes('code'));
      const hasCloudSuccess = hasS3Success || results.some(r => r.driveLink);
      
      if (hasCloudSuccess) {
        // Sucesso: S3 ou Google Drive funcionou
        await updateBackupLogSuccess(logId, {
          databaseFile: dbResult?.name || '',
          databaseSize: dbResult?.size || 0,
          codeFile: codeResult?.name || '',
          codeSize: codeResult?.size || 0,
          databaseDriveId: dbResult?.driveId || dbResult?.s3Key,
          databaseDriveLink: dbResult?.driveLink || dbResult?.s3Url,
          codeDriveId: codeResult?.driveId || codeResult?.s3Key,
          codeDriveLink: codeResult?.driveLink || codeResult?.s3Url,
          localFilesDeleted: deletedLocal,
          driveFilesDeleted: 0,
          durationSeconds: duration,
        });
      } else {
        // Parcial: backup local ok, mas cloud falhou
        await updateBackupLogPartial(logId, {
          databaseFile: dbResult?.name || '',
          databaseSize: dbResult?.size || 0,
          codeFile: codeResult?.name || '',
          codeSize: codeResult?.size || 0,
          localFilesDeleted: deletedLocal,
          durationSeconds: duration,
          errorMessage: 'Upload para cloud (S3/Drive) falhou',
        });
      }
    }
    
    console.log('\n═══════════════════════════════════════════════════');
    console.log('✓ Backup concluído com sucesso!');
    console.log(`Duração: ${duration.toFixed(2)}s`);
    console.log(`Total: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log('═══════════════════════════════════════════════════\n');
    
    res.json({
      success: true,
      logId,
      duration: `${duration.toFixed(2)}s`,
      totalSize: `${(totalSize / 1024 / 1024).toFixed(2)} MB`,
      files: results.map(r => ({
        name: r.name,
        size: `${(r.size / 1024 / 1024).toFixed(2)} MB`,
        s3Url: r.s3Url || null,
        driveLink: r.driveLink || null
      }))
    });
    
  } catch (error: any) {
    console.error('\n✗ Erro durante o backup:', error.message);
    
    // Atualizar log de backup com falha
    if (logId) {
      const duration = (Date.now() - startTime) / 1000;
      await updateBackupLogFailed(logId, error.message, duration);
    }
    
    // Enviar notificação de falha
    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    await sendManusNotification('Backup Falhou - ABRWF', `**Data/Hora:** ${timestamp}\n\n**Erro:** ${error.message}`);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Endpoint de status do backup
 * GET /api/backup/status
 */
router.get('/backup/status', async (req: Request, res: Response) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.sql') || f.endsWith('.zip'))
      .map(f => {
        const stats = fs.statSync(path.join(BACKUP_DIR, f));
        return {
          name: f,
          size: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
          date: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const hasGoogleDrive = !!(process.env.GOOGLE_DRIVE_CREDENTIALS && process.env.GOOGLE_DRIVE_FOLDER_ID);
    
    res.json({
      configured: true,
      googleDriveEnabled: hasGoogleDrive,
      localBackups: files.slice(0, 10),
      retentionPolicy: {
        local: `${RETENTION_DAYS} dias`,
        drive: `${RETENTION_DRIVE_DAYS} dias`
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint de histórico de backups (BUG-05)
 * GET /api/backup/history
 */
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

/**
 * Endpoint de último backup bem-sucedido (BUG-05)
 * GET /api/backup/last-success
 */
router.get('/backup/last-success', async (req: Request, res: Response) => {
  try {
    const lastBackup = await getLastSuccessfulBackup();
    
    if (!lastBackup) {
      return res.json({ success: true, lastBackup: null });
    }
    
    res.json({
      success: true,
      lastBackup: {
        id: lastBackup.id,
        startedAt: lastBackup.startedAt,
        completedAt: lastBackup.completedAt,
        databaseSize: lastBackup.databaseSize ? `${(lastBackup.databaseSize / 1024 / 1024).toFixed(2)} MB` : null,
        codeSize: lastBackup.codeSize ? `${(lastBackup.codeSize / 1024 / 1024).toFixed(2)} MB` : null,
        driveLinks: {
          database: lastBackup.databaseDriveLink,
          code: lastBackup.codeDriveLink,
        },
        duration: lastBackup.durationSeconds ? `${lastBackup.durationSeconds}s` : null,
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
