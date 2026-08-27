# Varredura Geral de Pendências — ABRWF

**Data da revisão:** 26/08/2026  
**Escopo:** estado funcional do ERP, pendências registradas, riscos operacionais e decisão de publicação.

## Resumo executivo

O backlog registra **182 itens abertos em 54 seções** e **1.408 itens concluídos**. Ele reúne correções antigas, melhorias futuras, decisões comerciais e tarefas já parcialmente superadas por checkpoints recentes. Portanto, o total não representa 182 defeitos ativos.

O ponto de maior prioridade é a **contingência de backup**. A nova implementação já foi validada localmente com uma etapa real de 10.000 linhas (aproximadamente 1,49 MB), mas ainda precisa ser publicada e ter o Heartbeat ajustado para realizar várias etapas curtas em uma janela noturna. A publicação não deve ocorrer pelo checkpoint anterior; o checkpoint final deverá incluir a correção complementar que impede ciclos completos consecutivos quando o Heartbeat passar a executar com maior frequência.

| Estado | Situação |
|---|---|
| Faturamento histórico Adega, 12 a 23/08 | Concluído e publicado gerencialmente; falta apenas apurar 24/08. |
| Baixas de estoque pelo Excel de 22 e 23/08 | Concluídas somente para produtos com correspondência exata; exceções preservadas. |
| Isolamento Adega / A Brasa no filtro Salão | Corrigido no backend e coberto por teste focado. |
| Backup diário antigo | Inadequado: 68 execuções registradas e as recentes terminaram por timeout. |
| Backup incremental novo | Implementado e validado em desenvolvimento; requer novo checkpoint, publicação e atualização do Heartbeat. |

> **Regra de publicação:** só atualizar o Heartbeat depois que a versão com o novo callback estiver publicada. Assim o agendador nunca chamará uma rota inexistente ou a implementação monolítica antiga.

## Prioridade 0 — antes e imediatamente após a publicação

| Item | Situação encontrada | Próxima ação segura | Dependência |
|---|---|---|---|
| Cadência do backup incremental | A implementação inicial precisava de proteção para não criar ciclos completos contínuos caso o job seja chamado várias vezes. A regra de intervalo mínimo de 20 horas foi adicionada nesta revisão. | Salvar checkpoint atualizado, publicar e configurar janela noturna de etapas curtas. | Publicação do usuário. |
| Job Heartbeat de backup | O job atual executa diariamente às 03:00 BRT e acumulou timeouts. | Após publicar, trocar a agenda para cada 5 minutos entre 03:00 e 08:55 BRT, retomando o mesmo backup até concluir. | Publicação concluída. |
| Teste de restauração | Há checksum e manifesto, mas ainda não há restauração controlada em ambiente separado. | Criar procedimento de restauração e teste periódico antes de considerar a contingência madura. | Backup incremental concluído. |
| Alerta de ausência de cópia válida | Os 107 logs antigos foram reconciliados como falhos; não há alerta automático de SLA ainda. | Notificar o administrador quando não houver backup íntegro recente. | Definir canal de alerta. |
| Produção após publicação | O backlog registra ocorrência anterior de dashboard zerado em produção por versão desatualizada. | Conferir login, empresa ativa, dashboard, calendário e a primeira execução do Heartbeat após publicar. | Publicação concluída. |

## Prioridade 1 — integridade de dados e continuidade operacional

Esses pontos devem ser tratados antes de ampliar módulos comerciais ou automações. Eles mexem com dados financeiros, operação de salão e rastreabilidade.

| Frente | Pendência | Observação e encaminhamento |
|---|---|---|
| Faturamento histórico | Apurar e implantar 24/08. | É a única data pendente no bloco de Balcão da Adega. Aplicar como ajuste agregado e auditável, salvo se surgir detalhamento suficiente. |
| Faturamento histórico | Exceções do Excel de 22 e 23/08. | Permanecem fora do estoque por não terem correspondência exata. Revisar juntos antes de criar produto, mapear variante ou ajustar manualmente. |
| Histórico A Prazo / A Brasa Salão | Reconstrução quando houver base detalhada. | Não criar vendas fictícias: usar detalhe real por produto somente se houver origem confiável. |
| Contabilidade | Receitas em conta errada, divergências entre DRE, vendas, CMV e despesas. | São pendências históricas, com referências principalmente a janeiro. Exigem diagnóstico contábil próprio e aprovação antes de qualquer reprocessamento. |
| Compras em produção | Erro de validação ao confirmar compra. | Validar no ambiente publicado depois da atualização. Priorizar se ainda reproduzir. |
| Timezone | Casos de virada de dia, mês e ano. | Auditar após o backup; é relevante para faturamento diário e fechamentos. |
| Auditoria | Log de ações e histórico de produto. | Evolução recomendada para compras, vendas, despesas e recebimentos após estabilizar backup. |

## Prioridade 2 — operação da A Brasa e usabilidade

