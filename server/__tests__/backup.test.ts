import { describe, it, expect } from 'vitest';
import { google } from 'googleapis';

describe('Google Drive Backup Credentials', () => {
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

  it('should have BACKUP_EMAIL_NOTIFICATION configured', () => {
    const email = process.env.BACKUP_EMAIL_NOTIFICATION;
    expect(email).toBeDefined();
    expect(email).toContain('@');
  });

  it('should parse GOOGLE_DRIVE_CREDENTIALS as valid JSON', () => {
    const credentials = process.env.GOOGLE_DRIVE_CREDENTIALS;
    expect(credentials).toBeDefined();
    
    let parsed;
    expect(() => {
      parsed = JSON.parse(credentials!);
    }).not.toThrow();
    
    expect(parsed).toHaveProperty('type', 'service_account');
    expect(parsed).toHaveProperty('project_id');
    expect(parsed).toHaveProperty('private_key');
    expect(parsed).toHaveProperty('client_email');
  });

  it('should authenticate with Google Drive API', async () => {
    const credentials = JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS!);
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    
    // Tenta obter o cliente autenticado
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
    
    // Tenta acessar a pasta de backup
    const response = await drive.files.get({
      fileId: folderId,
      fields: 'id, name',
    });
    
    expect(response.data).toBeDefined();
    expect(response.data.id).toBe(folderId);
    console.log(`✓ Pasta de backup encontrada: ${response.data.name}`);
  });
});
