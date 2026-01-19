# Plano de Execução Revisado - Foco em Plano Contábil

**Data:** 19 de janeiro de 2026  
**Versão:** 2.0 (Revisado)  
**Status:** Estratégia Realinhada

---

## Mudança de Estratégia

Após análise crítica, a estratégia anterior de "paralelizar documentação com desenvolvimento" **não é realista** e geraria sobrecarga. 

**Nova Abordagem:** Focar 100% no **Plano Contábil e seus complementos** como prioridade máxima. Documentação e outras pendências ficam para depois.

---

## 1. Por Que Focar no Plano Contábil Agora?

### Razões Técnicas

1. **Janela de Oportunidade:** Você tem poucos lançamentos de despesas (janeiro 2026 em diante)
2. **Impacto Estrutural:** Afeta toda a contabilização futura do sistema
3. **Dependências:** Muitas outras funcionalidades dependem disso (DRE, Margem, Análises)
4. **Complexidade:** Melhor implementar agora com dados limpos do que depois com histórico

### Razões Operacionais

1. **Contador Envolvido:** Você já enviou para análise, está na hora de agir
2. **Contas Gerenciais:** Já estão organizadas, prontas para mapear
3. **Sem Pressão de Produção:** Não há urgência operacional imediata
4. **Equipe Dedicada:** Você pode focar 100% sem distrações

---

## 2. Por Que NÃO Paralelizar Documentação?

### Realidade do Desenvolvimento

| Cenário | Resultado |
|---------|-----------|
| **Fazer Documentação + Desenvolvimento em Paralelo** | Ambas ficam 50% prontas, nenhuma fica boa |
| **Focar 100% em Desenvolvimento** | Documentação fica para depois, mas desenvolvimento é sólido |
| **Focar 100% em Documentação** | Desenvolvimento fica parado, ineficiente |

### Impacto na Qualidade

- Documentação feita "em paralelo" fica superficial e desatualizada
- Desenvolvimento com "metade da atenção" gera bugs e refatorações
- Melhor fazer uma coisa bem do que duas coisas mal

### Recomendação

**Fazer Documentação DEPOIS**, quando o Plano Contábil estiver estável. Aí sim você documenta tudo de uma vez, com conhecimento fresco e completo.

---

## 3. Novo Plano de Execução - Foco Total em Plano Contábil

### 📅 SEMANA 1 (19-23 de janeiro)

**Objetivo:** Preparar e implementar Fase 1 do Plano Contábil

| Dia | Tarefa | Esforço | Descrição |
|-----|--------|---------|-----------|
| **Seg 19** | Confirmação Contador | 1h | Validar estrutura proposta com contador |
| **Ter 20** | Schema - Tabelas Contábeis | 3h | Criar `accountingMappings`, `revenueAccounts`, `loans` |
| **Qua 21** | Schema - Campos Adicionais | 2h | Adicionar `accountingCode` a expenses, sales, purchases |
| **Qui 22** | Endpoints de Mapeamento | 2h | Criar endpoints para gerenciar contas contábeis |
| **Sex 23** | Testes e Validação | 2h | Testar integração e gerar DRE de teste |
| | **TOTAL SEMANA 1** | **10h** | |

**Resultado:** Plano Contábil Fase 1 implementado e testado

---

### 📅 SEMANA 2 (26-30 de janeiro)

**Objetivo:** Implementar Receitas e Corrigir Perdas

| Dia | Tarefa | Esforço | Descrição |
|-----|--------|---------|-----------|
| **Seg 26** | Receitas - Mapeamento por Canal | 3h | Implementar `revenueAccounts` para Balcão/A Prazo/Delivery |
| **Ter 27** | Receitas - Endpoint de Vendas | 3h | Modificar endpoint de vendas para registrar `accountingCode` |
| **Qua 28** | Perdas - Reescrever Lógica | 4h | Implementar Perdas com contabilização automática |
| **Qui 29** | Perdas - Testes | 2h | Testar fluxo completo de Perdas |
| **Sex 30** | Validação e Ajustes | 2h | Testar DRE com receitas e perdas |
| | **TOTAL SEMANA 2** | **14h** | |

**Resultado:** Receitas mapeadas + Perdas funcionando com contabilização

---

### 📅 SEMANA 3 (02-06 de fevereiro)

**Objetivo:** Implementar Estoque/CMV e Empréstimos

| Dia | Tarefa | Esforço | Descrição |
|-----|--------|---------|-----------|
| **Seg 02** | Estoque - Tabelas | 3h | Criar `inventoryAccounts` e `loans` |
| **Ter 03** | Estoque - Integração Compras | 4h | Registrar `accountingCode` em compras |
| **Qua 04** | CMV - Cálculo na Venda | 4h | Implementar cálculo automático de CMV |
| **Qui 05** | Empréstimos - Endpoints | 2h | Criar endpoints para gerenciar empréstimos |
| **Sex 06** | Testes e Validação | 3h | Testar DRE completo com CMV |
| | **TOTAL SEMANA 3** | **16h** | |

**Resultado:** Estoque/CMV e Empréstimos implementados

---

### 📅 SEMANA 4 (09-13 de fevereiro)

**Objetivo:** Contas Patrimoniais e DRE Completo

