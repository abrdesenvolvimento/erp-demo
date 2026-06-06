/**
 * Print Service - Client-side
 * Detecta o Print Agent local e envia comandos de impressão.
 * 
 * ESTRATÉGIA v48.5:
 * - Cada tentativa de impressão TENTA enviar direto ao agent (sem cache negativo)
 * - Se agent responde → imprime via ESC/POS direto na impressora térmica
 * - Se agent não responde → retorna { success: false } (caller decide o que fazer)
 * - KDS: NÃO usa fallback window.print — mostra toast de erro
 * - Caixa: pode usar fallback window.print se necessário
 * - Cache POSITIVO de 60s (se agent estava online, não precisa checar de novo)
 * - Cache NEGATIVO eliminado (se estava offline, tenta de novo na próxima impressão)
 */

// Usa 127.0.0.1 em vez de localhost para garantir que o Chrome
// reconheça como IP privado e isente de mixed content (HTTPS→HTTP)
const AGENT_URL = "http://127.0.0.1:9100";
const AGENT_ONLINE_CACHE_MS = 60000; // 60s de cache quando agent está ONLINE
const AGENT_TIMEOUT_MS = 8000; // 8s timeout para status check (agent pode demorar se impressora offline)

type PrinterDepartment = "KITCHEN" | "BAR" | "CASHIER";

interface ProductionTicketData {
  tableNumber: number | string;
  orderId: number;
  items: Array<{
    productName: string;
    quantity: number;
    notes?: string;
  }>;
  destination: string;
  timestamp?: string;
}

interface ReceiptData {
  tableNumber: number | string;
  orderId: number;
  waiterName?: string;
  guestCount?: number;
  openedAt?: string;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    status?: string;
  }>;
  subtotal: number;
  tipPercent: number;
  tipAmount: number;
  totalAmount: number;
  companyName?: string;
  timestamp?: string;
}

interface AgentStatus {
  status: "online" | "offline";
  version?: string;
  printers?: Array<{
    department: string;
    name: string;
    ip: string;
    port: number;
    enabled: boolean;
  }>;
}

// --- State ---
let agentOnline = false;
let lastOnlineCheck = 0;
let checkPromise: Promise<boolean> | null = null;

// --- Agent Detection ---
export async function checkAgentStatus(): Promise<AgentStatus> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);
    const res = await fetch(`${AGENT_URL}/status`, {
      signal: controller.signal,
      // @ts-ignore - Chrome LNA: marca request como local network (isenta de mixed content)
      targetAddressSpace: "loopback",
    } as any);
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      agentOnline = true;
      lastOnlineCheck = Date.now();
      return data;
    }
  } catch {
    // Agent not available
  }
  agentOnline = false;
  // NÃO atualiza lastOnlineCheck quando offline — permite retry imediato na próxima chamada
  return { status: "offline" };
}

export async function isAgentOnline(): Promise<boolean> {
  // Cache POSITIVO: se agent estava online recentemente, confiar
  if (agentOnline && Date.now() - lastOnlineCheck < AGENT_ONLINE_CACHE_MS) {
    return true;
  }
  // Se agent estava offline ou cache expirou, verificar novamente
  // Deduplicate concurrent checks
  if (!checkPromise) {
    checkPromise = checkAgentStatus().then(s => {
      checkPromise = null;
      return s.status === "online";
    });
  }
  return checkPromise;
}

/**
 * Força uma verificação imediata do agent (ignora cache).
 * Útil para UI que precisa mostrar status atualizado.
 */
export async function forceCheckAgent(): Promise<AgentStatus> {
  agentOnline = false;
  lastOnlineCheck = 0;
  checkPromise = null;
  return checkAgentStatus();
}

// --- Print Functions ---

/**
 * Resultado estruturado de tentativa de impressão.
 * - agentOnline: true se o agent respondeu (mesmo com erro de impressora)
 * - printerError: true se o agent respondeu mas a impressora falhou
 * - success: true se imprimiu com sucesso
 */
export interface PrintResult {
  success: boolean;
  agentOnline: boolean;
  printerError: boolean;
  error?: string;
}

/**
 * Tenta enviar print job diretamente ao agent.
 * Diferencia: agent offline (fetch falhou) vs impressora com erro (HTTP 500).
 */
