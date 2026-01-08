# Backup Automático - ERP Adega Beira Rio

## Visão Geral

O sistema possui backup automático diário configurado para enviar os dados para o Google Drive.

## Configuração

### Agendamento
- **Horário:** 3h da manhã (GMT-3 / Horário de Brasília)
- **Frequência:** Diário

### O que é feito backup
1. **Banco de Dados (SQL):** Dump completo do banco MySQL/TiDB
2. **Código (ZIP):** Código-fonte do projeto (excluindo node_modules, .git, etc.)

### Destino
- **Google Drive:** Pasta "Backup ABRWF"
- **Link:** https://drive.google.com/drive/folders/1NIchyOc_oKNaFYeBubJwrLJp0sBIxpaw

### Notificações
- Notificação enviada via sistema Manus após cada backup (sucesso ou falha)
- Email: comercial@adegabeirario.com.br

## Credenciais

As credenciais são armazenadas como variáveis de ambiente:

| Variável | Descrição |
|----------|-----------|
| `GOOGLE_DRIVE_CREDENTIALS` | JSON com client_id, client_secret e refresh_token |
| `GOOGLE_DRIVE_FOLDER_ID` | ID da pasta no Google Drive |
| `BACKUP_EMAIL_NOTIFICATION` | Email para notificações |

## Executar Backup Manualmente

Para executar um backup manual:

```bash
cd /home/ubuntu/erp-demo
node scripts/backup.mjs
```

## Testar Conexão

Para testar se as credenciais estão funcionando:

```bash
cd /home/ubuntu/erp-demo
node scripts/test-backup.mjs
```

## Retenção

- **Local:** Backups são mantidos por 7 dias no servidor
- **Google Drive:** Backups são mantidos indefinidamente (gerenciar manualmente se necessário)

## Troubleshooting

### Erro "refresh_token expired"
O refresh token pode expirar após 7 dias se o app não for verificado. Para renovar:
1. Acesse o Google Cloud Console
2. Gere um novo código de autorização
3. Troque pelo refresh token
4. Atualize a variável GOOGLE_DRIVE_CREDENTIALS

### Erro de conexão com banco
Verifique se a variável DATABASE_URL está configurada corretamente.

### Erro de upload
Verifique se a pasta do Google Drive ainda existe e se as permissões estão corretas.

## Logs

Os logs de backup são exibidos no console durante a execução.

## Backup Nativo TiDB

Além deste backup customizado, o TiDB Cloud também possui backup automático nativo:
- Backup diário automático
- Retenção de 7 dias
- Restauração via console do TiDB Cloud
