#!/usr/bin/env node

/**
 * Script de Teste de Backup para Google Drive (OAuth2)
 * Testa o upload de um arquivo pequeno para verificar se as credenciais funcionam
 */

import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Configurações
const BACKUP_DIR = path.join(projectRoot, 'backups');
const GOOGLE_CREDENTIALS = JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS || '{}');
const GOOGLE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

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
    
    const media = {
      mimeType: 'text/plain',
      body: fs.createReadStream(filePath),
    };
    
    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, webViewLink',
    });
    
    console.log(`[Google Drive] ✓ Upload concluído!`);
    console.log(`[Google Drive] Link: ${response.data.webViewLink}`);
    return response.data;
  } catch (error) {
    console.error('[Google Drive] ✗ Erro ao fazer upload:', error.message);
    throw error;
  }
}

/**
 * Executar teste de backup
 */
async function runTest() {
  console.log('═══════════════════════════════════════════════════');
  console.log('Teste de Backup - ERP Adega Beira Rio (OAuth2)');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════\n');
  
  try {
    // Criar arquivo de teste
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const testFile = path.join(BACKUP_DIR, `test-backup-${timestamp}.txt`);
    
    fs.writeFileSync(testFile, `
Teste de Backup - ERP Adega Beira Rio
=====================================
Data/Hora: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
Servidor: Manus Sandbox
Método: OAuth2
Status: OK

Este é um arquivo de teste para verificar se o backup está funcionando corretamente.
Se você está vendo este arquivo no Google Drive, o backup está configurado com sucesso!
`);
    
    console.log(`[Teste] Arquivo de teste criado: ${testFile}`);
    
    // Fazer upload
    const result = await uploadToGoogleDrive(testFile);
    
    // Limpar arquivo de teste
    fs.unlinkSync(testFile);
    console.log(`[Teste] Arquivo de teste removido`);
    
    console.log('\n═══════════════════════════════════════════════════');
    console.log('✓ TESTE CONCLUÍDO COM SUCESSO!');
    console.log('═══════════════════════════════════════════════════\n');
    
    console.log('Verifique seu Google Drive para confirmar que o arquivo foi enviado.');
    console.log(`Pasta: https://drive.google.com/drive/folders/${GOOGLE_FOLDER_ID}`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n✗ TESTE FALHOU:', error.message);
    console.error('═══════════════════════════════════════════════════\n');
    process.exit(1);
  }
}

// Executar
runTest();
