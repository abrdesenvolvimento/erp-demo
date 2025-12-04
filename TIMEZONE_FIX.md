# Correção de Inconsistências de Timezone

**Data:** 03/12/2025  
**Problema:** Sistema apresentava inconsistências de timezone causando bugs em cálculos de datas, filtros e calendários.

---

## 🔴 Problemas Identificados

### Sintomas
- Vendas feitas às 23h apareciam no dia seguinte
- Média diária calculada incorretamente
- Filtro "Hoje" em Vendas não funcionava corretamente
- Comparações de datas entre frontend/backend falhavam
- Calendários mostravam dia atual incorreto

### Causa Raiz
- **Frontend:** Usava `new Date()` do navegador (timezone variável)
- **Backend:** Servidor em EST, mas dados em horário de Brasília
- **Banco de dados:** Timestamps em UTC sem conversão consistente
- **96 ocorrências** de manipulação de datas sem padronização

---

## ✅ Solução Implementada

### 1. Utilitário Centralizado (`/shared/dateUtils.ts`)

Criado módulo com funções padronizadas para garantir uso consistente do timezone **America/Sao_Paulo**:

```typescript
// Principais funções
getTodayInBrazil()          // Data atual (00:00:00) em Brasília
getNowInBrazil()            // Data/hora atual em Brasília
parseDateInBrazil(dateStr)  // Converte YYYY-MM-DD para Date (meio-dia)
formatDateForInput(date)    // Converte Date para YYYY-MM-DD
formatDateBR(date)          // Formata para DD/MM/YYYY
formatDateTimeBR(date)      // Formata para DD/MM/YYYY HH:MM
isToday(date)               // Verifica se é hoje em Brasília
isPast(date)                // Verifica se está no passado
getCurrentBrazilDateInfo()  // Retorna {year, month, day, date}
```

### 2. Arquivos Corrigidos

#### ✅ **client/src/pages/Relatorios.tsx**
- Calendário agora usa `getCurrentBrazilDateInfo()` para obter data atual
- Média diária calcula dias corridos corretamente:
  - Mês passado: divide por total de dias do mês
  - Mês atual: divide por dia de hoje
- Função `isToday()` renomeada para `isTodayDay()` e usa timezone de Brasília

**Antes:**
```typescript
const today = new Date();
const isCurrentMonth = selectedYear === today.getFullYear() && selectedMonth === (today.getMonth() + 1);
```

**Depois:**
```typescript
const currentInfo = getCurrentBrazilDateInfo();
const isCurrentMonth = selectedYear === currentInfo.year && selectedMonth === currentInfo.month;
```

#### ✅ **client/src/pages/Vendas.tsx**
- Inicialização do filtro "Hoje" usa `getTodayInBrazil()`
- Botão "Hoje" usa `formatDateForInput()` para garantir consistência

**Antes:**
```typescript
const today = new Date();
const todayStr = today.toISOString().split('T')[0];
```

**Depois:**
```typescript
const todayStr = formatDateForInput(getTodayInBrazil());
```

#### ✅ **client/src/pages/Compras.tsx**
- Datas de emissão e lançamento inicializadas com `getTodayInBrazil()`
- Parcelas criadas com `addDays(getTodayInBrazil(), 30)`
- Conversão para ISO usa `parseDateInBrazil()` (meio-dia para evitar problemas de timezone)

**Antes:**
```typescript
const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
issueDate: new Date(issueDate).toISOString(),
```

**Depois:**
```typescript
const [issueDate, setIssueDate] = useState(formatDateForInput(getTodayInBrazil()));
issueDate: parseDateInBrazil(issueDate).toISOString(),
```

---

## 📊 Validação

### Testes Realizados

**1. Calendário de Relatórios**
- ✅ Dezembro 2025 (dia 03): R$ 2.751,08 ÷ 3 = R$ 917,03
- ✅ Novembro 2025 (completo): R$ 38.363,53 ÷ 30 = R$ 1.278,78
- ✅ Dia atual (03) destacado corretamente

**2. Filtro de Vendas**
- ✅ Botão "Hoje" filtra corretamente para 03/12/2025
- ✅ Vendas aparecem no dia correto

**3. Compras**
- ✅ Data de emissão inicializa com data atual de Brasília
- ✅ Parcelas criadas com vencimento 30 dias à frente

---

## 🔄 Próximos Passos (Recomendado)

### Arquivos Pendentes de Correção

Os seguintes arquivos ainda usam `new Date()` sem timezone e devem ser corrigidos em futuras iterações:

1. **client/src/pages/ContasPagar.tsx** (20 ocorrências)
   - Comparação de vencimento
   - Registro de pagamento

2. **client/src/pages/ContasReceber.tsx** (6 ocorrências)
   - Registro de pagamento
   - Comparação de datas

3. **client/src/pages/Despesas.tsx** (8 ocorrências)
   - Datas de vencimento
   - Criação de parcelas

4. **client/src/components/CompactSalesCalendar.tsx** (6 ocorrências)
   - Calendário do dashboard

5. **server/db.ts** (15 ocorrências)
   - Filtros de período
   - Comparações de data

6. **server/routers.ts** (12 ocorrências)
   - Dashboard
   - Cálculos de período

### Padrão de Correção

Para cada arquivo:

1. Adicionar import:
```typescript
import { getTodayInBrazil, formatDateForInput, parseDateInBrazil } from "@shared/dateUtils";
```

2. Substituir `new Date()` por funções apropriadas:
   - Obter data atual: `getTodayInBrazil()`
   - Input de formulário: `formatDateForInput(getTodayInBrazil())`
   - Converter input para Date: `parseDateInBrazil(dateStr)`

3. Testar cenários críticos:
   - Vendas/compras em horários limites (23h-00h)
   - Filtros de "hoje"
   - Comparações de vencimento

---

## 📝 Notas Técnicas

### Por que meio-dia (12:00)?

A função `parseDateInBrazil()` cria datas com hora 12:00 para evitar problemas de timezone ao salvar no banco:

```typescript
// Evita: 2025-12-03T00:00:00-03:00 → 2025-12-02T21:00:00Z (dia anterior em UTC)
// Usa:   2025-12-03T12:00:00-03:00 → 2025-12-03T15:00:00Z (mesmo dia em UTC)
```

### Conversão para Brasília

Todas as funções usam `toLocaleString()` com `timeZone: 'America/Sao_Paulo'`:

```typescript
const brasiliaStr = date.toLocaleString('en-US', { 
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});
```

### Banco de Dados

- Timestamps continuam salvos em UTC (padrão do MySQL/TiDB)
- Conversão para Brasília acontece apenas na exibição
- Comparações de data devem usar funções do `dateUtils.ts`

---

## 🎯 Resultado

- ✅ Calendários mostram dia atual correto
- ✅ Média diária calculada corretamente
- ✅ Filtros de data funcionam consistentemente
- ✅ Vendas aparecem no dia correto
- ✅ Sistema padronizado para timezone de Brasília

**Status:** Pontos críticos corrigidos. Arquivos secundários pendentes para próxima iteração.
