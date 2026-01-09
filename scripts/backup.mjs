#!/usr/bin/env node

/**
 * Script de Backup Automático para Google Drive (OAuth2)
 * Executa diariamente às 3h da manhã (GMT-3)
 * Faz backup do banco de dados (SQL dump) e código (ZIP)
 * Envia notificação de conclusão via Manus e Email
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
const BACKUP_EMAIL = process.env.BACKUP_EMAIL_NOTIFICATION || 'comercial@adegabeirario.com.br';

// Política de Retenção (em dias)
const RETENTION_LOCAL = 7;    // Manter 7 dias localmente
const RETENTION_DRIVE = 30;   // Manter 30 dias no Google Drive

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
    
    // Parse da URL de conexão (mysql://user:password@host:port/database?params)
    const urlMatch = databaseUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
    if (!urlMatch) {
      throw new Error('DATABASE_URL em formato inválido');
    }
    
    const [, user, password, host, port, database] = urlMatch;
    // Remove qualquer parâmetro de query string do nome do banco
    const cleanDatabase = database.split('?')[0];
    
    // Executar mysqldump
    const command = `mysqldump -h ${host} -P ${port} -u ${user} -p${password} --ssl-mode=REQUIRED ${cleanDatabase} > ${backupFile}`;
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
 * Enviar email via Gmail API
 */
