# BUG-03: Centralização de Timezone

## Status: Análise Completa

## Diagnóstico

### Situação Atual
O sistema já possui um arquivo centralizado de utilitários de data (`shared/dateUtils.ts`) com funções para manipulação de timezone de Brasília (America/Sao_Paulo). Porém, **nem todos os módulos utilizam essas funções**, criando inconsistências.

### Arquivo Centralizado Existente
`shared/dateUtils.ts` contém:
- `getNowInBrazil()` - Data/hora atual em Brasília
- `getTodayInBrazil()` - Data atual (00:00:00) em Brasília
- `parseDateInBrazil(dateStr)` - Converte string YYYY-MM-DD para Date
- `formatDateForInput(date)` - Converte Date para YYYY-MM-DD
- `formatDateBR(date)` - Formata para DD/MM/YYYY
- `formatDateTimeBR(date)` - Formata para DD/MM/YYYY HH:MM
- `isToday(date)` - Verifica se é hoje
- `isPast(date)` - Verifica se está no passado
- `addDays(date, days)` - Adiciona dias
- `addMonths(date, months)` - Adiciona meses
- `getFirstDayOfMonth(year, month)` - Primeiro dia do mês
- `getLastDayOfMonth(year, month)` - Último dia do mês
- `getCurrentBrazilDateInfo()` - Informações do dia atual

### Módulos com Implementação Própria (Inconsistentes)
Encontrados **92 usos de `new Date()` ou funções de timezone** espalhados em 11 arquivos:

1. **server/db.ts** (~40 ocorrências)
   - Usa `new Date()` diretamente em várias funções
   - Algumas funções usam `toLocaleString('en-CA', { timeZone: 'America/Sao_Paulo' })`
   - Outras usam `toISOString()` sem conversão de timezone

2. **server/routers.ts** (~10 ocorrências)
   - Usa `new Date()` diretamente
   - Algumas funções usam timezone de Brasília inline

3. **server/backupEndpoint.ts** (~8 ocorrências)
   - Usa `new Date().toISOString()` para timestamps
   - Usa `toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })` para notificações

4. **server/receivablesPdf.ts** e **server/pdf/receivablesPdf.ts**
   - Implementação própria de formatação de data

## Solução Proposta

### Estratégia: Migração Gradual
Dado o volume de ocorrências (92), recomendo migração gradual em vez de refatoração massiva:

### Fase 1: Funções Críticas (Prioridade Alta)
Migrar funções que afetam cálculos financeiros e relatórios:

```typescript
// server/db.ts - Exemplo de migração

// ANTES:
const today = new Date();
today.setHours(0, 0, 0, 0);

// DEPOIS:
import { getTodayInBrazil } from '@shared/dateUtils';
const today = getTodayInBrazil();
```

### Fase 2: Funções de Exibição (Prioridade Média)
Migrar formatação de datas para exibição:

```typescript
// ANTES:
const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

// DEPOIS:
import { formatDateBR } from '@shared/dateUtils';
// Usar formatDateBR diretamente
```

### Fase 3: Timestamps de Sistema (Prioridade Baixa)
Manter `new Date()` para timestamps de sistema (createdAt, updatedAt) pois o banco armazena em UTC.

## Arquivos a Modificar

### Prioridade Alta (Cálculos Financeiros)
1. `server/db.ts` - Funções de contas a pagar/receber, fechamento mensal
2. `server/routers.ts` - Endpoints de relatórios e análises

### Prioridade Média (Exibição)
3. `server/receivablesPdf.ts` - Geração de PDF
4. `server/pdf/receivablesPdf.ts` - Geração de PDF
5. `server/backupEndpoint.ts` - Notificações

### Manter Como Está
- Timestamps de sistema (`createdAt`, `updatedAt`, `lastSignedIn`)
- Arquivos de teste (`*.test.ts`)

## Estimativa de Esforço
- **Fase 1:** 2-3 horas
- **Fase 2:** 1-2 horas
- **Fase 3:** Não necessário

## Recomendação
Dado que o arquivo `dateUtils.ts` já existe e está bem estruturado, a solução é **adotar progressivamente** essas funções nos módulos existentes, começando pelas funções críticas de cálculo financeiro.

## Próximos Passos
1. Revisar esta análise com Orion
2. Aprovar estratégia de migração gradual
3. Implementar Fase 1 (funções críticas)
4. Testar cálculos financeiros
5. Implementar Fase 2 se necessário

---
**Autor:** Aurora (Manus)
**Data:** 03/02/2026
**Revisão:** Pendente (Orion)
