#!/usr/bin/env node

/**
 * Script de Backup Automático para Google Drive (OAuth2)
 * Executa diariamente às 3h da manhã (GMT-3)
 * Faz backup do banco de dados (SQL dump) e código (ZIP)
 * Envia notificação de conclusão
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { google } from 'googleapis';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Configurações
const BACKUP_DIR = path.join(projectRoot, 'backups');
const GOOGLE_CREDENTIALS = JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS || '{}');
const GOOGLE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const BACKUP_EMAIL = process.env.BACKUP_EMAIL_NOTIFICATION;

// Criar diretório de backups se não existir
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Criar cliente OAuth2 autenticado
 */
function getOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CREDENTIALS.client_id,
    GOOGLE_CREDENTIALS.client_secret
  );
  
  oauth2Client.setCredentials({
    refresh_token: GOOGLE_CREDENTIALS.refresh_token
  });
  
  return oauth2Client;
}

/**
 * Fazer dump do banco de dados
 */
async function backupDatabase() {
  console.log('[Backup] Iniciando backup do banco de dados...');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupFile = path.join(BACKUP_DIR, `database-${timestamp}.sql`);
  
  try {
    // Construir comando mysqldump
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL não configurado');
    }
    
    // Parse da URL de conexão (mysql://user:password@host:port/database)
    const urlMatch = databaseUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (!urlMatch) {
      throw new Error('DATABASE_URL em formato inválido');
    }
    
    const [, user, password, host, port, database] = urlMatch;
    
    // Executar mysqldump
    const command = `mysqldump -h ${host} -P ${port} -u ${user} -p${password} --ssl-mode=REQUIRED ${database} > ${backupFile}`;
    execSync(command, { stdio: 'pipe' });
    
    console.log(`[Backup] ✓ Banco de dados exportado: ${backupFile}`);
    return backupFile;
  } catch (error) {
    console.error('[Backup] ✗ Erro ao fazer backup do banco:', error.message);
    throw error;
  }
}

/**
 * Fazer ZIP do código
 */
async function backupCode() {
  console.log('[Backup] Iniciando backup do código...');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupFile = path.join(BACKUP_DIR, `code-${timestamp}.zip`);
  
  try {
    // Excluir diretórios desnecessários
    const excludeDirs = [
      'node_modules',
      '.git',
      'backups',
      'dist',
      '.env',
      '.env.local',
      'coverage',
      '.next'
    ];
    
    const excludeArgs = excludeDirs.map(dir => `-x "${dir}/*"`).join(' ');
    
    // Criar ZIP
    const command = `cd ${projectRoot} && zip -r -q ${backupFile} . ${excludeArgs}`;
    execSync(command, { stdio: 'pipe' });
    
    console.log(`[Backup] ✓ Código exportado: ${backupFile}`);
    return backupFile;
  } catch (error) {
    console.error('[Backup] ✗ Erro ao fazer backup do código:', error.message);
    throw error;
  }
}

/**
 * Fazer upload para Google Drive
 */
async function uploadToGoogleDrive(filePath) {
  console.log(`[Google Drive] Fazendo upload de ${path.basename(filePath)}...`);
  
  try {
    const auth = getOAuth2Client();
    const drive = google.drive({ version: 'v3', auth });
    
    const fileMetadata = {
      name: path.basename(filePath),
      parents: [GOOGLE_FOLDER_ID],
    };
    
    const mimeType = filePath.endsWith('.sql') ? 'text/plain' : 'application/zip';
    const media = {
      mimeType,
      body: fs.createReadStream(filePath),
    };
    
    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, webViewLink, size',
    });
    
    console.log(`[Google Drive] ✓ Upload concluído: ${response.data.webViewLink}`);
    return response.data;
  } catch (error) {
    console.error('[Google Drive] ✗ Erro ao fazer upload:', error.message);
    throw error;
  }
}

/**
 * Enviar notificação via Manus
 */
