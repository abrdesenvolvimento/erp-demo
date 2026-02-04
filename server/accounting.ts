/**
 * Módulo de Contabilização
 * 
 * Funções para:
 * - CRUD de contas contábeis
 * - Criação de journals (lotes contábeis)
 * - Lançamentos contábeis (partida dobrada)
 * - Validações de integridade
 * - Relatórios (Razão, Balancete, DRE)
 */

import { eq, and, desc, asc, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  chartOfAccounts,
  journals,
  accountingEntries,
  journalSources,
  accountingPeriods,
  ChartOfAccount,
  InsertChartOfAccount,
  Journal,
  InsertJournal,
  AccountingEntry,
  InsertAccountingEntry,
  JournalSource,
  InsertJournalSource,
  AccountingPeriod,
} from "../drizzle/schema";

// =====================================================
// CRUD - Plano de Contas
// =====================================================

export async function getChartOfAccounts(companyId: number = 1) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(chartOfAccounts)
    .where(and(
      eq(chartOfAccounts.companyId, companyId),
      eq(chartOfAccounts.isActive, true)
    ))
    .orderBy(asc(chartOfAccounts.displayOrder));
}

export async function getAccountById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(chartOfAccounts)
    .where(eq(chartOfAccounts.id, id))
    .limit(1);
  
  return result[0] || null;
}

export async function getAccountByCode(code: string, companyId: number = 1) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(chartOfAccounts)
    .where(and(
      eq(chartOfAccounts.code, code),
      eq(chartOfAccounts.companyId, companyId)
    ))
    .limit(1);
  
  return result[0] || null;
}

export async function getAnalyticalAccounts(companyId: number = 1) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(chartOfAccounts)
    .where(and(
      eq(chartOfAccounts.companyId, companyId),
      eq(chartOfAccounts.isAnalytical, true),
      eq(chartOfAccounts.isActive, true)
    ))
    .orderBy(asc(chartOfAccounts.code));
}

export async function createAccount(data: Omit<InsertChartOfAccount, 'id'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Validar código único
  const existing = await getAccountByCode(data.code, data.companyId);
  if (existing) {
    throw new Error(`Código ${data.code} já existe`);
  }
  
  // Validar parentId se fornecido
  if (data.parentId) {
    const parent = await getAccountById(data.parentId);
    if (!parent) {
      throw new Error("Conta pai não encontrada");
    }
    if (parent.isAnalytical) {
      throw new Error("Conta pai não pode ser analítica");
    }
  }
  
  const [result] = await db.insert(chartOfAccounts).values(data);
  return { id: result.insertId, ...data };
}

export async function updateAccount(id: number, data: Partial<InsertChartOfAccount>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Não permitir alterar código se conta tiver lançamentos
  if (data.code) {
    const hasEntries = await accountHasEntries(id);
    if (hasEntries) {
      throw new Error("Não é possível alterar código de conta com lançamentos");
    }
  }
  
  await db.update(chartOfAccounts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(chartOfAccounts.id, id));
  
  return getAccountById(id);
}

export async function deactivateAccount(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Verificar se tem lançamentos
  const hasEntries = await accountHasEntries(id);
  if (hasEntries) {
    throw new Error("Não é possível desativar conta com lançamentos");
  }
  
  await db.update(chartOfAccounts)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(chartOfAccounts.id, id));
  
  return true;
}

async function accountHasEntries(accountId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db.select({ count: sql<number>`COUNT(*)` })
    .from(accountingEntries)
    .where(eq(accountingEntries.accountId, accountId));
  
  return result[0]?.count > 0;
}

// =====================================================
// Períodos Contábeis
// =====================================================

export async function getAccountingPeriod(competenceMonth: string, companyId: number = 1) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(accountingPeriods)
    .where(and(
      eq(accountingPeriods.companyId, companyId),
      eq(accountingPeriods.competenceMonth, competenceMonth)
    ))
    .limit(1);
  
  return result[0] || null;
}