async function tryPrintViaAgent(body: object): Promise<PrintResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s para print job
    const res = await fetch(`${AGENT_URL}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      // @ts-ignore - Chrome LNA: marca request como loopback network
      targetAddressSpace: "loopback",
    } as any);
    clearTimeout(timeout);

    const data = await res.json().catch(() => null);

    if (res.ok && data?.success) {
      // Agent respondeu com sucesso — impressão enviada
      agentOnline = true;
      lastOnlineCheck = Date.now();
      return { success: true, agentOnline: true, printerError: false };
    }

    // Agent respondeu mas com erro (HTTP 500 ou success: false)
    // Isso significa: agent ONLINE, mas impressora com problema
    agentOnline = true;
    lastOnlineCheck = Date.now();
    return {
      success: false,
      agentOnline: true,
      printerError: true,
      error: data?.message || data?.error || `Erro na impressora (HTTP ${res.status})`,
    };
  } catch (err: any) {
    // Fetch falhou completamente — agent offline ou inacessível
    agentOnline = false;
    return {
      success: false,
      agentOnline: false,
      printerError: false,
      error: "Print Agent offline ou inacessível",
    };
  }
}

/**
 * Imprime ticket de produção (Cozinha ou Bar)
 * ESTRATÉGIA: Sempre tenta agent primeiro. Se falhar, usa fallback.
 * Retorna PrintResult com informação estruturada sobre o que aconteceu.
 */
export async function printProductionTicketViaAgent(
  data: ProductionTicketData,
  fallbackFn?: () => void
): Promise<PrintResult & { method: "agent" | "fallback" }> {
  const department: PrinterDepartment = data.destination === "KITCHEN" ? "KITCHEN" : "BAR";

  // Tenta enviar direto ao agent (sem verificar status primeiro)
  const result = await tryPrintViaAgent({
    type: "production_ticket",
    department,
    data: {
      ...data,
      timestamp: data.timestamp || new Date().toISOString(),
    },
  });

  if (result.success) {
    console.log(`[PrintService] ✓ Ticket ${department} impresso via Agent`);
    return { ...result, method: "agent" };
  }

  if (result.agentOnline && result.printerError) {
    // Agent online mas impressora com problema
    console.warn(`[PrintService] Impressora com erro: ${result.error}`);
    return { ...result, method: "agent" };
  }

  // Agent offline — usar fallback se disponível
  console.warn(`[PrintService] Agent offline (${result.error})`);
  if (fallbackFn) {
    fallbackFn();
    return { success: true, agentOnline: false, printerError: false, method: "fallback" };
  }
  return { ...result, method: "fallback" };
}

/**
 * Imprime ticket em múltiplos departamentos (para itens com destino BOTH)
 */
export async function printProductionTicketMulti(
  data: ProductionTicketData,
  departments: PrinterDepartment[],
  fallbackFn?: () => void
): Promise<{ success: boolean; method: "agent" | "fallback"; results?: any[] }> {
  // Tenta enviar direto ao agent
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s para print-multi
    const res = await fetch(`${AGENT_URL}/print-multi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "production_ticket",
        departments,
        data: {
          ...data,
          timestamp: data.timestamp || new Date().toISOString(),
        },
      }),
      signal: controller.signal,
      // @ts-ignore - Chrome LNA: marca request como local network
      targetAddressSpace: "loopback",
    } as any);
    clearTimeout(timeout);
    const result = await res.json();
    const allSuccess = result.results?.every((r: any) => r.success);
    if (allSuccess) {
      agentOnline = true;
      lastOnlineCheck = Date.now();
      return { success: true, method: "agent", results: result.results };
    }
    // Partial failure
    console.warn("[PrintService] Partial print failure:", result.results);
    return { success: false, method: "agent", results: result.results };
  } catch (err: any) {
    agentOnline = false;
    if (fallbackFn) {
      fallbackFn();
      return { success: true, method: "fallback" };
    }
    return { success: false, method: "fallback" };
  }
}

/**
 * Imprime cupom/recibo (Caixa)
 * ESTRATÉGIA: Sempre tenta agent primeiro. Se falhar, usa fallback.
 */
export async function printReceiptViaAgent(
  data: ReceiptData,
  fallbackFn?: () => void
): Promise<{ success: boolean; method: "agent" | "fallback"; error?: string }> {
  const result = await tryPrintViaAgent({
    type: "receipt",
    department: "CASHIER",
    data: {
      ...data,
      timestamp: data.timestamp || new Date().toISOString(),
    },
  });

  if (result.success) {
    console.log("[PrintService] ✓ Recibo impresso via Agent");
    return { success: true, method: "agent" };
  }

  console.warn(`[PrintService] Agent falhou (${result.error}), usando fallback window.print`);
  if (fallbackFn) {
    fallbackFn();
    return { success: true, method: "fallback" };
  }
  return { success: false, method: "fallback", error: result.error };
}

/**
 * Testa conexão com uma impressora específica
 */
export async function testPrinter(department: PrinterDepartment): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);
    const res = await fetch(`${AGENT_URL}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ department }),
      signal: controller.signal,
      // @ts-ignore - Chrome LNA
      targetAddressSpace: "loopback",
    } as any);
    clearTimeout(timeout);
    return await res.json();
  } catch (err: any) {
    return { success: false, error: "Print Agent não está rodando" };
  }
}

/**
 * Atualiza configuração de impressoras no agent
 */
export async function updateAgentConfig(printers: Array<{
  department: string;
  name: string;
  ip: string;
  port: number;
  enabled: boolean;
}>): Promise<{ success: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);
    const res = await fetch(`${AGENT_URL}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ printers }),
      signal: controller.signal,
      // @ts-ignore - Chrome LNA
      targetAddressSpace: "loopback",
    } as any);
    clearTimeout(timeout);
    const data = await res.json();
    return { success: true, ...data };
  } catch (err: any) {
    return { success: false, error: "Print Agent não está rodando" };
  }
}

// Export agent URL for UI display
export const PRINT_AGENT_URL = AGENT_URL;
