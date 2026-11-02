# Restauração controlada — ABRWF

## Finalidade e limite de segurança

Este procedimento serve para provar que uma cópia incremental concluída pode ser recuperada em um **banco descartável e isolado**. Ele nunca deve ser usado para restaurar, substituir ou escrever na base de produção.

O backup atual é um dump lógico completo fatiado por etapas para caber na janela do Heartbeat. Ele não é um delta, binlog ou snapshot transacional único. Portanto, uma restauração validada comprova recuperabilidade operacional, mas não transforma a cópia em um ponto consistente garantido se houve alterações concorrentes durante a exportação.

## Pré-requisitos obrigatórios

1. A execução em `backupRuns` está `COMPLETE`, com fase `COMPLETE`, sem `lastError` e sem trava ativa.
2. O manifesto aponta para todos os chunks SQL e para o ZIP de código.
3. A CLI de verificação baixou todos os objetos e confirmou tamanho e SHA-256.
4. Existe uma URL de banco **dedicada e descartável** em `RESTORE_DATABASE_URL`.
5. O usuário do banco de restauração não possui acesso ao banco de produção.
6. O schema de destino segue o prefixo `abrwf_restore_` e foi provisionado fora da aplicação.
7. Há autorização explícita para a escrita no ambiente descartável e confirmação do identificador exato do ciclo.

## Verificação sem escrita

Quando houver uma cópia concluída, execute:

```bash
cd /home/ubuntu/erp-demo
npx tsx scripts/verify-incremental-backup.ts --run <backup-run-id>
```

A CLI consulta somente os metadados, baixa o manifesto, todos os chunks e o ZIP de código, e confere cada tamanho e SHA-256. Ela **não executa SQL**, não extrai o ZIP e não abre conexão de escrita.

O ciclo é reprovado se estiver parcial, tiver contadores divergentes, checksum inválido, artefato ausente, chave fora do prefixo do ciclo ou arquivo de código incompatível.

## Próxima implementação: restauração em ambiente isolado

A restauração só será implementada/executada após existir uma cópia `COMPLETE` aprovada na verificação e uma URL de banco descartável. O roteiro será:

1. Baixar e verificar todos os arquivos antes de abrir qualquer conexão de escrita.
2. Conectar somente a `RESTORE_DATABASE_URL` e conferir que o schema é permitido e não corresponde à produção.
3. Aplicar os chunks SQL na ordem registrada no manifesto, em uma única sessão, com `FOREIGN_KEY_CHECKS=0` somente no banco descartável.
4. Restaurar a checagem de chaves estrangeiras.
5. Comparar tabelas e contagens contra o manifesto.
6. Executar verificações de integridade e órfãos de relações conhecidas.
7. Registrar o relatório de restauração e destruir o schema/instância descartável após a janela de validação.

## Não fazer

- Não usar `DATABASE_URL` como destino de restauração.
- Não usar `scripts/backup.mjs`, `mysqldump`, Google Drive ou cron legado para validar o fluxo incremental.
- Não extrair nem executar o ZIP de código como parte da restauração do banco.
- Não aceitar uma execução `ACTIVE` ou `FAILED` como backup restaurável.
- Não restaurar no banco de produção, mesmo em emergência, sem plano de incidente, snapshot independente e aprovação específica.
