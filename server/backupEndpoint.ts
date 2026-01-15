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
 * Criar cliente OAuth2 autenticado para Google Drive
 */
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
    const auth = getOAuth2Client();
    if (!auth) {
      console.log('[Google Drive] ⚠ Cliente OAuth2 não disponível');
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
    const auth = getOAuth2Client();
    if (!auth) {
      console.log('[Limpeza Drive] ⚠ Cliente OAuth2 não disponível');
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
  
  try {
    // 1. Fazer backup do banco de dados
    const dbBackup = await backupDatabase();
    results.push({ name: path.basename(dbBackup.file), size: dbBackup.size, file: dbBackup.file });
    
    // 2. Fazer backup do código
    const codeBackup = await backupCode();
    results.push({ name: path.basename(codeBackup.file), size: codeBackup.size, file: codeBackup.file });
    
    // 3. Fazer upload para Google Drive
    console.log('\n[Google Drive] Iniciando upload dos arquivos...\n');
    
    const hasGoogleDrive = !!(process.env.GOOGLE_DRIVE_CREDENTIALS && process.env.GOOGLE_DRIVE_FOLDER_ID);
    
    if (hasGoogleDrive) {
      for (let i = 0; i < results.length; i++) {
        const driveResult = await uploadToGoogleDrive(results[i].file);
        if (driveResult) {
          results[i].driveLink = driveResult.link;
          results[i].driveId = driveResult.id;
        }
      }
    } else {
      console.log('[Google Drive] ⚠ Credenciais não configuradas, pulando upload\n');
    }
    
    // 4. Limpar backups antigos
    console.log('');
    const deletedLocal = await cleanOldLocalBackups();
    
    if (hasGoogleDrive) {
      const deletedDrive = await cleanOldDriveBackups();
    }
    
    // 5. Enviar notificação
    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    let content = `**Data/Hora:** ${timestamp}\n\n**Status:** ✅ Concluído com sucesso\n\n**Arquivos Locais:**\n`;
    
    for (const r of results) {
      content += `- ${r.name} (${(r.size / 1024 / 1024).toFixed(2)} MB)\n`;
      if (r.driveLink) {
        content += `  📁 Google Drive: ${r.driveLink}\n`;
      }
    }
    
    content += `\n**Limpeza:** ${deletedLocal} arquivo(s) local(is) removido(s)`;
    
    if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
      content += `\n📂 Pasta: https://drive.google.com/drive/folders/${process.env.GOOGLE_DRIVE_FOLDER_ID}`;
    }
    
    await sendManusNotification('Backup Concluído - ABRWF', content);
    
    // Resumo final
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const totalSize = results.reduce((sum, r) => sum + r.size, 0);
    
    console.log('\n═══════════════════════════════════════════════════');
    console.log('✓ Backup concluído com sucesso!');
    console.log(`Duração: ${duration}s`);
    console.log(`Total: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log('═══════════════════════════════════════════════════\n');
    
    res.json({
      success: true,
      duration: `${duration}s`,
      totalSize: `${(totalSize / 1024 / 1024).toFixed(2)} MB`,
      files: results.map(r => ({
        name: r.name,
        size: `${(r.size / 1024 / 1024).toFixed(2)} MB`,
        driveLink: r.driveLink || null
      }))
    });
    
  } catch (error: any) {
    console.error('\n✗ Erro durante o backup:', error.message);
    
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

export default router;
