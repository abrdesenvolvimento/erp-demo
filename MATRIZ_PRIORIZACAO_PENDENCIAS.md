# Matriz de Priorização de Pendências - ERP Adega Beira Rio

**Data:** 15 de janeiro de 2026  
**Versão:** 1.0  
**Total de Pendências:** 24 itens

---

## Resumo Executivo

O projeto tem **24 pendências** distribuídas em 4 categorias: Críticas (4), Altas (8), Médias (7) e Baixas (5). A recomendação é começar pelas críticas que bloqueiam o funcionamento, depois as altas que agregam valor imediato.

---

## 1. Matriz de Priorização Completa

| # | Pendência | Categoria | Prioridade | Impacto | Esforço | Risco | Status |
|---|-----------|-----------|-----------|---------|---------|-------|--------|
| **19** | Despesas - Perdas não registra | Funcional | 🔴 CRÍTICO | Alto | 2h | Baixo | ❌ Bloqueante |
| **18** | Produtos Vencendo - Dados inconsistentes | Funcional | 🔴 CRÍTICO | Alto | 3h | Médio | ❌ Bloqueante |
| **23.1** | Plano Contábil - Mapeamento (Fase 1) | Financeiro | 🔴 CRÍTICO | Alto | 8h | Médio | ⏳ Aguardando |
| **5** | Documentação do Sistema ("Livro") | Operacional | 🔴 CRÍTICO | Alto | 20h | Baixo | ❌ Não iniciado |
| **20** | Tela Fechamento - Novos Quadros | Análise | 🟡 ALTO | Alto | 8h | Baixo | ❌ Não iniciado |
| **23.2** | Plano Contábil - Receitas (Fase 2) | Financeiro | 🟡 ALTO | Alto | 12h | Médio | ⏳ Aguardando |
| **2** | Exportar Relatórios | Funcional | 🟡 ALTO | Médio | 6h | Baixo | ⏳ Parcial |
| **3** | Histórico de Log (Auditoria) | Operacional | 🟡 ALTO | Médio | 10h | Médio | ❌ Não iniciado |
| **1** | Catálogo Digital + Integração | Integração | 🟡 ALTO | Médio | 12h | Alto | ❌ Não iniciado |
| **11** | WhatsApp - Configuração Template | Integração | 🟡 ALTO | Médio | 4h | Baixo | ⏳ Bloqueado |
| **23.3** | Plano Contábil - Estoque/CMV (Fase 3) | Financeiro | 🟠 MÉDIO | Médio | 16h | Médio | ⏳ Aguardando |
| **6** | Configuração do DRE | Financeiro | 🟠 MÉDIO | Médio | 8h | Médio | ❌ Não iniciado |
| **23.4** | Plano Contábil - Patrimonial (Fase 4) | Financeiro | 🟠 MÉDIO | Médio | 20h | Alto | ⏳ Aguardando |
| **7** | Impressão de Fechamento | Funcional | 🟠 MÉDIO | Baixo | 3h | Baixo | ❌ Não iniciado |
| **24** | Validação com Contador | Operacional | 🟠 MÉDIO | Alto | 2h | Baixo | ⏳ Aguardando |
| **94** | Otimizar Performance | Técnico | 🟢 BAIXO | Baixo | 10h | Médio | ❌ Não iniciado |
| **99** | UX/Interface - Melhorias | UX | 🟢 BAIXO | Baixo | 8h | Baixo | ❌ Não iniciado |
| **100** | Comparar Quantidade entre Canais | Análise | 🟢 BAIXO | Baixo | 4h | Baixo | ❌ Não iniciado |
| **101** | Sistema de Comissões | Funcional | 🟢 BAIXO | Médio | 8h | Médio | ❌ Não iniciado |
| **102** | Card Ticket Médio | Análise | 🟢 BAIXO | Baixo | 2h | Baixo | ❌ Não iniciado |
| **103** | Alertas Estoque Crítico | Notificação | 🟢 BAIXO | Médio | 4h | Baixo | ❌ Não iniciado |
| **104** | Notificações Push | Notificação | 🟢 BAIXO | Baixo | 6h | Médio | ❌ Não iniciado |
| **105** | Importação XML Notas Fiscais | Integração | 🟢 BAIXO | Médio | 12h | Alto | ❌ Não iniciado |
| **106** | Segurança - 2FA e Logs | Segurança | 🟢 BAIXO | Médio | 8h | Médio | ❌ Não iniciado |

---

## 2. Agrupamento por Categoria

### 🔴 CRÍTICAS (4 itens) - Bloqueantes

Estas pendências impedem o funcionamento correto do sistema:

| # | Pendência | Esforço | Impacto | Recomendação |
|---|-----------|---------|---------|--------------|
| **19** | Despesas - Perdas não registra | 2h | Alto | ✅ FAZER HOJE |
| **18** | Produtos Vencendo - Dados inconsistentes | 3h | Alto | ✅ FAZER HOJE |
| **23.1** | Plano Contábil - Mapeamento (Fase 1) | 8h | Alto | ⏳ AGUARDAR CONTADOR |
| **5** | Documentação do Sistema | 20h | Alto | ✅ FAZER ESTA SEMANA |