async function sendNotification(backupResults, success = true) {
  console.log('[Notificação] Enviando notificação...');
  
  try {
    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    
    const title = success 
      ? '✓ Backup Concluído - ERP Adega Beira Rio'
      : '✗ Backup Falhou - ERP Adega Beira Rio';
    
    let content = `**Data/Hora:** ${timestamp}\n\n`;
    
    if (success) {
      content += `**Status:** Concluído com sucesso\n\n`;
      content += `**Arquivos Gerados:**\n`;
      for (const result of backupResults) {
        const sizeMB = (result.size / 1024 / 1024).toFixed(2);
        content += `- ${result.name} (${sizeMB} MB)\n`;
        content += `  Link: ${result.link}\n`;
      }
    } else {
      content += `**Status:** Falhou\n\n`;
      content += `**Erro:** ${backupResults}\n`;
    }
    
    content += `\n**Pasta de Backup:** https://drive.google.com/drive/folders/${GOOGLE_FOLDER_ID}`;
    
    // Usar o serviço de notificação do Manus
    if (process.env.BUILT_IN_FORGE_API_URL && process.env.BUILT_IN_FORGE_API_KEY) {
      const response = await fetch(`${process.env.BUILT_IN_FORGE_API_URL}/notification/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          content,
        }),
      });
      
      if (response.ok) {
        console.log('[Notificação] ✓ Notificação enviada com sucesso');
        return true;
      }
    }
    
    console.log('[Notificação] ⚠ Serviço de notificação não disponível');
    return false;
  } catch (error) {
    console.error('[Notificação] ✗ Erro ao enviar notificação:', error.message);
    return false;
  }
}

/**
 * Limpar backups antigos (manter apenas últimos 7 dias localmente)
 */
async function cleanOldBackups() {
  console.log('[Limpeza] Removendo backups locais antigos...');
  
  try {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const files = fs.readdirSync(BACKUP_DIR);
    
    let deletedCount = 0;
    for (const file of files) {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtimeMs < sevenDaysAgo) {
        fs.unlinkSync(filePath);
        deletedCount++;
        console.log(`[Limpeza] Removido: ${file}`);
      }
    }
    
    console.log(`[Limpeza] ✓ ${deletedCount} arquivo(s) removido(s)`);
  } catch (error) {
    console.error('[Limpeza] ✗ Erro ao limpar backups antigos:', error.message);
  }
}

/**
 * Executar backup completo
 */
async function runBackup() {
  console.log('═══════════════════════════════════════════════════');
  console.log('Backup Automático - ERP Adega Beira Rio');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════\n');
  
  const startTime = Date.now();
  const results = [];
  
  try {
    // 1. Fazer backup do banco de dados
    const dbBackupFile = await backupDatabase();
    const dbStats = fs.statSync(dbBackupFile);
    
    // 2. Fazer backup do código
    const codeBackupFile = await backupCode();
    const codeStats = fs.statSync(codeBackupFile);
    
    // 3. Fazer upload para Google Drive
    console.log('\n[Google Drive] Iniciando upload dos arquivos...\n');
    
    const dbDriveFile = await uploadToGoogleDrive(dbBackupFile);
    results.push({
      name: path.basename(dbBackupFile),
      size: dbStats.size,
      link: dbDriveFile.webViewLink,
    });
    
    const codeDriveFile = await uploadToGoogleDrive(codeBackupFile);
    results.push({
      name: path.basename(codeBackupFile),
      size: codeStats.size,
      link: codeDriveFile.webViewLink,
    });
    
    // 4. Enviar notificação de sucesso
    console.log('');
    await sendNotification(results, true);
    
    // 5. Limpar backups antigos
    console.log('');
    await cleanOldBackups();
    
    // Resumo final
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const totalSize = results.reduce((sum, r) => sum + r.size, 0);
    
    console.log('\n═══════════════════════════════════════════════════');
    console.log('✓ Backup concluído com sucesso!');
    console.log(`Duração: ${duration}s`);
    console.log(`Total: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log('═══════════════════════════════════════════════════\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Erro durante o backup:', error.message);
    
    // Enviar notificação de falha
    await sendNotification(error.message, false);
    
    console.error('═══════════════════════════════════════════════════\n');
    process.exit(1);
  }
}

// Executar
runBackup();
