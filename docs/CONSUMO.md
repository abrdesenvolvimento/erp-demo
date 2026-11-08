# Consumo interno — primeira entrega

## Objetivo

Registrar produtos consumidos por funcionários, identificando pessoa, produtos, quantidades, motivo e responsável pela baixa. O registro não cria venda, faturamento, contas a receber ou pagamento. O custo registrado é um controle operacional; não gera lançamento contábil ou despesa automaticamente nesta etapa.

O módulo fica em **Consumo** no menu principal. Adega e A Brasa usam a mesma funcionalidade, com dados estritamente separados por empresa. Os consumos e suas baixas pertencem à filial ativa. O cadastro de funcionários pertence à empresa e pode ser compartilhado entre suas filiais, sem depender de uma conta de login.

## Como utilizar

1. Selecione a empresa e a filial corretas.
2. Um administrador cadastra os funcionários pelo botão **Funcionários**. É possível renomear, desativar e reativar; o histórico não é excluído.
3. Clique em **Registrar consumo**, escolha o funcionário ativo e adicione os produtos e quantidades.
4. Informe o motivo e revise os itens.
5. Confirme a baixa de estoque. O sistema calcula e grava o custo definitivo, junto dos responsáveis.
6. Consulte o acompanhamento por período, funcionário e status. Os detalhes preservam os nomes e custos do momento do registro.

Os indicadores de custo, lançamentos e unidades consideram somente consumos ativos dentro dos filtros. Cancelados continuam visíveis no histórico, mas deixam de compor esses indicadores. O resumo por funcionário abrange todo o período filtrado, não apenas a página da lista.

## Cancelamento e correção

Um administrador pode cancelar um consumo com motivo obrigatório. O estorno repõe uma única vez exatamente os produtos e quantidades que foram baixados, usando o registro original — não a composição atual do produto. O consumo, seus itens, custo, responsável e motivo permanecem no histórico.

Não existe exclusão física nem edição de quantidades em um consumo já lançado. Para corrigir, cancele com justificativa e faça um novo registro correto.

## Proteções

- Sessão ativa e desbloqueada obrigatória, com as regras de PIN e login diário já existentes.
- Empresa e filial do formulário devem coincidir com o contexto autorizado no servidor.
- Quantidades, disponibilidade, composição e custo são revalidados no servidor.
- Produtos simples baixam seu próprio saldo. Compostos baixam os componentes finais da composição.
- Componentes iguais são somados antes da validação de estoque, evitando consumo maior que o saldo disponível.
- Estoque insuficiente bloqueia todo o registro. Esta entrega não autoriza saldos negativos.
- Gravação, movimentos e saldos são transacionais. Falhas desfazem o conjunto da operação.
- A mesma solicitação não gera duas baixas: a chave de repetição é mantida em tentativas de reenvio e validada no banco.
- O cancelamento é protegido contra estorno repetido.

## Permissões

| Perfil | Consultar | Registrar | Gerenciar funcionários | Cancelar com estorno |
|---|---|---|---|---|
| Administrador | Sim | Sim | Sim | Sim |
| Operacional | Sim, no contexto autorizado | Sim, no contexto autorizado | Não | Não |
| Consultor | Sim, no contexto autorizado | Não | Não | Não |
| Outros perfis | Não | Não | Não | Não |

## Limites e custos

O saldo de estoque do ERP atual é inteiro. Por isso, o formulário aceita unidades inteiras. Uma composição só é aceita quando a baixa final agregada de cada componente resulta em quantidade inteira exata; não se arredonda estoque fracionado silenciosamente. Composições incompatíveis exigem adequação do cadastro/unidades antes de usar Consumo.

O custo definitivo usa o custo médio dos componentes efetivamente baixados, preservado no registro. A soma dos custos dos itens é reconciliada em centavos com o custo dos componentes. Para compostos, a interface não trata o custo do produto pai como definitivo. Produtos com custo médio zero continuarão com custo zero: mantenha os custos de entrada/cadastro atualizados para obter um acompanhamento útil.

Na primeira entrega não há cobrança do funcionário, limite individual, aprovação prévia, recorrência, desconto em folha ou contabilização automática. Também não se alteram os dados financeiros históricos.

## Validação e publicação

As tabelas foram adicionadas sem movimentar estoque real ou cadastrar funcionários fictícios. Os testes automatizados de baixa/estorno usam banco simulado; os testes de interface interceptam todas as APIs. Consultas reais de conferência são somente leitura. A versão precisa ser publicada pelo responsável para disponibilizar o módulo no domínio operacional.
