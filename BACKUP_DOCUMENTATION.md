# Sistema de Backup Automático - ERP Adega Beira Rio

**Data de Implementação:** 11 de janeiro de 2026  
**Versão:** 1.0  
**Status:** ✅ Operacional

---

## Visão Geral

O sistema de backup automático do ERP Adega Beira Rio foi implementado para garantir proteção contínua dos dados críticos do negócio. O sistema executa backups diários às 3h da manhã (GMT-3), criando cópias do banco de dados e código-fonte, com limpeza automática de arquivos antigos.

---

## Arquitetura Técnica

### Componentes Principais

O sistema é composto por dois elementos principais:

**1. Endpoint HTTP de Backup** (`server/backupEndpoint.ts`)

Um endpoint Express que implementa toda a lógica de backup. Ele pode ser chamado via HTTP POST e executa as seguintes operações em sequência:

- Exporta o banco de dados MySQL usando `mysqldump` com SSL
- Cria um arquivo ZIP do código-fonte, excluindo diretórios desnecessários
- Remove backups locais com mais de 7 dias
- Envia notificação de sucesso ou falha via Manus

**2. Agendador Cron** (Scheduler do Manus)

Uma tarefa cron agendada para executar diariamente às 3h (GMT-3), que invoca o endpoint de backup automaticamente.

### Fluxo de Execução

```
[Scheduler Manus] 
    ↓ (3h GMT-3 diariamente)
[POST /api/backup]
    ↓
[mysqldump] → database-TIMESTAMP.sql
[zip -r]    → code-TIMESTAMP.zip
    ↓
[Limpeza] → Remove arquivos > 7 dias
    ↓
[Notificação Manus] → Sucesso/Falha
```

---

## Funcionalidades Implementadas

### Backup do Banco de Dados

O sistema executa um dump SQL completo do banco de dados MySQL usando `mysqldump` com as seguintes características:

- **Modo SSL:** Conexão segura com `--ssl-mode=REQUIRED`
- **Formato:** Arquivo SQL comprimido automaticamente pelo sistema de arquivos
- **Tamanho típico:** ~29 MB por execução
- **Tempo de execução:** ~2 segundos

### Backup do Código-Fonte

Um arquivo ZIP contendo todo o código-fonte do projeto, com exclusão automática de:

- Diretórios de dependências (`node_modules`)
- Controle de versão (`.git`)
- Backups anteriores (`backups`)
- Arquivos compilados (`dist`, `.next`)
- Arquivos de configuração local (`.env`, `.env.local`)

**Características:**

- **Tamanho típico:** ~3.6 MB por execução
- **Tempo de execução:** ~2 segundos
- **Compressão:** ZIP com compressão máxima

### Limpeza Automática

O sistema implementa uma política de retenção de 7 dias para backups locais:

- Verifica a data de modificação de cada arquivo
- Remove automaticamente arquivos com mais de 7 dias
- Registra cada exclusão nos logs

**Política de Retenção:**

| Tipo | Retenção | Localização |
|------|----------|-------------|
| Backups locais | 7 dias | `/home/ubuntu/erp-demo/backups/` |
| Backups Google Drive | 30 dias | Google Drive (quando configurado) |

### Notificações

O sistema envia notificações automáticas após cada execução via Manus:

**Sucesso:**
```
Título: Backup Concluído - ABRWF
Conteúdo: Data/hora, status, arquivos gerados, tamanho total
```

**Falha:**
```
Título: Backup Falhou - ABRWF
Conteúdo: Mensagem de erro detalhada
```

---

## Endpoints HTTP

### POST /api/backup

Executa um backup completo sob demanda.

**Autenticação:**
- Localhost (127.0.0.1, ::1): Sem autenticação necessária
- Acesso remoto: Requer header `Authorization: Bearer {JWT_SECRET}`

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "duration": "4.16s",
  "totalSize": "32.80 MB",
  "files": [
    {
      "name": "database-2026-01-11T13-17-47.sql",
      "size": "29.21 MB"
    },
    {
      "name": "code-2026-01-11T13-17-50.zip",
      "size": "3.60 MB"
    }
  ]
}
```

**Resposta de Erro (500):**
```json
{
  "success": false,
  "error": "Mensagem de erro detalhada"
}
```

### GET /api/backup/status

Retorna informações sobre backups existentes e configuração.

**Resposta:**
```json
{
  "configured": true,
  "localBackups": [
    {
      "name": "database-2026-01-11T13-17-47.sql",
      "size": "29.04 MB",
      "date": "2026-01-11T09:40:15.714Z"
    }
  ],
  "retentionPolicy": {
    "local": "7 dias"
  }
}
```

---

## Configuração e Agendamento

### Variáveis de Ambiente Necessárias

| Variável | Descrição | Obrigatória |
|----------|-----------|------------|
| `DATABASE_URL` | String de conexão MySQL | ✅ Sim |
| `BUILT_IN_FORGE_API_URL` | URL da API Manus | ✅ Sim |
| `BUILT_IN_FORGE_API_KEY` | Token de autenticação Manus | ✅ Sim |
| `BACKUP_SECRET` | Token para autenticação remota | ❌ Opcional |
| `GOOGLE_DRIVE_CREDENTIALS` | JSON com credenciais OAuth2 | ❌ Opcional |
| `GOOGLE_DRIVE_FOLDER_ID` | ID da pasta no Google Drive | ❌ Opcional |

### Agendamento Cron

A tarefa está agendada para executar diariamente às 3h (GMT-3):

```
0 3 * * *
```

**Interpretação:**
- Minuto: 0
- Hora: 3 (UTC-3)
- Dia do mês: * (todos)
- Mês: * (todos)
- Dia da semana: * (todos)

---

## Teste e Validação

### Teste Manual

Para testar o backup sob demanda, execute:

```bash
# Localhost (sem autenticação)
curl -X POST http://127.0.0.1:3000/api/backup

