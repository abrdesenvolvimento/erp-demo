/**
 * Endpoint HTTP para executar backup via webhook
 * Rota: POST /api/backup
 * Header: Authorization: Bearer {BACKUP_SECRET}
 */

import { Router, Request, Response } from 'express';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const router = Router();

// Configurações
const BACKUP_DIR = path.join(process.cwd(), 'backups');

// Criar diretório de backups se não existir
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
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
 * Limpar backups antigos
 */
async function cleanOldBackups(): Promise<number> {
  const RETENTION_DAYS = 7;
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
      console.log(`[Limpeza] Removido: ${file}`);
    }
  }
  
  return deletedCount;
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
    results.push({ name: path.basename(dbBackup.file), size: dbBackup.size });
    
    // 2. Fazer backup do código
    const codeBackup = await backupCode();
    results.push({ name: path.basename(codeBackup.file), size: codeBackup.size });
    
    // 3. Limpar backups antigos
    console.log('');
    const deletedCount = await cleanOldBackups();
    
    // 4. Enviar notificação
    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const content = `**Data/Hora:** ${timestamp}\n\n**Status:** ✅ Concluído com sucesso\n\n**Arquivos:**\n${results.map(r => `- ${r.name} (${(r.size / 1024 / 1024).toFixed(2)} MB)`).join('\n')}\n\n**Limpeza:** ${deletedCount} arquivo(s) antigo(s) removido(s)`;
    
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
        size: `${(r.size / 1024 / 1024).toFixed(2)} MB`
      }))
    });
    
  } catch (error: any) {
    console.error('\n✗ Erro durante o backup:', error.message);
    
    // Enviar notificação de falha
    await sendManusNotification('Backup Falhou - ABRWF', `**Erro:** ${error.message}`);
    
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
    
    res.json({
      configured: true,
      localBackups: files.slice(0, 10),
      retentionPolicy: {
        local: '7 dias'
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