export async function ensurePeriodOpen(competenceMonth: string, companyId: number = 1) {
  const period = await getAccountingPeriod(competenceMonth, companyId);
  
  if (!period) {
    // Criar período automaticamente
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    await db.insert(accountingPeriods).values({
      companyId,
      competenceMonth,
      status: 'OPEN'
    });
    return true;
  }
  
  if (period.status === 'CLOSED') {
    throw new Error(`Período ${competenceMonth} está fechado`);
  }
  
  return true;
}

export async function closePeriod(competenceMonth: string, userId: string, companyId: number = 1) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(accountingPeriods)
    .set({
      status: 'CLOSED',
      closedAt: new Date(),
      closedBy: userId
    })
    .where(and(
      eq(accountingPeriods.companyId, companyId),
      eq(accountingPeriods.competenceMonth, competenceMonth)
    ));
  
  return true;
}

// =====================================================
// Journals (Lotes Contábeis)
// =====================================================

export async function createJournal(data: {
  companyId?: number;
  competenceMonth: string;
  description?: string;
  createdBy: string;
}): Promise<Journal> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const companyId = data.companyId || 1;
  
  // Verificar período aberto
  await ensurePeriodOpen(data.competenceMonth, companyId);
  
  const [result] = await db.insert(journals).values({
    companyId,
    competenceMonth: data.competenceMonth,
    description: data.description,
    status: 'DRAFT',
    createdBy: data.createdBy,
    totalDebit: "0.00",
    totalCredit: "0.00"
  });
  
  const journal = await getJournalById(result.insertId);
  if (!journal) throw new Error("Erro ao criar journal");
  
  return journal;
}

export async function getJournalById(id: number): Promise<Journal | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(journals)
    .where(eq(journals.id, id))
    .limit(1);
  
  return result[0] || null;
}

export async function getJournals(filters: {
  companyId?: number;
  competenceMonth?: string;
  status?: 'DRAFT' | 'POSTED' | 'REVERSED';
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(journals);
  
  const conditions = [];
  if (filters.companyId) {
    conditions.push(eq(journals.companyId, filters.companyId));
  }
  if (filters.competenceMonth) {
    conditions.push(eq(journals.competenceMonth, filters.competenceMonth));
  }
  if (filters.status) {
    conditions.push(eq(journals.status, filters.status));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }
  
  return query
    .orderBy(desc(journals.createdAt))
    .limit(filters.limit || 100);
}

// =====================================================
// Lançamentos Contábeis
// =====================================================

export interface EntryLine {
  accountId: number;
  amount: number;  // Sempre positivo
  entryType: 'D' | 'C';
  description?: string;
  sourceType?: string;
  sourceId?: number;
}

export async function addEntriesToJournal(
  journalId: number,
  entries: EntryLine[],
  entryDate: Date,
  competenceMonth: string
): Promise<AccountingEntry[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const journal = await getJournalById(journalId);
  if (!journal) throw new Error("Journal não encontrado");
  if (journal.status !== 'DRAFT') {
    throw new Error("Só é possível adicionar lançamentos em journals DRAFT");
  }
  
  // Validar partida dobrada
  const totalDebit = entries
    .filter(e => e.entryType === 'D')
    .reduce((sum, e) => sum + e.amount, 0);
  
  const totalCredit = entries
    .filter(e => e.entryType === 'C')
    .reduce((sum, e) => sum + e.amount, 0);
  
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Partida dobrada inválida: Débito (${totalDebit.toFixed(2)}) ≠ Crédito (${totalCredit.toFixed(2)})`);
  }
  
  // Validar contas
  for (const entry of entries) {
    const account = await getAccountById(entry.accountId);
    if (!account) {
      throw new Error(`Conta ${entry.accountId} não encontrada`);
    }
    if (!account.isAnalytical) {
      throw new Error(`Conta ${account.code} não é analítica`);
    }
    if (!account.allowsEntries) {
      throw new Error(`Conta ${account.code} não permite lançamentos`);
    }
  }
  
  // Inserir lançamentos
  const insertedEntries: AccountingEntry[] = [];
  
  for (const entry of entries) {
    const [result] = await db.insert(accountingEntries).values({
      companyId: journal.companyId,
      journalId,
      accountId: entry.accountId,
      entryDate,
      competenceMonth,
      amount: entry.amount.toFixed(2),
      entryType: entry.entryType,
      description: entry.description,
      sourceType: entry.sourceType,
      sourceId: entry.sourceId
    });
    
    const inserted = await db.select()
      .from(accountingEntries)
      .where(eq(accountingEntries.id, result.insertId))
      .limit(1);
    
    if (inserted[0]) {
      insertedEntries.push(inserted[0]);
    }
  }
  
  // Atualizar totais do journal
  await updateJournalTotals(journalId);
  
  return insertedEntries;
}

async function updateJournalTotals(journalId: number) {
  const db = await getDb();
  if (!db) return;
  
  const totals = await db.select({
    totalDebit: sql<string>`COALESCE(SUM(CASE WHEN entryType = 'D' THEN amount ELSE 0 END), 0)`,
    totalCredit: sql<string>`COALESCE(SUM(CASE WHEN entryType = 'C' THEN amount ELSE 0 END), 0)`
  })
    .from(accountingEntries)
    .where(eq(accountingEntries.journalId, journalId));
  
  await db.update(journals)
    .set({
      totalDebit: totals[0]?.totalDebit || "0.00",
      totalCredit: totals[0]?.totalCredit || "0.00"
    })
    .where(eq(journals.id, journalId));
}

export async function postJournal(journalId: number): Promise<Journal> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const journal = await getJournalById(journalId);
  if (!journal) throw new Error("Journal não encontrado");
  if (journal.status !== 'DRAFT') {
    throw new Error("Só é possível postar journals DRAFT");
  }
  
  // Verificar se tem lançamentos
  const entries = await getJournalEntries(journalId);
  if (entries.length === 0) {
    throw new Error("Journal não possui lançamentos");
  }
  
  // Verificar partida dobrada final
  const totalDebit = entries
    .filter(e => e.entryType === 'D')
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);
  
  const totalCredit = entries
    .filter(e => e.entryType === 'C')
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);
  
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Partida dobrada inválida: Débito (${totalDebit.toFixed(2)}) ≠ Crédito (${totalCredit.toFixed(2)})`);
  }
  
  await db.update(journals)
    .set({
      status: 'POSTED',
      postedAt: new Date()
    })
    .where(eq(journals.id, journalId));
  
  return (await getJournalById(journalId))!;
}