| Frente | Pendências agrupadas | Decisão recomendada |
|---|---|---|
| Salão / KDS / garçom | Revisar consultas críticas, cold start e carregamento inicial. | Fazer uma rodada de testes operacionais no horário de menor movimento e medir as telas mais usadas. |
| Impressão remota de comandas | Celular do garçom não alcança o agente local; foi proposta uma fila de impressão no servidor. | Tratar como projeto próprio, pois envolve agente instalado e autenticação de jobs. |
| Responsividade | Sidebar, tabelas longas e formulários de venda em celular. | Mapear primeiro as três telas mais utilizadas: Dashboard, Vendas e Fechamento. |
| Impressão de fechamento | Layout A4 e logo por empresa. | Melhoria de apresentação; sem risco operacional imediato. |

## Prioridade 3 — evolução financeira, comercial e produto

| Frente | Escopo pendente | Natureza |
|---|---|---|
| Conciliação bancária | Importar OFX/CSV, conciliar e gerar relatório. | Novo módulo financeiro. |
| Alertas de vencimento | Regras de antecedência, painel e notificações. | Exige definir canal e política de comunicação. |
| Relatório de juros e descontos | Visão mensal e por fornecedor. | Nova análise financeira. |
| Catálogo digital | Definir se é público, quais preços/estoque expor e se gera pedido. | Decisão de negócio antes de implementação. |
| WhatsApp Business | Templates, casos de uso e eventos integrados. | Integração externa e decisão operacional. |
| Perfis, pacotes e comercialização | Perfis intermediários, permissões granulares e isolamento de clientes externos. | Projeto de produto/multi-tenant; não é correção imediata. |
| Histórico de preços | Registro de preço/custo e gráfico. | Evolução de auditoria e margem. |

## Pendências de decisão do gestor

| Decisão | Quando decidir | Efeito |
|---|---|---|
| Valor de faturamento de 24/08 | Assim que a apuração estiver pronta. | Fecha a implantação histórica da Adega no período recuperado. |
| Canal de alerta do backup | Antes do alerta automático. | Define se o aviso será interno, e-mail ou outro canal. |
| Replicação externa | Depois da primeira cópia incremental completa. | Avaliar Google via OAuth ou OneDrive; não reutilizar a conta de serviço atual no Drive pessoal, pois a escrita falhou por quota. |
| Auditoria contábil histórica | Antes de reprocessar janeiro ou limpar journals. | Evita alterar DRE e livros sem conciliação/documentação. |
| Escopo de catálogo e comercialização | Antes de desenvolvimento dessas frentes. | Evita construir permissões, multi-tenant ou catálogo com regra de negócio indefinida. |

## Sequência recomendada

1. **Finalizar o checkpoint atualizado do backup**, contendo a proteção de cadência adicionada nesta varredura.
2. **Publicar a nova versão** e executar a checagem funcional básica em produção.
3. **Atualizar o Heartbeat** para uma janela noturna de etapas curtas, preservando um único ciclo ativo até a conclusão.
4. **Acompanhar a primeira cópia íntegra**, verificando manifesto, checksums, logs e a não existência de novos registros presos.
5. **Implantar 24/08** quando o valor estiver apurado e registrar suas exceções de produto, se houver.
6. **Implementar alerta e teste de restauração**; então escolher e configurar a réplica independente em Google OAuth ou OneDrive.
7. Iniciar uma trilha separada de **auditoria contábil histórica** e, em paralelo, a revisão operacional de Salão/KDS.

## Validações realizadas nesta varredura

| Verificação | Resultado |
|---|---|
| Repositório | Somente `todo.md` foi alterado após o último checkpoint; os artefatos da varredura estão fora da raiz versionada. |
| Checkpoints recentes | Há checkpoints separados para faturamento histórico, baixa de estoque e backup incremental. |
| Testes focados | 9 testes passaram: backup incremental, parcelas históricas e baixa histórica de estoque. |
| Backup incremental | Uma execução de validação permaneceu ativa com 3 chunks, 10.039 linhas exportadas e manifesto persistido. |
| Chunk volumoso | A exportação de 10.000 linhas de `accountingEntries` foi concluída com aproximadamente 1,49 MB, dentro do ambiente atual. |
| Logs históricos | 107 registros estão como falhos/reconciliados, 2 sucessos antigos permanecem registrados e 1 log em execução corresponde à validação incremental atual. |
| Heartbeat atual | O job de backup continua no cron diário antigo até a publicação; o keep-alive está ativo. |

## Conclusão

O ERP não deve ser guiado pelo volume bruto de 182 pendências. A prioridade racional é **integridade, recuperação e operação**: publicar a correção final do backup, validar a primeira cópia completa, concluir 24/08 e somente depois avançar para réplica externa, auditoria contábil e melhorias de produto. As frentes de catálogo, comercialização e expansão de permissões devem ser conduzidas como projetos separados, após definição de escopo.
