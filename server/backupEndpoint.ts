/**
 * Endpoint HTTP para executar backup via webhook
 * Rota: POST /api/backup
 * Header: Authorization: Bearer {BACKUP_SECRET}
 */

import { Router, Request, Response } from 'express';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
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
 * Fazer dump do banco de dados
 */
async function backupDatabase(): Promise<{ file: string; size: number }> {
  console.log('[Backup] Iniciando backup do banco de dados...');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupFile = path.join(BACKUP_DIR, `database-${timestamp}.sql`);
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL não configurado');
  }
  
  // Parse da URL de conexão (mysql://user:password@host:port/database?params)
  const urlMatch = databaseUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  if (!urlMatch) {
    throw new Error('DATABASE_URL em formato inválido');
  }
  
  const [, user, password, host, port, database] = urlMatch;
  const cleanDatabase = database.split('?')[0];
  
  // Executar mysqldump
  const command = `mysqldump -h ${host} -P ${port} -u ${user} -p${password} --ssl-mode=REQUIRED ${cleanDatabase} > ${backupFile}`;
  execSync(command, { stdio: 'pipe' });
  
  const stats = fs.statSync(backupFile);
  console.log(`[Backup] ✓ Banco de dados exportado: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  
  return { file: backupFile, size: stats.size };
}

/**
 * Fazer ZIP do código
 */
async function backupCode(): Promise<{ file: string; size: number }> {
  console.log('[Backup] Iniciando backup do código...');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupFile = path.join(BACKUP_DIR, `code-${timestamp}.zip`);
  
  // Excluir diretórios desnecessários
  const excludeDirs = ['node_modules', '.git', 'backups', 'dist', 'coverage', '.next'];
  const excludeArgs = excludeDirs.map(dir => `-x "${dir}/*"`).join(' ');
  
  // Criar ZIP
  const command = `cd ${process.cwd()} && zip -r -q ${backupFile} . ${excludeArgs}`;
  execSync(command, { stdio: 'pipe' });
  
  const stats = fs.statSync(backupFile);
  console.log(`[Backup] ✓ Código exportado: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  
  return { file: backupFile, size: stats.size };
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