export async function getJournalEntries(journalId: number): Promise<AccountingEntry[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(accountingEntries)
    .where(eq(accountingEntries.journalId, journalId))
    .orderBy(asc(accountingEntries.id));
}

// =====================================================
// Journal Sources (Rastreabilidade)
// =====================================================

export async function linkJournalSource(data: {
  journalId: number;
  sourceType: string;
  sourceId: number;
  companyId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const journal = await getJournalById(data.journalId);
  if (!journal) throw new Error("Journal não encontrado");
  
  // Verificar se já existe (idempotência)
  const existing = await db.select()
    .from(journalSources)
    .where(and(
      eq(journalSources.journalId, data.journalId),
      eq(journalSources.sourceType, data.sourceType),
      eq(journalSources.sourceId, data.sourceId)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    return existing[0];
  }
  
  const [result] = await db.insert(journalSources).values({
    companyId: data.companyId || journal.companyId,
    journalId: data.journalId,
    sourceType: data.sourceType,
    sourceId: data.sourceId
  });
  
  return { id: result.insertId, ...data };
}

export async function getJournalBySource(sourceType: string, sourceId: number, companyId: number = 1) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(journalSources)
    .innerJoin(journals, eq(journalSources.journalId, journals.id))
    .where(and(
      eq(journalSources.companyId, companyId),
      eq(journalSources.sourceType, sourceType),
      eq(journalSources.sourceId, sourceId)
    ))
    .limit(1);
  
  return result[0]?.journals || null;
}

// =====================================================
// Razão Contábil
// =====================================================

export interface RazaoEntry {
  date: Date;
  journalId: number;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export async function getRazao(
  accountId: number,
  startDate: Date,
  endDate: Date,
  companyId: number = 1
): Promise<{ account: ChartOfAccount; entries: RazaoEntry[]; saldoAnterior: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const account = await getAccountById(accountId);
  if (!account) throw new Error("Conta não encontrada");
  
  // Calcular saldo anterior
  const saldoAnteriorResult = await db.select({
    debit: sql<string>`COALESCE(SUM(CASE WHEN ${accountingEntries.entryType} = 'D' THEN ${accountingEntries.amount} ELSE 0 END), 0)`,
    credit: sql<string>`COALESCE(SUM(CASE WHEN ${accountingEntries.entryType} = 'C' THEN ${accountingEntries.amount} ELSE 0 END), 0)`
  })
    .from(accountingEntries)
    .innerJoin(journals, eq(accountingEntries.journalId, journals.id))
    .where(and(
      eq(accountingEntries.accountId, accountId),
      eq(accountingEntries.companyId, companyId),
      eq(journals.status, 'POSTED'),
      sql`${accountingEntries.entryDate} < ${startDate}`
    ));
  
  const saldoAnteriorDebit = parseFloat(saldoAnteriorResult[0]?.debit || '0');
  const saldoAnteriorCredit = parseFloat(saldoAnteriorResult[0]?.credit || '0');
  
  // Saldo anterior: Devedora = D - C, Credora = C - D
  let saldoAnterior = account.nature === 'DEVEDORA'
    ? saldoAnteriorDebit - saldoAnteriorCredit
    : saldoAnteriorCredit - saldoAnteriorDebit;
  
  // Buscar lançamentos do período
  const entries = await db.select({
    id: accountingEntries.id,
    entryDate: accountingEntries.entryDate,
    journalId: accountingEntries.journalId,
    description: accountingEntries.description,
    amount: accountingEntries.amount,
    entryType: accountingEntries.entryType
  })
    .from(accountingEntries)
    .innerJoin(journals, eq(accountingEntries.journalId, journals.id))
    .where(and(
      eq(accountingEntries.accountId, accountId),
      eq(accountingEntries.companyId, companyId),
      eq(journals.status, 'POSTED'),
      sql`${accountingEntries.entryDate} >= ${startDate}`,
      sql`${accountingEntries.entryDate} <= ${endDate}`
    ))
    .orderBy(asc(accountingEntries.entryDate), asc(accountingEntries.id));
  
  // Calcular saldo progressivo
  let runningBalance = saldoAnterior;
  const razaoEntries: RazaoEntry[] = entries.map(entry => {
    const amount = parseFloat(entry.amount);
    const debit = entry.entryType === 'D' ? amount : 0;
    const credit = entry.entryType === 'C' ? amount : 0;
    
    // Atualizar saldo
    if (account.nature === 'DEVEDORA') {
      runningBalance += debit - credit;
    } else {
      runningBalance += credit - debit;
    }
    
    return {
      date: entry.entryDate,
      journalId: entry.journalId,
      description: entry.description || '',
      debit,
      credit,
      balance: runningBalance
    };
  });
  
  return {
    account,
    entries: razaoEntries,
    saldoAnterior
  };
}

// =====================================================
// Balancete / Balanço
// =====================================================

export interface BalanceItem {
  accountId: number;
  code: string;
  name: string;
  level: number;
  accountType: string;
  nature: string;
  isAnalytical: boolean;
  debit: number;
  credit: number;
  balance: number;
}

export async function getBalancete(
  competenceMonth: string,
  companyId: number = 1
): Promise<BalanceItem[]> {
  const db = await getDb();
  if (!db) return [];
  
  // Buscar todas as contas
  const accounts = await getChartOfAccounts(companyId);
  
  // Buscar saldos das contas analíticas
  const saldos = await db.select({
    accountId: accountingEntries.accountId,
    debit: sql<string>`COALESCE(SUM(CASE WHEN ${accountingEntries.entryType} = 'D' THEN ${accountingEntries.amount} ELSE 0 END), 0)`,
    credit: sql<string>`COALESCE(SUM(CASE WHEN ${accountingEntries.entryType} = 'C' THEN ${accountingEntries.amount} ELSE 0 END), 0)`
  })
    .from(accountingEntries)
    .innerJoin(journals, eq(accountingEntries.journalId, journals.id))
    .where(and(
      eq(accountingEntries.companyId, companyId),
      eq(journals.status, 'POSTED'),
      eq(accountingEntries.competenceMonth, competenceMonth)
    ))
    .groupBy(accountingEntries.accountId);
  
  // Criar mapa de saldos
  const saldoMap = new Map<number, { debit: number; credit: number }>();
  for (const s of saldos) {
    saldoMap.set(s.accountId, {
      debit: parseFloat(s.debit),
      credit: parseFloat(s.credit)
    });
  }
  
  // Montar balancete com hierarquia
  const balanceItems: BalanceItem[] = accounts.map(account => {
    const saldo = saldoMap.get(account.id) || { debit: 0, credit: 0 };
    const balance = account.nature === 'DEVEDORA'
      ? saldo.debit - saldo.credit
      : saldo.credit - saldo.debit;
    
    return {
      accountId: account.id,
      code: account.code,
      name: account.name,
      level: account.level,
      accountType: account.accountType,
      nature: account.nature,
      isAnalytical: account.isAnalytical ?? true,
      debit: saldo.debit,
      credit: saldo.credit,
      balance
    };
  });
  
  // Calcular saldos das contas sintéticas (soma dos filhos)
  // Processar de baixo para cima (maior level primeiro)
  const maxLevel = Math.max(...balanceItems.map(b => b.level));
  
  for (let level = maxLevel - 1; level >= 1; level--) {
    for (const item of balanceItems.filter(b => b.level === level)) {
      // Encontrar filhos diretos
      const children = balanceItems.filter(b => 
        b.code.startsWith(item.code + '.') && 
        b.level === level + 1
      );
      
      item.debit = children.reduce((sum, c) => sum + c.debit, 0);
      item.credit = children.reduce((sum, c) => sum + c.credit, 0);
      item.balance = item.nature === 'DEVEDORA'
        ? item.debit - item.credit
        : item.credit - item.debit;
    }
  }
  
  return balanceItems;
}

// =====================================================
// DRE (Demonstração do Resultado)
// =====================================================

export interface DRELine {
  code: string;
  description: string;
  value: number;
  level: number;
  isTotal?: boolean;
}

export async function getDRE(
  competenceMonth: string,
  companyId: number = 1
): Promise<DRELine[]> {
  const balancete = await getBalancete(competenceMonth, companyId);
  
  // Filtrar apenas grupos 4, 5 e 6 (Receitas, Custos, Despesas)
  const receitas = balancete.filter(b => b.code.startsWith('4'));
  const custos = balancete.filter(b => b.code.startsWith('5'));
  const despesas = balancete.filter(b => b.code.startsWith('6'));
  
  // Calcular totais
  const totalReceitas = receitas.find(r => r.code === '4')?.balance || 0;
  const totalCustos = custos.find(c => c.code === '5')?.balance || 0;
  const totalDespesas = despesas.find(d => d.code === '6')?.balance || 0;
  
  const lucroBruto = totalReceitas - totalCustos;
  const lucroOperacional = lucroBruto - totalDespesas;
  
  // Montar DRE
  const dre: DRELine[] = [
    { code: '4', description: 'RECEITA OPERACIONAL BRUTA', value: totalReceitas, level: 1 },
    ...receitas.filter(r => r.level === 2).map(r => ({
      code: r.code,
      description: r.name,
      value: r.balance,
      level: 2
    })),
    { code: '', description: '', value: 0, level: 0 }, // Linha vazia
    { code: '5', description: 'CUSTOS', value: -totalCustos, level: 1 },
    ...custos.filter(c => c.level === 2).map(c => ({
      code: c.code,
      description: c.name,
      value: -c.balance,
      level: 2
    })),
    { code: '', description: '', value: 0, level: 0 }, // Linha vazia
    { code: '', description: 'LUCRO BRUTO', value: lucroBruto, level: 1, isTotal: true },
    { code: '', description: '', value: 0, level: 0 }, // Linha vazia
    { code: '6', description: 'DESPESAS OPERACIONAIS', value: -totalDespesas, level: 1 },
    ...despesas.filter(d => d.level === 2).map(d => ({
      code: d.code,
      description: d.name,
      value: -d.balance,
      level: 2
    })),
    { code: '', description: '', value: 0, level: 0 }, // Linha vazia
    { code: '', description: 'RESULTADO OPERACIONAL', value: lucroOperacional, level: 1, isTotal: true },
  ];
  
  return dre;
}