**Tempo Total:** 33h (4 dias)

**Ação Imediata:**
1. Corrigir bug de Perdas (2h)
2. Validar dados de produtos vencendo (3h)
3. Iniciar documentação do sistema (20h paralelo)
4. Aguardar confirmação do contador para Plano Contábil

---

### 🟡 ALTAS (8 itens) - Agregam Valor

Estas pendências agregam valor significativo e devem ser feitas após as críticas:

| # | Pendência | Esforço | Impacto | Recomendação |
|---|-----------|---------|---------|--------------|
| **20** | Tela Fechamento - Novos Quadros | 8h | Alto | ✅ FAZER SEMANA 2 |
| **23.2** | Plano Contábil - Receitas (Fase 2) | 12h | Alto | ⏳ APÓS FASE 1 |
| **2** | Exportar Relatórios | 6h | Médio | ✅ FAZER SEMANA 2 |
| **3** | Histórico de Log (Auditoria) | 10h | Médio | ✅ FAZER SEMANA 3 |
| **1** | Catálogo Digital + Integração | 12h | Médio | ⏳ AVALIAR ESCOPO |
| **11** | WhatsApp - Configuração Template | 4h | Médio | ✅ FAZER SEMANA 2 |

**Tempo Total:** 52h (6-7 dias)

**Sequência Recomendada:**
1. Semana 2: Novos Quadros (8h) + Exportar Relatórios (6h) + WhatsApp (4h) = 18h
2. Semana 3: Histórico de Log (10h) + Plano Contábil Fase 2 (12h) = 22h
3. Avaliar Catálogo Digital (escopo pode ser grande)

---

### 🟠 MÉDIAS (7 itens) - Importantes

Estas pendências são importantes mas não urgentes:

| # | Pendência | Esforço | Impacto | Recomendação |
|---|-----------|---------|---------|--------------|
| **23.3** | Plano Contábil - Estoque/CMV (Fase 3) | 16h | Médio | ⏳ APÓS FASE 2 |
| **6** | Configuração do DRE | 8h | Médio | ⏳ APÓS FASE 1 |
| **23.4** | Plano Contábil - Patrimonial (Fase 4) | 20h | Médio | ⏳ APÓS FASE 3 |
| **7** | Impressão de Fechamento | 3h | Baixo | ✅ FAZER RÁPIDO |
| **24** | Validação com Contador | 2h | Alto | ⏳ BLOQUEANTE |

**Tempo Total:** 49h (6 dias)

**Sequência Recomendada:**
1. Impressão de Fechamento (3h) - Rápido, baixo risco
2. Plano Contábil Fase 3 (16h) - Após Fase 2
3. Plano Contábil Fase 4 (20h) - Após Fase 3
4. Configuração DRE (8h) - Paralelo com Fase 1

---

### 🟢 BAIXAS (5 itens) - Melhorias

Estas pendências são melhorias que podem ser feitas depois:

| # | Pendência | Esforço | Impacto | Recomendação |
|---|-----------|---------|---------|--------------|
| **94** | Otimizar Performance | 10h | Baixo | ⏳ MÊS QUE VEM |
| **99** | UX/Interface - Melhorias | 8h | Baixo | ⏳ MÊS QUE VEM |
| **100** | Comparar Quantidade entre Canais | 4h | Baixo | ⏳ MÊS QUE VEM |
| **101** | Sistema de Comissões | 8h | Médio | ⏳ AVALIAR NECESSIDADE |
| **102** | Card Ticket Médio | 2h | Baixo | ⏳ RÁPIDO |

**Tempo Total:** 32h (4 dias)

**Sequência Recomendada:**
- Fazer depois de resolver as altas
- Card Ticket Médio (2h) é rápido e pode ser feito em paralelo

---

## 3. Plano de Execução Recomendado

### 📅 SEMANA 1 (15-19 de janeiro)

**Objetivo:** Resolver bloqueantes e iniciar documentação

| Dia | Tarefa | Esforço | Prioridade |
|-----|--------|---------|-----------|
| **Seg 15** | Corrigir bug Perdas (19) | 2h | 🔴 CRÍTICO |
| **Seg 15** | Validar produtos vencendo (18) | 3h | 🔴 CRÍTICO |
| **Ter 16** | Iniciar documentação (5) | 6h | 🔴 CRÍTICO |
| **Qua 17** | Documentação (5) | 6h | 🔴 CRÍTICO |
| **Qui 18** | Documentação (5) | 6h | 🔴 CRÍTICO |
| **Sex 19** | Documentação (5) + Revisão | 2h | 🔴 CRÍTICO |
| | **TOTAL SEMANA 1** | **25h** | |

**Resultado:** Bugs corrigidos + Documentação iniciada

---

### 📅 SEMANA 2 (22-26 de janeiro)

**Objetivo:** Implementar novos quadros e melhorias de integração

