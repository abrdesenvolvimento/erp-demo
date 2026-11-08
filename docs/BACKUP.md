# Backup incremental — ABRWF

## Estado em 08/11/2026

A cópia `backup-1793858873889-a322fe51`, concluída em 07/11, foi efetivamente recuperada em MySQL descartável: **70 tabelas, 695.344 registros e 132 artefatos verificados**. Todas as contagens conferiram. O banco de teste foi encerrado e seus dados, SQL, ZIP e credenciais locais removidos; relatórios privados e cópias originais no storage foram preservados. Ver procedimento em [RESTORE.md](./RESTORE.md).

**A recuperação dessa cópia está comprovada; a rotina diária ainda depende da publicação e da validação do protocolo 2.** COMPLETE isoladamente não prova integridade, restauração ou consistência temporal. O dump é sequencial: a cópia começou em 05/11 e terminou em 07/11, não representa um snapshot único no instante da conclusão e não contém as tabelas de Consumo adicionadas em 08/11.

## Diagnóstico da duração

O ciclo auditado durou 49h56m34s. O código arquivado e 133 recibos bem-sucedidos do ciclo mostravam uma única etapa por callback, sem `stepsProcessed`, apesar do lote já preparado no código de desenvolvimento. O tempo somado de execução foi 345,097 segundos; a maior parte da duração foi espera entre chamadas/janelas. Houve também seis falhas de callback no período. A auditoria comprova o comportamento daquele período, mas não determina o mecanismo de publicação/roteamento que manteve o código antigo.

Uma cópia anterior, iniciada em 02/11, tinha offsets repetidos/descontínuos e não deve ser preferida à cópia de 07/11 validada. O ciclo parcial `backup-1794118001886-a791fb14`, iniciado em 08/11, foi encerrado auditavelmente em 08/11 para a migração: seu protocolo antigo não tinha inventário/ordenação congelados. Manifesto e objetos foram preservados; não foi tratado como fonte recuperável.

## Protocolo 2 preparado

- Até oito etapas sequenciais por callback, com orçamento de 45 segundos para I/O de exportação, ZIP e storage.
- `activeSlot` impede ciclos simultâneos; lease UUID, vencimento de 75 segundos e versão comparada atomicamente impedem avanços concorrentes do mesmo ciclo.
- Progresso, falha, conclusão e log terminal são confirmados somente pelo detentor válido da posse. Um retorno atrasado não pode sobrescrever o estado do vencedor.
- Chunks, versões de manifesto e ZIP usam chaves imutáveis por posse; objetos de operações abandonadas não são incorporados ao manifesto confirmado.
- Inventário ordenado e DDL ficam congelados em `planJson` para novos ciclos. Mudança de tabelas ou schema interrompe o ciclo antes de um novo artefato; AUTO_INCREMENT variável não é considerado alteração estrutural.
- Exportação ordenada por PK, com paginação OFFSET compatível com o manifesto existente. Tabela sem PK falha de forma explícita. **Isso não elimina deslocamento de páginas por alterações concorrentes nem cria snapshot global.**
- Ciclos parciais de protocolo 1 não são retomados sobre o inventário atual.
- Reconciliação considera último progresso e posse, não apenas a data de início. Sucesso limpa mensagens antigas de erro.
- ZIP exclui arquivos e diretórios sensíveis com globs completos, incluindo `.env`, variantes, configurações locais, credenciais e chaves.

O orçamento não é um timeout absoluto de todo controle Drizzle. Um upload iniciado pode terminar como objeto órfão no storage após expirar a espera, mas não confirma estado tardio. Não habilitar snapshot TiDB por horas/dias apenas com AS OF: a retenção GC observada era 10 minutos e precisaria de desenho e proteção próprios.

## Agendamento

Heartbeat oficial `ivEbr4395zxWx2ah9n3CkD`, POST `/api/scheduled/backup`:

```text
0 */5 6-11 * * *
```

Janela 03:00–08:55 de São Paulo, a cada cinco minutos. Uma nova execução completa não inicia antes de 20 horas após a conclusão anterior. A tarefa legada permanece desativada. Nenhum agendamento foi alterado nesta etapa.

O avanço manual exige administrador desbloqueado e processa uma etapa. O endpoint Heartbeat aceita exclusivamente a tarefa técnica autorizada; uma sessão humana não pode substituí-la. Não usar scripts monolíticos, cron local ou endpoints legados como teste deste fluxo.

## Publicação e verificação obrigatórias

As migrações aditivas 0012 e 0013 foram revisadas e aplicadas fora da janela de callbacks, após preservar/encerrar o ciclo parcial antigo. Elas adicionam seis colunas de metadados em `backupRuns` e a tabela `backupHealthAlerts`. Nenhuma tabela de negócio foi alterada por SQL.

1. Publicar o checkpoint desta entrega.
2. Abrir `GET /api/health/backup-protocol` no domínio publicado. Deve retornar `protocolVersion: 2`, `maxSteps: 8`, `stepLease: true`. Essa rota pública informa apenas capacidades, não dados ou credenciais, e não executa backup.
3. Só depois de confirmar a versão publicada, executar um avanço autorizado ou aguardar a janela oficial. Não disparar callbacks contra backend antigo.
4. Confirmar recibos com `protocolVersion: 2` e `stepsProcessed`, ciclo novo com `progressProtocol: 2`, progresso contínuo e ausência de manifesto inconsistente.
5. Aguardar uma conclusão nova; executar validação de todos os objetos. A restauração de 07/11 não valida automaticamente essa nova cópia.
6. Encerrar a aceitação operacional depois de comprovar conclusão na janela, arquivos recuperáveis e avisos funcionando.

## Alertas

O novo handler avalia a idade da última execução completa elegível: ausência ou idade de pelo menos 36 horas gera aviso ao administrador. A tabela `backupHealthAlerts` limita a um registro/aviso por dia UTC, mesmo entre instâncias. Falha no envio fica registrada e não declara sucesso; notificações não são disparadas neste teste.

Esse alerta mede metadados de execução, **não realiza restauração nem comprova integridade dos objetos**. Só roda quando o endpoint é alcançado: indisponibilidade total que impeça todos os callbacks exige monitor independente em etapa posterior. A validação dos avisos reais depende de publicação.

## Retenção e réplica

Nesta etapa **nenhuma cópia original foi apagada**. A política inicial recomendada é manter sete cópias diárias válidas, quatro referências semanais e três mensais, deduplicando uma cópia que cumpra mais de uma faixa. Isso é recomendação, não rotina de exclusão ativa. Só avaliar descarte após o novo fluxo e uma cópia recente estarem validados; arquivos órfãos/invalidos exigem inventário e autorização próprios.

Réplica independente em Google Drive/OneDrive permanece uma próxima etapa. Recuperação do banco, frequência diária, retenção, alerta independente e réplica são critérios distintos; não confundir uma restauração aprovada com maturidade de toda a contingência.
