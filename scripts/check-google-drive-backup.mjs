import { google } from "googleapis";

const rawCredentials = process.env.GOOGLE_DRIVE_CREDENTIALS;
const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

if (!rawCredentials || !folderId) {
  console.log(JSON.stringify({ configured: false, readable: false, reason: "missing_configuration" }));
  process.exit(0);
}

try {
  const credentials = JSON.parse(rawCredentials);
  if (!credentials.client_email || !credentials.private_key) {
    console.log(JSON.stringify({ configured: true, readable: false, reason: "incomplete_service_account" }));
    process.exit(0);
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  const drive = google.drive({ version: "v3", auth });
  await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
  });

  const probe = await drive.files.create({
    requestBody: {
      name: `.abrwf-backup-write-check-${Date.now()}.txt`,
      parents: [folderId],
      mimeType: "text/plain",
    },
    media: {
      mimeType: "text/plain",
      body: "ABRWF backup permission check",
    },
    fields: "id",
  });
  await drive.files.delete({ fileId: probe.data.id });

  console.log(JSON.stringify({ configured: true, readable: true, writable: true }));
} catch (error) {
  const status = error?.code || error?.response?.status || null;
  const apiReason = error?.response?.data?.error?.errors?.[0]?.reason || null;
  console.log(JSON.stringify({ configured: true, readable: false, reason: "drive_api_access_failed", status, apiReason }));
  process.exitCode = 1;
}
