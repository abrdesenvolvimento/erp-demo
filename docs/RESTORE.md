# Restauração controlada — ABRWF

## Resultado comprovado em 08/11/2026

A cópia `backup-1793858873889-a322fe51`, concluída em 07/11/2026, foi restaurada em MySQL 8.0.46 local, no schema descartável `abrwf_restore_20261108_b07nov`. O serviço de teste foi exposto somente em `127.0.0.1:3407`; o usuário do restaurador possuía permissões exclusivamente nesse schema.

Foram verificados **132 artefatos** — 131 blocos SQL e um ZIP de código — por tamanho e SHA-256. A restauração recuperou **70 tabelas e 695.344 registros**, com todas as contagens iguais ao manifesto. Não houve duplicação de IDs nas tabelas principais auditadas. A execução completa de download, validação e restauração durou 73,727 segundos no ambiente deste teste; esse tempo não constitui garantia para outra máquina ou outro volume.

O ZIP de código foi verificado, mas não extraído nem executado. Os 70 comandos `DROP TABLE IF EXISTS` existentes no dump legado foram reconhecidos e descartados: a ferramenta exige destino vazio e não apaga tabelas.

### Alertas separados da fidelidade da recuperação

Foram encontrados cinco itens sem venda correspondente, um vínculo iFood sem venda correspondente e um movimento cuja empresa difere da empresa do produto vinculado. Uma comparação somente leitura encontrou **os mesmos identificadores na base atual**. Isso demonstra que esses casos também estão na fonte atual; não determina sua data ou causa original. Não foi aplicada correção histórica.

O dump recuperado é sequencial, não uma fotografia transacional única. Portanto, contagens iguais e SQL restaurável comprovam a recuperação desta cópia, mas não garantem que todas as tabelas correspondam ao mesmo instante. A cópia começou em 05/11 e terminou em 07/11; não deve ser interpretada como um snapshot completo tomado no momento da conclusão. As tabelas de Consumo implantadas em 08/11 não faziam parte desse inventário.

## Requisitos obrigatórios

1. Execução `COMPLETE`, fase `COMPLETE`, sem erro nem trava ativa.
2. Manifesto e contadores coerentes; todos os objetos disponíveis, com tamanho e checksum conferentes.
3. Destino dedicado em `RESTORE_DATABASE_URL`, nunca `DATABASE_URL`.
4. Host literal de loopback (`127.0.0.1`, `localhost` ou `::1`) e schema `abrwf_restore_[a-z0-9_]+`.
5. Usuário restrito ao schema descartável e sem acesso à produção.
6. Schema provisionado externamente e inteiramente vazio; a ferramenta não o cria nem limpa.
7. Aprovação explícita da escrita no destino isolado e identificação exata da cópia. A versão atual permite escrita apenas para o ciclo usado neste teste; outro ciclo exige nova aprovação e atualização deliberada da guarda.

## Verificação sem escrita

```bash
cd /home/ubuntu/erp-demo
npx tsx scripts/verify-incremental-backup.ts --run <backup-run-id>
```

A CLI original lê apenas os metadados e verifica os objetos. Não executa SQL.

A nova CLI acrescenta validação da sintaxe do dump e cache privado fora do projeto:

```bash
npx tsx scripts/restore-incremental-backup.ts --run backup-1793858873889-a322fe51
```

Sem `--apply`, ela não abre conexão de destino nem executa SQL de restauração. Antes de qualquer escrita, exige que **todos** os objetos passem em tamanho, checksum e sintaxe.

## Escrita no banco descartável aprovado

As credenciais devem ser fornecidas por variável de ambiente segura, nunca em argumentos, logs, arquivos do projeto ou mensagens.

```bash
npx tsx scripts/restore-incremental-backup.ts \
  --run backup-1793858873889-a322fe51 \
  --confirm-run backup-1793858873889-a322fe51 \
  --apply
```

A conexão de produção é usada apenas para o SELECT parametrizado do registro do ciclo. O executor recusa destino igual à produção, host remoto, schema inseguro, URL com opções extras, confirmação divergente e destino não vazio. Confere `@@hostname`, `DATABASE()` e modos SQL antes da escrita.

Cada instrução é executada separadamente, com `multipleStatements: false`. Somente CREATE TABLE e INSERT de valores literais para a tabela exata do bloco são aceitos. Comandos de outro banco, tabela qualificada, funções INSERT, IGNORE, alterações de dados existentes, triggers, GRANT, OUTFILE e comentários SQL executáveis são recusados. Anotações TiDB não executáveis são removidas. FOREIGN_KEY_CHECKS é ajustado somente na sessão local e restaurado no encerramento.

Após a aplicação, a ferramenta compara contagens, IDs duplicados e relações entre as tabelas conhecidas. Alertas relacionais são registrados separadamente do resultado da fidelidade da recuperação.

## Auditoria e limpeza

Os arquivos SQL, ZIP e relatórios técnicos ficam em `/home/ubuntu/abrwf-restore/<runId>/`, com diretórios 0700 e arquivos 0600. São privados, fora dos assets e do repositório; não são enviados para publicação. O relatório não contém senhas, URLs de conexão, conteúdo de linhas ou dados pessoais.

O teste não restaura automaticamente um aplicativo em operação: dependências, segredos, integrações e autenticação exigem preparação independente. Nenhuma credencial do ERP deve ser reutilizada no destino descartável.

Após preservar os relatórios e concluir as verificações, o banco temporário deve ser parado e seus dados e credenciais locais removidos. Não remover as cópias originais do storage.

Uma falha após começar CREATE TABLE não tem rollback global de DDL. Para repetir a escrita, provisione um novo destino vazio. Não contorne essa restrição apagando tabelas da produção.

## Fora do escopo

Não usar esta CLI para substituir a produção, restaurar automaticamente uma conta ou autorizar saneamento histórico. Não usar scripts monolíticos legados, Google Drive ou cron local para validar o fluxo incremental. A validação de uma cópia antiga não valida automaticamente cópias futuras, a frequência da rotina ou a consistência transacional do exportador.