async function sendEmail(subject, htmlBody) {
  console.log('[Email] Enviando email de notificação...');
  
  try {
    const auth = getOAuth2Client();
    const gmail = google.gmail({ version: 'v1', auth });
    
    // Construir email no formato RFC 2822
    const emailLines = [
      `To: ${BACKUP_EMAIL}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      htmlBody
    ];
    
    const email = emailLines.join('\r\n');
    
    // Codificar em base64url
    const encodedEmail = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail,
      },
    });
    
    console.log(`[Email] ✓ Email enviado para ${BACKUP_EMAIL}`);
    return true;
  } catch (error) {
    console.error('[Email] ✗ Erro ao enviar email:', error.message);
    // Não falhar o backup por causa do email
    return false;
  }
}

/**
 * Enviar notificação via Manus
 */
async function sendManusNotification(title, content) {
  console.log('[Manus] Enviando notificação...');
  
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
        console.log('[Manus] ✓ Notificação enviada com sucesso');
        return true;
      }
    }
    
    console.log('[Manus] ⚠ Serviço de notificação não disponível');
    return false;
  } catch (error) {
    console.error('[Manus] ✗ Erro ao enviar notificação:', error.message);
    return false;
  }
}

/**
 * Enviar todas as notificações (Manus + Email)
 */
async function sendNotification(backupResults, success = true) {
  const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  
  // Título sem caracteres especiais para evitar problemas de encoding
  const title = success 
    ? 'Backup Concluido - ABRWF'
    : 'Backup Falhou - ABRWF';
  
  // Conteúdo para Manus (Markdown)
  let manusContent = `**Data/Hora:** ${timestamp}\n\n`;
  
  if (success) {
    manusContent += `**Status:** Concluído com sucesso\n\n`;
    manusContent += `**Arquivos Gerados:**\n`;
    for (const result of backupResults) {
      const sizeMB = (result.size / 1024 / 1024).toFixed(2);
      manusContent += `- ${result.name} (${sizeMB} MB)\n`;
      manusContent += `  Link: ${result.link}\n`;
    }
  } else {
    manusContent += `**Status:** Falhou\n\n`;
    manusContent += `**Erro:** ${backupResults}\n`;
  }
  
  manusContent += `\n**Pasta de Backup:** https://drive.google.com/drive/folders/${GOOGLE_FOLDER_ID}`;
  
  // Conteúdo para Email (HTML) - Cores da empresa (verde)
  const logoUrl = process.env.VITE_APP_LOGO || '';
  let emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${success ? '#2D5A3D' : '#EF4444'}; color: white; padding: 20px; text-align: center;">
        ${logoUrl ? `<img src="${logoUrl}" alt="ABRWF" style="height: 50px; margin-bottom: 10px;">` : ''}
        <h1 style="margin: 0;">Backup ${success ? 'Concluído' : 'Falhou'}</h1>
        <p style="margin: 10px 0 0;">ABRWF - Análise Baseada em Resultados</p>
      </div>
      
      <div style="padding: 20px; background: #f9f9f9;">
        <p><strong>Data/Hora:</strong> ${timestamp}</p>
        <p><strong>Status:</strong> ${success ? 'Concluído com sucesso' : 'Falhou'}</p>
  `;
  
  if (success) {
    emailHtml += `
        <h3 style="color: #333;">Arquivos Gerados:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background: #ddd;">
            <th style="padding: 10px; text-align: left;">Arquivo</th>
            <th style="padding: 10px; text-align: right;">Tamanho</th>
          </tr>
    `;
    
    for (const result of backupResults) {
      const sizeMB = (result.size / 1024 / 1024).toFixed(2);
      emailHtml += `
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 10px;">
              <a href="${result.link}" style="color: #2563EB;">${result.name}</a>
            </td>
            <td style="padding: 10px; text-align: right;">${sizeMB} MB</td>
          </tr>
      `;
    }
    
    emailHtml += `</table>`;
  } else {
    emailHtml += `
        <div style="background: #FEE2E2; border: 1px solid #EF4444; padding: 15px; border-radius: 5px;">
          <strong>Erro:</strong> ${backupResults}
        </div>
    `;
  }
  
  emailHtml += `
        <p style="margin-top: 20px;">
          <a href="https://drive.google.com/drive/folders/${GOOGLE_FOLDER_ID}" 
             style="display: inline-block; background: #2D5A3D; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Abrir Pasta de Backup
          </a>
        </p>
        
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
        
        <p style="color: #666; font-size: 12px;">
          <strong>Política de Retenção:</strong><br>
          • Backups locais: ${RETENTION_LOCAL} dias<br>
          • Backups no Google Drive: ${RETENTION_DRIVE} dias
        </p>
      </div>
      
      <div style="background: #2D5A3D; color: white; padding: 15px; text-align: center; font-size: 12px;">
        ${logoUrl ? `<img src="${logoUrl}" alt="ABRWF" style="height: 30px; margin-bottom: 8px;"><br>` : ''}
        <strong>ABRWF</strong> - Análise Baseada em Resultados<br>
        Este é um email automático do sistema de backup.
      </div>
    </div>
  `;
  
  // Enviar ambas as notificações
  await sendManusNotification(title, manusContent);
  await sendEmail(title, emailHtml);
}

/**
 * Limpar backups antigos localmente (manter apenas últimos X dias)
 */
async function cleanOldLocalBackups() {
  console.log(`[Limpeza Local] Removendo backups com mais de ${RETENTION_LOCAL} dias...`);
  
  try {
    const cutoffDate = Date.now() - (RETENTION_LOCAL * 24 * 60 * 60 * 1000);
    const files = fs.readdirSync(BACKUP_DIR);
    
    let deletedCount = 0;
    for (const file of files) {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtimeMs < cutoffDate) {
        fs.unlinkSync(filePath);
        deletedCount++;
        console.log(`[Limpeza Local] Removido: ${file}`);
      }
    }
    
    console.log(`[Limpeza Local] ✓ ${deletedCount} arquivo(s) removido(s)`);
  } catch (error) {
    console.error('[Limpeza Local] ✗ Erro ao limpar backups antigos:', error.message);
  }
}

/**
 * Limpar backups antigos no Google Drive (manter apenas últimos X dias)
 */
async function cleanOldDriveBackups() {
  console.log(`[Limpeza Drive] Removendo backups com mais de ${RETENTION_DRIVE} dias...`);
  
  try {
    const auth = getOAuth2Client();
    const drive = google.drive({ version: 'v3', auth });
    
    // Calcular data de corte
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DRIVE);
    const cutoffDateStr = cutoffDate.toISOString();
    
    // Buscar arquivos antigos na pasta de backup
    const response = await drive.files.list({
      q: `'${GOOGLE_FOLDER_ID}' in parents and createdTime < '${cutoffDateStr}' and trashed = false`,
      fields: 'files(id, name, createdTime)',
      orderBy: 'createdTime asc',
    });
    
    const oldFiles = response.data.files || [];
    
    if (oldFiles.length === 0) {
      console.log('[Limpeza Drive] ✓ Nenhum arquivo antigo encontrado');
      return;
    }
    
    console.log(`[Limpeza Drive] Encontrados ${oldFiles.length} arquivo(s) para remover`);
    
    for (const file of oldFiles) {
      try {
        await drive.files.delete({ fileId: file.id });
        console.log(`[Limpeza Drive] Removido: ${file.name} (${file.createdTime})`);
      } catch (err) {
        console.error(`[Limpeza Drive] Erro ao remover ${file.name}:`, err.message);
      }
    }
    
    console.log(`[Limpeza Drive] ✓ ${oldFiles.length} arquivo(s) removido(s)`);
  } catch (error) {
    console.error('[Limpeza Drive] ✗ Erro ao limpar backups antigos:', error.message);
  }
}

/**
 * Executar backup completo
 */
async function runBackup() {
  console.log('═══════════════════════════════════════════════════');
  console.log('Backup Automático - ERP Adega Beira Rio');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Email de notificação: ${BACKUP_EMAIL}`);
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
    
    // 4. Enviar notificações (Manus + Email)
    console.log('');
    await sendNotification(results, true);
    
    // 5. Limpar backups antigos (local e Drive)
    console.log('');
    await cleanOldLocalBackups();
    await cleanOldDriveBackups();
    
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
