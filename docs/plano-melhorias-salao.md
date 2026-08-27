# Plano de melhorias do módulo Salão

**Contexto:** plano preparado antes da implementação, para ser iniciado após a validação da implantação histórica e da primeira cópia íntegra do backup.

## Diagnóstico atual

O módulo já possui comandas, mesas, KDS de Cozinha e Bar, envio por lote à produção, pagamentos parciais, transferência de mesa, impressão por departamento e fila de impressão pelo servidor. A fila resolve o acesso do celular do garçom ao computador central; esse item foi marcado como concluído no backlog para evitar duplicidade.

Três melhorias operacionais foram priorizadas pelo gestor. A comanda ainda não registra um identificador de cliente, a interface impede a remoção de item entregue e a análise KDS precisa de correção e revisão. Há dados recentes de produção na A Brasa, mas não há equivalentes na Adega, o que exige que a tela comunique claramente a empresa e o período consultados.

| Tema | Situação | Diretriz |
|---|---|---|
| Identificação de comanda | Mesa, garçom e quantidade de pessoas já existem; nome do cliente não. | Campo opcional `customerLabel`, editável enquanto a comanda estiver aberta e mostrado em Mesas, Comanda, KDS e impressão. |
| Exclusão de item | O backend já cancela por status e preserva histórico; a tela só mostra o comando em situações restritas. | Transformar a ação em cancelamento auditável, com motivo obrigatório fora de rascunho e regras específicas conforme a etapa de produção. |
| Análise KDS | A consulta por período existe; há dados para A Brasa. Os atalhos de período usam uma referência de data inexistente. | Corrigir os atalhos, reforçar estado vazio contextual e validar resultados em Cozinha, Bar e Todos. |

> O cancelamento de item nunca deve apagar o registro. Para itens já enviados, prontos ou entregues, a comanda deve manter quantidade, valor, status, motivo, responsável e horário de cancelamento.

## Escopo da primeira entrega

| Item | Regra de negócio | Efeito em estoque e financeiro |
|---|---|---|
| Nome/identificação do cliente | Texto opcional de até 100 caracteres; não exige cadastro de parceiro. | Nenhum. |
| Cancelar item em comanda aberta | Rascunho: cancelamento simples. Enviado/em preparo/pronto: motivo obrigatório e sinalização no KDS. Entregue: motivo obrigatório e confirmação explícita. | Antes do fechamento, não há venda nem baixa de estoque pelo Salão; o total da comanda é recalculado. |
| Comanda fechada | Não permitir exclusão silenciosa. Exigir fluxo separado de cancelamento/estorno de venda, restrito a administrador. | Exige estorno do movimento de estoque e da venda; fica fora da primeira entrega. |
| Análise KDS | Período, empresa e destino devem estar visíveis; vazio deve informar ausência de itens enviados à produção. | Nenhum. |

## Melhorias que agregam valor após a primeira entrega

| Ordem | Melhoria | Benefício operacional |
|---:|---|---|
| 1 | SLA por item no KDS | Exibe tempo em espera e atraso por Cozinha/Bar, permitindo priorização antes de reclamações. |
| 2 | Linha do tempo da comanda | Facilita saber quem abriu, enviou, preparou, entregou, pagou ou cancelou cada etapa. |
| 3 | Painel de turno | Consolida comandas abertas, atrasos, cancelamentos, taxa de serviço e indicadores por garçom/destino. |
| 4 | Disponibilidade no Salão | Evita adicionar item indisponível sem antecipar baixa de estoque. |
| 5 | Análise de fluxo completo | Mede pedido → produção → pronto → entregue por horário, produto e destino. |
| 6 | Exceções de integração | Trata substituição de item importado do iFood sem alterar a receita original, registrando o que foi efetivamente entregue. |

## Sequência recomendada

1. Publicar e validar o backup incremental; aguardar a primeira cópia íntegra.
2. Corrigir a Análise KDS e validar seus números na empresa A Brasa Reúne.
3. Implementar identificação opcional de cliente e cancelamento auditável de itens em comandas abertas.
4. Validar o fluxo completo com Garçom, KDS Cozinha, KDS Bar e Caixa antes de liberar para rotina.
5. Implementar SLA de produção e painel de turno com base nos eventos auditáveis já disponíveis.
6. Avaliar os recursos de disponibilidade, análises detalhadas e integrações de pedido em ciclo posterior.