| Dia | Tarefa | Esforço | Prioridade |
|-----|--------|---------|-----------|
| **Seg 22** | Novos Quadros (20) | 4h | 🟡 ALTO |
| **Ter 23** | Novos Quadros (20) | 4h | 🟡 ALTO |
| **Qua 24** | Exportar Relatórios (2) | 6h | 🟡 ALTO |
| **Qui 25** | WhatsApp Template (11) | 4h | 🟡 ALTO |
| **Sex 26** | Testes e Ajustes | 2h | |
| | **TOTAL SEMANA 2** | **20h** | |

**Resultado:** Novos quadros + Relatórios exportáveis + WhatsApp configurado

---

### 📅 SEMANA 3 (29-02 de janeiro)

**Objetivo:** Implementar Plano Contábil Fase 1 e Histórico de Logs

| Dia | Tarefa | Esforço | Prioridade |
|-----|--------|---------|-----------|
| **Seg 29** | Aguardar confirmação contador | - | ⏳ BLOQUEANTE |
| **Ter 30** | Plano Contábil Fase 1 (23.1) | 4h | 🔴 CRÍTICO |
| **Qua 31** | Plano Contábil Fase 1 (23.1) | 4h | 🔴 CRÍTICO |
| **Qui 01** | Histórico de Log (3) | 5h | 🟡 ALTO |
| **Sex 02** | Histórico de Log (3) | 5h | 🟡 ALTO |
| | **TOTAL SEMANA 3** | **18h** | |

**Resultado:** Plano Contábil Fase 1 implementado + Auditoria de logs

---

### 📅 SEMANA 4+ (Fevereiro)

**Objetivo:** Completar Plano Contábil e Melhorias

| Período | Tarefa | Esforço | Prioridade |
|---------|--------|---------|-----------|
| **Fev 1-2** | Plano Contábil Fase 2 (23.2) | 12h | 🟡 ALTO |
| **Fev 3-4** | Impressão Fechamento (7) | 3h | 🟠 MÉDIO |
| **Fev 5-7** | Plano Contábil Fase 3 (23.3) | 16h | 🟠 MÉDIO |
| **Fev 8-10** | Plano Contábil Fase 4 (23.4) | 20h | 🟠 MÉDIO |
| **Fev 11+** | Melhorias Baixas (94-106) | 32h | 🟢 BAIXO |

---

## 4. Dependências e Bloqueadores

### Bloqueadores Externos

| Item | Bloqueador | Status | Ação |
|------|-----------|--------|------|
| **23.1** | Confirmação do contador | ⏳ Aguardando | Enviar documento para análise |
| **11** | Template WhatsApp aprovado | ⏳ Aguardando | Acompanhar aprovação Meta |
| **1** | Escopo Catálogo Digital | ⏳ Indefinido | Reunião com stakeholders |

### Dependências Internas

```
19 (Perdas) ✅
    ↓
18 (Produtos Vencendo) ✅
    ↓
23.1 (Plano Contábil Fase 1) ⏳
    ↓
23.2 (Plano Contábil Fase 2) ⏳
    ↓
23.3 (Plano Contábil Fase 3) ⏳
    ↓
23.4 (Plano Contábil Fase 4) ⏳
```

---

## 5. Recomendação Final

### ✅ COMEÇAR AGORA (Hoje 15/01)

1. **Corrigir bug Perdas** (2h) - Bloqueante, simples
2. **Validar produtos vencendo** (3h) - Bloqueante, simples
3. **Iniciar documentação** (20h) - Crítico, pode ser feito em paralelo

### ⏳ FAZER SEMANA QUE VEM (22-26/01)

1. **Novos Quadros de Análise** (8h) - Alto impacto
2. **Exportar Relatórios** (6h) - Alto impacto
3. **WhatsApp Template** (4h) - Integração importante

### 🎯 PRIORIDADE MÁXIMA (Após confirmação contador)

1. **Plano Contábil Fase 1** (8h) - Crítico para contabilidade
2. **Histórico de Logs** (10h) - Auditoria importante

### 📚 DOCUMENTAÇÃO

- Iniciar hoje em paralelo
- Pode ser feita enquanto aguarda confirmação do contador
- Essencial para manutenção futura

---

## 6. Estimativa de Tempo Total

| Categoria | Itens | Esforço | Tempo (dias) |
|-----------|-------|---------|-------------|
| 🔴 Críticas | 4 | 33h | 4 dias |
| 🟡 Altas | 8 | 52h | 6-7 dias |
| 🟠 Médias | 7 | 49h | 6 dias |
| 🟢 Baixas | 5 | 32h | 4 dias |
| **TOTAL** | **24** | **166h** | **20-21 dias** |

**Tempo com paralelização:** ~15 dias (3 semanas)

---

## 7. Conclusão

**Recomendação:** Comece hoje com os bugs críticos (2h) e a documentação (20h em paralelo). Depois siga o plano de 4 semanas para resolver todas as pendências em ordem de impacto e dependência.

O Plano Contábil é crítico mas está bloqueado pela confirmação do contador. Enquanto isso, implemente os novos quadros e melhorias de integração que agregam valor imediato.

---

**Documento preparado por:** Manus AI  
**Data:** 15 de janeiro de 2026  
**Próxima Revisão:** 22 de janeiro de 2026
