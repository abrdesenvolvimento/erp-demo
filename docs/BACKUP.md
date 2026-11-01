# Backup incremental — ABRWF

## Estado atual

O ABRWF possui um fluxo de backup incremental persistido no banco. Cada acionamento exporta uma etapa curta do banco, grava o bloco SQL no armazenamento privado, atualiza o manifesto com checksum SHA-256 e preserva o cursor para a próxima etapa.

> **Situação operacional em 31/10/2026:** o fluxo está implementado, mas ainda não há uma execução incremental concluída e validada por restauração. A cadência do Heartbeat precisa ser configurada após a publicação da versão que contém as proteções descritas neste documento.

## Arquitetura

- **Gatilho oficial:** Heartbeat Manus autenticado, apontando para `POST /api/scheduled/backup`.
- **Autorização:** o endpoint só aceita o identificador de tarefa Heartbeat autorizado no servidor.
- **Persistência:** `backupRuns` mantém status, fase, cursor, contagem de chunks, manifesto e checksums; `backupLogs` registra o resultado operacional.
- **Destino primário:** Manus Storage, em `backups/incremental/<runId>/`.
- **Fases:** `DATABASE` → `CODE` → `COMPLETE`.
- **Banco:** exportado em blocos de até 10.000 linhas por chamada.
- **Código:** gerado apenas após a exportação do banco e exclui dependências, artefatos e arquivos sensíveis.

## Regras de segurança

O ZIP de código não pode conter credenciais nem configurações locais. São excluídos, entre outros:

- `.env` e `.env.*`;
- `.project-config.json` e `.manus/`;
- chaves `.pem` e `.key`;
- arquivos de credencial JSON;
- `node_modules`, `.git`, `dist`, `coverage`, `.next` e backups locais.

As rotas de operação e consulta de backup exigem administrador autenticado ou, na rota de compatibilidade, o `BACKUP_SECRET` explícito. O segredo de sessão (`JWT_SECRET`) não é aceito como token de automação.

## Agendamento pretendido

Após a publicação da versão protegida, o Heartbeat do backup deve executar na janela noturna:

```text
0 */5 6-11 * * *
```

Isso equivale a uma chamada a cada cinco minutos entre **03:00 e 08:55**, no horário de São Paulo (06:00 a 11:55 UTC). A mesma execução `ACTIVE` é retomada a cada chamada; não deve ser aberto um ciclo paralelo.

Após uma conclusão, a aplicação respeita um intervalo mínimo de 20 horas antes de abrir um novo ciclo.

## Operação manual

O acionamento manual existe apenas para administrador autenticado e avança uma única etapa; não cria mais dump monolítico.

Nunca usar em produção sem janela aprovada:

- `scripts/backup.mjs`;
- `scripts/test-backup.mjs`;
- `scripts/run-one-backup-step.mjs`;
- `scripts/setup-cron.sh`;
- chamadas manuais ao endpoint Heartbeat.

Esses scripts representam caminhos legados ou de manutenção e não são o mecanismo oficial do backup incremental.

## Validação obrigatória de uma cópia

Uma cópia é considerada íntegra somente quando:

1. `backupRuns.status` é `COMPLETE`;
2. o manifesto e todos os chunks possuem checksum armazenado;
3. o ZIP de código possui checksum e chave de armazenamento;
4. a restauração é testada em ambiente descartável;
5. a contagem de tabelas e a abertura do banco restaurado são verificadas.

Não tratar uma execução `ACTIVE`, interrompida ou apenas parcialmente exportada como cópia recuperável.

## Pendências para maturidade operacional

1. Publicar a versão protegida do fluxo.
2. Desativar o agendamento legado que executa `scripts/backup.mjs`.
3. Configurar a janela de cinco minutos no Heartbeat oficial.
4. Encerrar formalmente a execução ativa antiga como não recuperável e iniciar um ciclo limpo.
5. Confirmar a primeira cópia `COMPLETE`.
6. Implementar e executar restauração controlada.
7. Configurar alerta de ausência de cópia íntegra e política de retenção.
8. Avaliar réplica externa independente somente depois da validação do destino primário.

## Consultas de auditoria

```sql
SELECT id, status, phase, currentTableIndex, currentTableOffset,
       chunksCreated, rowsExported, createdAt, updatedAt, lastError
FROM backupRuns
ORDER BY updatedAt DESC;

SELECT status, COUNT(*) AS total, MAX(startedAt) AS ultimo_inicio,
       MAX(completedAt) AS ultima_conclusao
FROM backupLogs
GROUP BY status;
```

## Itens fora do escopo atual

Google Drive, `mysqldump`, cron local e upload via OAuth pertencem ao mecanismo legado. Eles não validam nem substituem o fluxo incremental atual.
