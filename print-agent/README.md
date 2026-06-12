# ABRWF Print Agent v3.0

Serviço local que roda no **computador central do restaurante** e gerencia a comunicação entre o sistema web (ERP) e as impressoras térmicas via protocolo ESC/POS sobre TCP.

---

## Arquitetura de Impressão

O sistema possui **dois caminhos** para impressão:

| Caminho | Fluxo | Uso |
|---------|-------|-----|
| **Direto (HTTP)** | KDS/Desktop → `POST /print` → Agent → Impressora TCP | Tickets de produção (cozinha/bar) |
| **Fila (Polling)** | Celular → Servidor Cloud → DB → Agent polls → Impressora TCP | Recibos enviados pelo garçom |

**Importante:** A impressão de tickets de produção (cozinha/bar) é disparada pela tela do KDS aberta no computador central. Se o KDS não estiver aberto, os tickets não serão impressos.

---

## Requisitos

- **Node.js** v18+ (recomendado v20 LTS)
- **Rede local** com acesso às impressoras térmicas (porta 9100 TCP)
- **Impressoras** compatíveis com ESC/POS (Epson, Elgin, Bematech, etc.)

---

## Instalação

```bash
cd print-agent
npm install
```

---

## Execução Manual

```bash
npm start
# ou
node print-agent.js
```

O agent inicia na porta **9111** (HTTP API) e conecta nas impressoras configuradas em `printers.json`.

---

## Configuração (`printers.json`)

```json
{
  "printers": [
    { "department": "KITCHEN", "name": "Cozinha", "ip": "192.168.1.100", "port": 9100, "enabled": true },
    { "department": "BAR", "name": "Bar", "ip": "192.168.1.101", "port": 9100, "enabled": true },
    { "department": "CASHIER", "name": "Caixa", "ip": "192.168.1.102", "port": 9100, "enabled": true }
  ],
  "serverUrl": "https://abrwf.com.br",
  "companyId": 2,
  "pollingIntervalMs": 5000
}
```

| Campo | Descrição |
|-------|-----------|
| `printers` | Lista de impressoras com IP, porta e departamento |
| `serverUrl` | URL do servidor cloud (para polling da fila) |
| `companyId` | ID da empresa no sistema |
| `pollingIntervalMs` | Intervalo de polling em ms (mínimo 3000, padrão 5000) |

---

## Endpoints da API (porta 9111)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/status` | Status do agent, impressoras e estatísticas |
| GET | `/config` | Configuração atual |
| PUT | `/config` | Atualizar configuração |
| POST | `/print` | Enviar job de impressão direto |
| POST | `/print-multi` | Enviar para múltiplos departamentos |
| POST | `/test` | Testar conexão com impressora |

---

## Auto-Start (Iniciar com o Windows)

### Opção 1: Pasta Startup (Recomendado)

Execute o instalador:

```bash
node install-service.js
```

Isso cria um atalho na pasta `Inicialização` do Windows. O agent será iniciado automaticamente (minimizado) ao ligar o computador.

**Para remover:** Delete o arquivo `ABRWF Print Agent.bat` da pasta:
```
C:\Users\<seu-usuario>\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup
```

### Opção 2: Manualmente na Startup

1. Pressione `Win + R`
2. Digite `shell:startup` e pressione Enter
3. Copie o arquivo `start-agent.bat` para essa pasta

### Opção 3: Agendador de Tarefas (Task Scheduler)

1. Abra o **Agendador de Tarefas** (`taskschd.msc`)
2. Clique em "Criar Tarefa Básica"
3. Nome: `ABRWF Print Agent`
4. Disparador: "Quando o computador iniciar"
5. Ação: "Iniciar um programa"
6. Programa: `node`
7. Argumentos: `print-agent.js`
8. Iniciar em: `C:\caminho\para\print-agent\`
9. Marque "Executar com privilégios mais altos"

### Opção 4: Serviço Windows (NSSM - Avançado)

Para instalar como serviço Windows real (reinicia automaticamente se cair):

```bash
node install-service.js --nssm
```

Isso mostra as instruções detalhadas para usar o NSSM.

---

## Troubleshooting

### Impressão não sai na cozinha

1. **Verifique se o KDS está aberto** no computador central (tela "KDS Cozinha")
2. **Verifique se o Print Agent está rodando:** acesse `http://localhost:9111/status`
3. **Verifique o IP da impressora:** `ping 192.168.1.100` (deve responder)
4. **Teste a impressora:** na tela de Impressoras do sistema, clique "Testar"

### Agent mostra "Rate limited (429)"

O servidor está limitando requisições. O agent v3.0 faz backoff automático. Se persistir:
- Verifique se não há múltiplas instâncias do agent rodando
- Aumente o `pollingIntervalMs` para 10000 (10s)

### Impressora com timeout

- Verifique se a impressora está ligada e conectada à rede
- Verifique se o IP está correto no `printers.json`
- O agent v3.0 faz 1 retry automático antes de reportar erro

### Agent não inicia

- Verifique se Node.js está instalado: `node --version`
- Verifique se as dependências estão instaladas: `npm install`
- Verifique se a porta 9111 não está em uso: `netstat -an | findstr 9111`

---

## Changelog

### v3.0 (2025-06)
- Porta da API alterada de 9100 para **9111** (evita conflito com impressoras)
- Polling com intervalo adaptativo (backoff automático em caso de erro/429)
- Processamento paralelo de jobs (não bloqueia se uma impressora está lenta)
- Deduplicação de jobs (evita reimprimir se `reportJobComplete` falhar)
- Retry automático para conexões TCP com timeout
- Logs com timestamp (horário de São Paulo)
- Watchdog que reinicia polling se parar inesperadamente
- Graceful shutdown (SIGINT/SIGTERM)
- Estatísticas de uso no endpoint `/status`
- Título "Adega Beira Rio" no recibo impresso

### v2.0
- Polling de fila do servidor cloud
- Suporte a múltiplos departamentos
- Chrome Private Network Access headers

### v1.0
- Impressão direta via HTTP
- Configuração via `printers.json`