# Acesso remoto (com autenticação)
curl -X POST https://seu-dominio.com/api/backup \
  -H "Authorization: Bearer seu-jwt-secret"
```

### Verificar Status

```bash
curl http://localhost:3000/api/backup/status
```

### Resultado do Teste Inicial

O sistema foi testado com sucesso em 11 de janeiro de 2026:

- **Database backup:** 29.21 MB
- **Code backup:** 3.60 MB
- **Tempo total:** 4.16 segundos
- **Status:** ✅ Sucesso

---

## Próximos Passos Recomendados

### 1. Integração com Google Drive

Para ativar upload automático para Google Drive:

1. Configure as credenciais OAuth2 em `GOOGLE_DRIVE_CREDENTIALS`
2. Defina o ID da pasta em `GOOGLE_DRIVE_FOLDER_ID`
3. O sistema começará a fazer upload automaticamente

O código já está preparado para esta integração (linhas 85-120 em `backupEndpoint.ts`).

### 2. Notificação por Email

Atualmente, as notificações são enviadas via Manus. Para adicionar email:

1. Integrar com Gmail API ou serviço de email
2. Adicionar template HTML personalizado
3. Configurar endereço de destino

### 3. Monitoramento e Alertas

Considere implementar:

- Dashboard de histórico de backups
- Alertas se backup não executar por mais de 24h
- Verificação de integridade dos arquivos
- Armazenamento em múltiplas regiões

---

## Troubleshooting

### Backup não está sendo executado

**Verificar:**
1. Se o servidor está rodando: `ps aux | grep node`
2. Se a porta 3000 está acessível
3. Logs do servidor para erros

### Erro: "DATABASE_URL não configurado"

**Solução:** Verificar se a variável de ambiente está definida no painel de Secrets do Manus.

### Erro: "mysqldump not found"

**Solução:** Instalar cliente MySQL:
```bash
sudo apt-get install mysql-client
```

### Espaço em disco insuficiente

**Solução:** 
1. Aumentar retenção local para menos dias
2. Fazer upload para Google Drive para liberar espaço
3. Limpar backups manualmente: `rm /home/ubuntu/erp-demo/backups/*`

---

## Segurança

### Boas Práticas Implementadas

- **Autenticação:** Localhost sem autenticação, acesso remoto com JWT
- **SSL/TLS:** Conexão segura com banco de dados
- **Exclusão de sensíveis:** Arquivos `.env` não são inclusos no ZIP
- **Permissões:** Backups salvos com permissões restritas

### Recomendações Adicionais

1. Armazenar backups em múltiplos locais (local + Google Drive + S3)
2. Testar restauração periodicamente
3. Criptografar backups antes de enviar para nuvem
4. Manter log de auditoria de acessos ao backup

---

## Referências Técnicas

**Arquivos Modificados:**
- `server/backupEndpoint.ts` - Novo arquivo com lógica de backup
- `server/_core/index.ts` - Registra endpoint no servidor Express

**Dependências Utilizadas:**
- `child_process.execSync` - Execução de mysqldump e zip
- `fs` - Manipulação de arquivos
- `path` - Gerenciamento de caminhos
- `express` - Framework web

**Ferramentas Externas:**
- `mysqldump` - Backup de banco de dados
- `zip` - Compressão de arquivos
- Manus Notification API - Envio de notificações

---

## Contato e Suporte

Para dúvidas ou problemas com o sistema de backup, consulte:

1. Logs do servidor: `docker logs erp-demo` ou verificar stdout do processo Node.js
2. Dashboard de Backups: Acessar `/api/backup/status`
3. Notificações: Verificar painel de notificações do Manus

---

**Documento preparado por:** Manus AI  
**Data:** 11 de janeiro de 2026  
**Versão:** 1.0