| Dia | Tarefa | Esforço | Descrição |
|-----|--------|---------|-----------|
| **Seg 09** | Patrimonial - Tabelas | 3h | Criar `cashMovements`, `bankAccounts`, `bankMovements` |
| **Ter 10** | Patrimonial - Integração | 4h | Integrar com movimentação de caixa |
| **Qua 11** | DRE - Queries Finais | 3h | Criar queries para gerar DRE completo |
| **Qui 12** | Balanço Patrimonial | 4h | Criar queries para gerar Balanço Patrimonial |
| **Sex 13** | Testes Finais | 2h | Validar DRE + Balanço |
| | **TOTAL SEMANA 4** | **16h** | |

**Resultado:** Plano Contábil 100% completo com DRE e Balanço

---

## 4. Resumo de Esforço

| Fase | Semana | Esforço | Status |
|------|--------|---------|--------|
| **Fase 1: Mapeamento Contábil** | Semana 1 | 10h | ✅ Imediato |
| **Fase 2: Receitas + Perdas** | Semana 2 | 14h | ✅ Sequencial |
| **Fase 3: Estoque + Empréstimos** | Semana 3 | 16h | ✅ Sequencial |
| **Fase 4: Patrimonial + DRE** | Semana 4 | 16h | ✅ Sequencial |
| **TOTAL** | **4 semanas** | **56h** | |

**Tempo com 8h/dia:** ~7 dias de trabalho dedicado  
**Tempo com 4h/dia:** ~14 dias de trabalho dedicado

---

## 5. O Que Fazer com as Outras Pendências?

### 🔴 Críticas (Não Relacionadas ao Plano Contábil)

- **Produtos Vencendo:** Deixar para depois (não impacta agora)
- **Bug Perdas:** Será corrigido na Semana 2 junto com Plano Contábil

### 🟡 Altas (Podem Esperar)

- **Novos Quadros:** Fazer DEPOIS do Plano Contábil (Semana 5)
- **Exportar Relatórios:** Fazer DEPOIS do Plano Contábil (Semana 5)
- **WhatsApp Template:** Fazer DEPOIS do Plano Contábil (Semana 5)
- **Histórico de Logs:** Fazer DEPOIS do Plano Contábil (Semana 6)

### 📚 Documentação

**Fazer DEPOIS de tudo estar estável:**
- Semana 5-6 (após Plano Contábil estar 100% pronto)
- Aí sim você documenta com conhecimento completo
- Evita documentar coisas que vão mudar

### 🟢 Baixas (Muito Depois)

- Otimizações, UX, Melhorias gerais
- Fazer em março/abril

---

## 6. Pré-Requisitos Antes de Começar

### ✅ Confirmação do Contador

**Você precisa confirmar com o contador:**

1. ✅ Estrutura de contas contábeis proposta está correta?
2. ✅ Receitas por tipo (Balcão/A Prazo/Delivery) está correto?
3. ✅ Precisa de conta de Empréstimo?
4. ✅ Contas Patrimoniais devem ser rastreadas?
5. ✅ Data de início: 01/01/2026 ou 01/02/2026?

**Ação:** Envie o documento `RESPOSTAS_TECNICAS_PLANO_CONTABIL.md` para o contador validar

### ✅ Preparação do Banco de Dados

Antes de começar a Semana 1:
- [ ] Backup completo do banco de dados
- [ ] Criar branch de desenvolvimento para Plano Contábil
- [ ] Validar que não há dados conflitantes em janeiro 2026

---

## 7. Resultado Final

### Após 4 Semanas

Você terá:

✅ **Plano Contábil Completo**
- 50 contas gerenciais mapeadas
- Receitas por canal registradas
- Custos operacionais rastreados
- Empréstimos controlados
- Contas patrimoniais registradas

✅ **DRE Automático**
- Receita Bruta
- Receita Líquida
- Lucro Bruto
- Resultado Operacional
- Resultado Líquido

✅ **Balanço Patrimonial**
- Ativo Circulante
- Ativo Não Circulante
- Passivo Circulante
- Patrimônio Líquido

✅ **Bug de Perdas Corrigido**
- Perdas registram corretamente
- Contabilização automática
- Estoque atualizado

---

## 8. Recomendação Final

### ✅ COMECE AGORA

**Ação Imediata (Hoje 19/01):**

1. Enviar `RESPOSTAS_TECNICAS_PLANO_CONTABIL.md` para contador validar
2. Agendar reunião com contador para confirmar estrutura
3. Preparar backup do banco de dados

**Próxima Segunda (20/01):**

1. Confirmação do contador
2. Começar Semana 1 - Implementação Fase 1

### ⏸️ PAUSAR

- Documentação (fazer depois)
- Novos Quadros (fazer depois)
- Produtos Vencendo (fazer depois)
- Outras melhorias (fazer depois)

### 📊 Foco Total

**100% de atenção no Plano Contábil pelas próximas 4 semanas**

---

**Você concorda com essa abordagem?** Se sim, posso começar hoje mesmo com a Fase 1.

---

**Documento preparado por:** Manus AI  
**Data:** 19 de janeiro de 2026  
**Próxima Revisão:** 20 de janeiro (após confirmação do contador)
