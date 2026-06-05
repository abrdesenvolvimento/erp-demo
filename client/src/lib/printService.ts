/**
 * Print Service - Client-side
 * Detecta o Print Agent local e envia comandos de impressão.
 * Fallback: se agent offline, usa window.print (popup formatada).
 */

const AGENT_URL = "http://localhost:9100";
const AGENT_CHECK_INTERVAL = 30000; // 30s

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
let lastCheck = 0;
let checkPromise: Promise<boolean> | null = null;

// --- Agent Detection ---
export async function checkAgentStatus(): Promise<AgentStatus> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${AGENT_URL}/status`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      agentOnline = true;
      lastCheck = Date.now();
      return data;
    }
  } catch {
    // Agent not available
  }
  agentOnline = false;
  lastCheck = Date.now();
  return { status: "offline" };
}

export async function isAgentOnline(): Promise<boolean> {
  // Cache check for 30s
  if (Date.now() - lastCheck < AGENT_CHECK_INTERVAL) {
    return agentOnline;
  }
  // Deduplicate concurrent checks
  if (!checkPromise) {
    checkPromise = checkAgentStatus().then(s => {
      checkPromise = null;
      return s.status === "online";
    });
  }
  return checkPromise;
}

// --- Print Functions ---

/**
 * Imprime ticket de produção (Cozinha ou Bar)
 * Se agent online → envia via ESC/POS direto na impressora
 * Se agent offline → fallback para window.print
 */
export async function printProductionTicketViaAgent(
  data: ProductionTicketData,
  fallbackFn?: () => void
): Promise<{ success: boolean; method: "agent" | "fallback"; error?: string }> {
  const online = await isAgentOnline();

  if (online) {
    try {
      const department: PrinterDepartment = data.destination === "KITCHEN" ? "KITCHEN" : "BAR";
      const res = await fetch(`${AGENT_URL}/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "production_ticket",
          department,
          data: {
            ...data,
            timestamp: data.timestamp || new Date().toISOString(),
          },
        }),
      });
      const result = await res.json();
      if (result.success) {
        return { success: true, method: "agent" };
      }
      // Agent responded but print failed - try fallback
      console.warn("[PrintService] Agent error:", result.error);
      if (fallbackFn) fallbackFn();
      return { success: false, method: "fallback", error: result.error };
    } catch (err: any) {
      console.warn("[PrintService] Agent request failed:", err.message);
      if (fallbackFn) fallbackFn();
      return { success: false, method: "fallback", error: err.message };
    }
  }

  // Fallback
  if (fallbackFn) {
    fallbackFn();
    return { success: true, method: "fallback" };
  }
  return { success: false, method: "fallback", error: "Agent offline e sem fallback" };
}

/**
 * Imprime ticket em múltiplos departamentos (para itens com destino BOTH)
 */
export async function printProductionTicketMulti(
  data: ProductionTicketData,
  departments: PrinterDepartment[],
  fallbackFn?: () => void
): Promise<{ success: boolean; method: "agent" | "fallback"; results?: any[] }> {
  const online = await isAgentOnline();

  if (online) {
    try {
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
      });
      const result = await res.json();
      const allSuccess = result.results?.every((r: any) => r.success);
      if (allSuccess) {
        return { success: true, method: "agent", results: result.results };
      }
      // Partial failure
      console.warn("[PrintService] Partial print failure:", result.results);
      return { success: false, method: "agent", results: result.results };
    } catch (err: any) {
      if (fallbackFn) fallbackFn();
      return { success: false, method: "fallback" };
    }
  }

  if (fallbackFn) {
    fallbackFn();
    return { success: true, method: "fallback" };
  }
  return { success: false, method: "fallback" };
}

/**
 * Imprime cupom/recibo (Caixa)
 */
export async function printReceiptViaAgent(
  data: ReceiptData,
  fallbackFn?: () => void
): Promise<{ success: boolean; method: "agent" | "fallback"; error?: string }> {
  const online = await isAgentOnline();

  if (online) {
    try {
      const res = await fetch(`${AGENT_URL}/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "receipt",
          department: "CASHIER",
          data: {
            ...data,
            timestamp: data.timestamp || new Date().toISOString(),
          },
        }),
      });
      const result = await res.json();
      if (result.success) {
        return { success: true, method: "agent" };
      }
      console.warn("[PrintService] Agent receipt error:", result.error);
      if (fallbackFn) fallbackFn();
      return { success: false, method: "fallback", error: result.error };
    } catch (err: any) {
      console.warn("[PrintService] Agent request failed:", err.message);
      if (fallbackFn) fallbackFn();
      return { success: false, method: "fallback", error: err.message };
    }
  }

  if (fallbackFn) {
    fallbackFn();
    return { success: true, method: "fallback" };
  }
  return { success: false, method: "fallback", error: "Agent offline e sem fallback" };
}

/**
 * Testa conexão com uma impressora específica
 */
export async function testPrinter(department: PrinterDepartment): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(`${AGENT_URL}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ department }),
    });
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
    const res = await fetch(`${AGENT_URL}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ printers }),
    });
    const data = await res.json();
    return { success: true, ...data };
  } catch (err: any) {
    return { success: false, error: "Print Agent não está rodando" };
  }
}

// Export agent URL for UI display
export const PRINT_AGENT_URL = AGENT_URL;
