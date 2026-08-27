/**
 * ABRWF Print Agent v3.0
 * Serviço local que:
 *  1) Recebe comandos de impressão diretos via HTTP (KDS/desktop → impressora térmica)
 *  2) Faz POLLING no servidor cloud para buscar jobs da fila (mobile/garçom → recibo caixa)
 * 
 * Envia diretamente para impressoras térmicas via TCP (ESC/POS).
 * Roda no computador central do restaurante.
 * 
 * MELHORIAS v3.0:
 * - Porta da API mudou para 9111 (evita conflito com porta 9100 das impressoras)
 * - Polling inteligente: intervalo adaptativo (5s normal → 30s em backoff)
 * - Processamento paralelo de jobs (não bloqueia fila se uma impressora está lenta)
 * - Deduplicação de jobs (evita reimprimir se reportJobComplete falhar)
 * - Retry automático para impressoras com timeout
 * - Logs com timestamp para diagnóstico
 * - Watchdog: detecta se polling parou e reinicia automaticamente
 * - Graceful shutdown (SIGINT/SIGTERM)
 * 
 * Uso: node print-agent.js
 * Porta padrão: 9111 (API HTTP) | Impressoras: configuradas via /config ou printers.json
 */

const express = require("express");
const cors = require("cors");
const net = require("net");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PRINT_AGENT_PORT || 9111;
const CONFIG_FILE = path.join(__dirname, "printers.json");

// --- Logging ---
function log(level, module, message) {
  const ts = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const prefix = `[${ts}] [${level.toUpperCase()}] [${module}]`;
  if (level === "error") {
    console.error(`${prefix} ${message}`);
  } else if (level === "warn") {
    console.warn(`${prefix} ${message}`);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

// --- Config ---
let printersConfig = loadConfig();

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
      return config;
    }
  } catch (e) {
    console.error(`[Config] Erro ao carregar configuração: ${e.message}`);
  }
  // Configuração padrão
  return {
    printers: [
      { department: "KITCHEN", name: "Cozinha", ip: "192.168.1.100", port: 9100, enabled: true },
      { department: "BAR", name: "Bar", ip: "192.168.1.101", port: 9100, enabled: true },
      { department: "CASHIER", name: "Caixa", ip: "192.168.1.102", port: 9100, enabled: true },
    ],
    serverUrl: "",
    companyId: null,
    pollingIntervalMs: 5000,
  };
}

function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(printersConfig, null, 2));
    log("info", "Config", "Configuração salva.");
  } catch (e) {
    log("error", "Config", `Erro ao salvar: ${e.message}`);
  }
}

// --- Middleware ---
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "PUT", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Chrome Private Network Access (PNA) headers
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  res.setHeader("Access-Control-Allow-Local-Network", "true");
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }
  next();
});

app.use(express.json({ limit: "1mb" }));

// --- ESC/POS Commands ---
const ESC = "\x1B";
const GS = "\x1D";
const ESCPOS = {
  INIT: ESC + "@",
  BOLD_ON: ESC + "E\x01",
  BOLD_OFF: ESC + "E\x00",
  DOUBLE_HEIGHT_ON: ESC + "!\x10",
  DOUBLE_WIDTH_ON: ESC + "!\x20",
  DOUBLE_ON: ESC + "!\x30",
  NORMAL: ESC + "!\x00",
  ALIGN_CENTER: ESC + "a\x01",
  ALIGN_LEFT: ESC + "a\x00",
  ALIGN_RIGHT: ESC + "a\x02",
  CUT: GS + "V\x00",
  PARTIAL_CUT: GS + "V\x01",
  FEED_3: ESC + "d\x03",
  FEED_5: ESC + "d\x05",
  LINE: "------------------------------------------------\n",
  DASHED: "- - - - - - - - - - - - - - - - - - - - - - - -\n",
};

function wrapTicketAlert(value, maxCharacters = 22) {
  const words = String(value ?? "").trim().toUpperCase().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxCharacters && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) lines.push(line);
  return lines.length > 0 ? lines : ["OBSERVAÇÃO INFORMADA"];
}

// --- Formatters ---
function formatProductionTicket(data) {
  const { tableNumber, orderId, items, destination, timestamp, waiterName, customerLabel } = data;
  const time = new Date(timestamp || Date.now()).toLocaleTimeString("pt-BR", {
    hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo"
  });
  const destLabel = destination === "KITCHEN" ? "COZINHA" : destination === "BAR" ? "BAR" : destination;

  let buf = "";
  buf += ESCPOS.INIT;
  buf += ESCPOS.ALIGN_CENTER;
  buf += ESCPOS.DOUBLE_ON;
  buf += `*** ${destLabel} ***\n`;
  buf += ESCPOS.NORMAL;
  buf += ESCPOS.LINE;
  buf += ESCPOS.ALIGN_LEFT;
  buf += ESCPOS.BOLD_ON;
  buf += `Mesa: ${tableNumber}    Comanda: #${orderId}\n`;
  if (customerLabel) buf += `Cliente: ${customerLabel}\n`;
  buf += ESCPOS.BOLD_OFF;
  buf += `Hora: ${time}`;
  if (waiterName) buf += `  Garcom: ${waiterName}`;
  buf += "\n";
  buf += ESCPOS.LINE;
  buf += ESCPOS.BOLD_ON;
  buf += "QTD   ITEM\n";
  buf += ESCPOS.BOLD_OFF;
  buf += ESCPOS.DASHED;

  for (const item of items) {
    const qty = String(item.quantity).padEnd(5);
    buf += ESCPOS.DOUBLE_HEIGHT_ON;
    buf += `${qty} ${item.productName}\n`;
    buf += ESCPOS.NORMAL;
    if (item.notes) {
      buf += ESCPOS.LINE;
      buf += ESCPOS.ALIGN_CENTER;
      buf += ESCPOS.BOLD_ON;
      buf += ESCPOS.DOUBLE_ON;
      buf += "!!! OBSERVACAO !!!\n";
      buf += ESCPOS.NORMAL;
      buf += ESCPOS.BOLD_OFF;
      buf += ESCPOS.ALIGN_LEFT;
      buf += ESCPOS.BOLD_ON;
      for (const noteLine of wrapTicketAlert(item.notes)) {
        buf += ESCPOS.DOUBLE_ON;
        buf += `>>> ${noteLine}\n`;
      }
      buf += ESCPOS.NORMAL;
      buf += ESCPOS.BOLD_OFF;
      buf += ESCPOS.LINE;
    }
  }

  buf += ESCPOS.LINE;
  buf += ESCPOS.ALIGN_CENTER;
  buf += `Pedido recebido: ${time}\n`;
  buf += ESCPOS.FEED_5;
  buf += ESCPOS.PARTIAL_CUT;
  return buf;
}

function formatReceipt(data) {
  const {
    tableNumber, orderId, waiterName, guestCount, items,
    subtotal, tipPercent, tipAmount, totalAmount,
    totalSemServico, perPerson, companyName, permanencia,
    openedAt, gratuityLabel, timestamp
  } = data;

  const time = openedAt
    ? new Date(openedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" })
    : new Date(timestamp || Date.now()).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  const date = openedAt
    ? new Date(openedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : new Date(timestamp || Date.now()).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const tipLabel = gratuityLabel || "Taxa de servico";

  let buf = "";
  buf += ESCPOS.INIT;
  buf += ESCPOS.ALIGN_CENTER;
  buf += ESCPOS.BOLD_ON;
  buf += ESCPOS.DOUBLE_ON;
  buf += `A Brasa Reune\n`;
  buf += ESCPOS.NORMAL;
  buf += ESCPOS.BOLD_ON;
  buf += `Pre-visualizacao da Conta\n`;
  buf += `Mesa ${tableNumber}\n`;
  buf += ESCPOS.BOLD_OFF;
  buf += ESCPOS.LINE;
  buf += ESCPOS.ALIGN_LEFT;
  buf += `Comanda #${orderId}\n`;
  buf += `Mesa ${tableNumber} - ${guestCount || 1} pessoa(s)\n`;
  buf += `Garcom: ${waiterName || "-"}\n`;
  buf += `\n`;
  buf += `Abertura: ${date}, ${time}\n`;
  buf += `Permanencia: ${permanencia || "-"}\n`;
  buf += ESCPOS.LINE;

  buf += ESCPOS.BOLD_ON;
  buf += padRight("ITEM", 18) + padRight("QTD", 5) + padRight("VLR UNIT", 10) + padLeft("TOTAL", 9) + "\n";
  buf += ESCPOS.BOLD_OFF;
  buf += ESCPOS.DASHED;

  for (const item of items) {
    const name = truncate(item.productName, 18);
    const qty = String(item.quantity).padEnd(5);
    const unitP = formatMoney(item.unitPrice);
    const totalP = formatMoney(item.totalPrice);
    buf += `${padRight(name, 18)}${qty}${padRight(unitP, 10)}${padLeft(totalP, 9)}\n`;
  }

  buf += ESCPOS.LINE;
  buf += padRight("Subtotal", 30) + padLeft(formatMoney(subtotal), 12) + "\n";

  if (tipPercent > 0) {
    buf += padRight(`${tipLabel} (${tipPercent}%)`, 30) + padLeft(formatMoney(tipAmount), 12) + "\n";
  }

  buf += ESCPOS.BOLD_ON;
  buf += padRight("Total com servico", 30) + padLeft(formatMoney(totalAmount), 12) + "\n";
  buf += ESCPOS.BOLD_OFF;
  buf += padRight("Total sem servico", 30) + padLeft(formatMoney(totalSemServico ?? subtotal), 12) + "\n";

  if (guestCount > 1 && perPerson > 0) {
    buf += padRight(`Por pessoa (${guestCount})`, 30) + padLeft(formatMoney(perPerson), 12) + "\n";
  }

  buf += "\n";
  buf += ESCPOS.ALIGN_CENTER;
  buf += `${tipLabel} (${tipPercent || 10}%) e opcional.\n`;
  buf += `Informe ao atendente caso nao\n`;
  buf += `deseje incluir.\n`;
  buf += "\n";
  buf += "Obrigado pela preferencia!\n";
  buf += ESCPOS.FEED_5;
  buf += ESCPOS.PARTIAL_CUT;
  return buf;
}

// --- Helpers ---
function padRight(str, len) {
  return (str || "").substring(0, len).padEnd(len);
}
function padLeft(str, len) {
  return (str || "").substring(0, len).padStart(len);
}
function truncate(str, len) {
  if (!str) return "";
  return str.length > len ? str.substring(0, len - 1) + "." : str;
}
function formatMoney(value) {
  const num = typeof value === "string" ? parseFloat(value) : (value || 0);
  return num.toFixed(2).replace(".", ",");
}

// --- TCP Print (com retry) ---
function sendToPrinter(printerIp, printerPort, data, retries = 1) {
  return new Promise((resolve, reject) => {
    let attempt = 0;

    function tryConnect() {
      attempt++;
      const client = new net.Socket();
      const timeout = setTimeout(() => {
        client.destroy();
        if (attempt <= retries) {
          log("warn", "TCP", `Timeout ${printerIp}:${printerPort} (tentativa ${attempt}/${retries + 1}), retrying...`);
          setTimeout(tryConnect, 500);
        } else {
          reject(new Error(`Timeout conectando em ${printerIp}:${printerPort} após ${attempt} tentativa(s)`));
        }
      }, 5000); // 5s TCP timeout (era 3s)

      client.connect(printerPort, printerIp, () => {
        clearTimeout(timeout);
        client.write(Buffer.from(data, "latin1"), (err) => {
          client.end();
          if (err) reject(err);
          else resolve({ success: true, printer: `${printerIp}:${printerPort}` });
        });
      });

      client.on("error", (err) => {
        clearTimeout(timeout);
        if (attempt <= retries) {
          log("warn", "TCP", `Erro ${printerIp}:${printerPort} (tentativa ${attempt}/${retries + 1}): ${err.message}, retrying...`);
          setTimeout(tryConnect, 500);
        } else {
          reject(new Error(`Erro na impressora ${printerIp}:${printerPort}: ${err.message}`));
        }
      });
    }

    tryConnect();
  });
}

/**
 * Executa um job de impressão
 */
async function executePrintJob(type, department, data) {
  const printer = printersConfig.printers.find(
    p => p.department === department && p.enabled
  );

  if (!printer) {
    throw new Error(`Nenhuma impressora ativa para departamento: ${department}`);
  }

  let formatted;
  switch (type) {
    case "production_ticket":
      formatted = formatProductionTicket({ ...data, destination: department });
      break;
    case "receipt":
      formatted = formatReceipt(data);
      break;
    case "raw":
      formatted = data.content || "";
      break;
    default:
      throw new Error(`Tipo desconhecido: ${type}`);
  }

  const result = await sendToPrinter(printer.ip, printer.port, formatted);
  log("info", "Print", `${type} → ${printer.name} (${printer.ip}:${printer.port}) OK`);
  return { ...result, printer: printer.name };
}

// --- Statistics ---
const stats = {
  startedAt: new Date(),
  directPrints: 0,
  queuePrints: 0,
  errors: 0,
  lastPrintAt: null,
  lastError: null,
};

// --- Routes ---

// Health check / Status
app.get("/status", (req, res) => {
  res.json({
    status: "online",
    version: "3.0.0",
    port: PORT,
    polling: isPollingActive(),
    pollingInterval: printersConfig.pollingIntervalMs || 5000,
    printers: printersConfig.printers.map(p => ({
      department: p.department,
      name: p.name,
      ip: p.ip,
      port: p.port,
      enabled: p.enabled,
    })),
    serverUrl: printersConfig.serverUrl || null,
    companyId: printersConfig.companyId || null,
    stats: {
      uptime: Math.floor((Date.now() - stats.startedAt.getTime()) / 1000),
      directPrints: stats.directPrints,
      queuePrints: stats.queuePrints,
      errors: stats.errors,
      lastPrintAt: stats.lastPrintAt,
      lastError: stats.lastError,
    },
    timestamp: new Date().toISOString(),
  });
});

// Get config
app.get("/config", (req, res) => {
  res.json(printersConfig);
});

// Update config
app.put("/config", (req, res) => {
  const { printers, serverUrl, companyId, pollingIntervalMs } = req.body;
  if (printers && Array.isArray(printers)) {
    printersConfig.printers = printers;
  }
  if (serverUrl !== undefined) {
    printersConfig.serverUrl = serverUrl;
  }
  if (companyId !== undefined) {
    printersConfig.companyId = companyId;
  }
  if (pollingIntervalMs !== undefined) {
    printersConfig.pollingIntervalMs = Math.max(3000, pollingIntervalMs);
  }
  saveConfig();
  startPolling();
  res.json({ success: true, config: printersConfig });
});

// Test printer connection
app.post("/test", async (req, res) => {
  const { department, ip, port } = req.body;
  const printerIp = ip || printersConfig.printers.find(p => p.department === department)?.ip;
  const printerPort = port || printersConfig.printers.find(p => p.department === department)?.port || 9100;

  if (!printerIp) {
    return res.status(400).json({ error: "Impressora não encontrada para o departamento" });
  }

  try {
    const testData = ESCPOS.INIT + ESCPOS.ALIGN_CENTER + ESCPOS.BOLD_ON +
      "*** TESTE DE IMPRESSAO ***\n" + ESCPOS.BOLD_OFF + ESCPOS.NORMAL +
      `Impressora: ${department}\n` +
      `IP: ${printerIp}:${printerPort}\n` +
      `Agent v3.0 | Porta API: ${PORT}\n` +
      `Data: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}\n` +
      ESCPOS.FEED_3 + ESCPOS.PARTIAL_CUT;

    await sendToPrinter(printerIp, printerPort, testData, 0);
    res.json({ success: true, message: `Teste enviado para ${printerIp}:${printerPort}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Print job (direct HTTP — usado pelo KDS no computador central)
app.post("/print", async (req, res) => {
  const { type, department, data } = req.body;

  if (!type || !department || !data) {
    return res.status(400).json({ error: "Campos obrigatórios: type, department, data" });
  }

  try {
    const result = await executePrintJob(type, department, data);
    stats.directPrints++;
    stats.lastPrintAt = new Date().toISOString();
    res.json({ success: true, ...result });
  } catch (err) {
    stats.errors++;
    stats.lastError = { time: new Date().toISOString(), message: err.message, department };
    log("error", "Print", `ERRO ${type} → ${department}: ${err.message}`);
    const printer = printersConfig.printers.find(p => p.department === department);
    res.status(500).json({
      success: false,
      type: "PRINTER_ERROR",
      error: err.message,
      message: `Erro na impressora ${printer?.name || department} (${printer?.ip || "?"}:${printer?.port || "?"}): ${err.message}`,
      printer: printer?.name || department,
      printerIp: printer?.ip,
      port: printer?.port,
    });
  }
});

// Print to multiple departments (for items with destination BOTH)
app.post("/print-multi", async (req, res) => {
  const { type, departments, data } = req.body;

  if (!type || !departments || !data) {
    return res.status(400).json({ error: "Campos obrigatórios: type, departments, data" });
  }

  // Processar em paralelo (não sequencial como v2)
  const results = await Promise.allSettled(
    departments.map(async (dept) => {
      try {
        const result = await executePrintJob(type, dept, data);
        return { department: dept, success: true, printer: result.printer };
      } catch (err) {
        log("error", "Print-Multi", `ERRO → ${dept}: ${err.message}`);
        return { department: dept, success: false, error: err.message };
      }
    })
  );

  const mapped = results.map(r => r.status === "fulfilled" ? r.value : { success: false, error: r.reason?.message });
  stats.directPrints += mapped.filter(r => r.success).length;
  stats.errors += mapped.filter(r => !r.success).length;
  res.json({ results: mapped });
});

// ==================== SERVER POLLING (PRINT QUEUE) ====================

let pollingTimeout = null;
let pollingActive = false;
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 5;
const processedJobIds = new Set();
const DEDUP_TTL_MS = 5 * 60 * 1000;

// Limpa IDs antigos do set de deduplicação periodicamente
setInterval(() => {
  if (processedJobIds.size > 1000) {
    processedJobIds.clear();
    log("info", "Queue", "Cache de deduplicação limpo (>1000 entries)");
  }
}, DEDUP_TTL_MS);

function isPollingActive() {
  return pollingActive && !!printersConfig.serverUrl && !!printersConfig.companyId;
}

async function pollForJobs() {
  if (!printersConfig.serverUrl || !printersConfig.companyId) return;

  const url = `${printersConfig.serverUrl}/api/print-jobs/pending?companyId=${printersConfig.companyId}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15000),
    });

    if (response.status === 429) {
      consecutiveErrors++;
      const backoffMs = Math.min(30000, 5000 * consecutiveErrors);
      log("warn", "Queue", `Rate limited (429). Backoff ${backoffMs / 1000}s`);
      scheduleNextPoll(backoffMs);
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const { jobs } = await response.json();
    consecutiveErrors = 0;

    if (!jobs || jobs.length === 0) {
      scheduleNextPoll();
      return;
    }

    log("info", "Queue", `Recebidos ${jobs.length} job(s) da fila`);

    // Processar jobs em paralelo
    await Promise.allSettled(
      jobs.map(async (job) => {
        if (processedJobIds.has(job.id)) {
          log("info", "Queue", `Job #${job.id} já processado (dedup), reportando...`);
          await reportJobComplete(job.id, true);
          return;
        }

        try {
          await executePrintJob(job.type, job.department, job.payload);
          processedJobIds.add(job.id);
          await reportJobComplete(job.id, true);
          stats.queuePrints++;
          stats.lastPrintAt = new Date().toISOString();
          log("info", "Queue", `Job #${job.id} (${job.type}/${job.department}) ✓ impresso`);
        } catch (err) {
          processedJobIds.add(job.id);
          await reportJobComplete(job.id, false, err.message);
          stats.errors++;
          log("error", "Queue", `Job #${job.id} ERRO: ${err.message}`);
        }
      })
    );

    scheduleNextPoll();
  } catch (err) {
    consecutiveErrors++;
    if (consecutiveErrors <= 3 || consecutiveErrors % 5 === 0) {
      log("error", "Queue", `Erro ao buscar jobs (${consecutiveErrors}x): ${err.message}`);
    }

    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      const backoffMs = Math.min(60000, 10000 * consecutiveErrors);
      log("warn", "Queue", `Muitos erros (${consecutiveErrors}). Backoff ${backoffMs / 1000}s`);
      scheduleNextPoll(backoffMs);
    } else {
      const backoffMs = Math.min(15000, (printersConfig.pollingIntervalMs || 5000) + consecutiveErrors * 2000);
      scheduleNextPoll(backoffMs);
    }
  }
}

async function reportJobComplete(jobId, success, error) {
  if (!printersConfig.serverUrl) return;

  const url = `${printersConfig.serverUrl}/api/print-jobs/complete`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, success, error }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    log("error", "Queue", `Erro ao reportar job #${jobId}: ${err.message}`);
  }
}

function scheduleNextPoll(customDelayMs) {
  if (!pollingActive) return;
  const delay = customDelayMs || printersConfig.pollingIntervalMs || 5000;
  if (pollingTimeout) clearTimeout(pollingTimeout);
  pollingTimeout = setTimeout(pollForJobs, delay);
}

function startPolling() {
  stopPolling();
  if (!printersConfig.serverUrl || !printersConfig.companyId) {
    log("info", "Queue", "Polling desativado (serverUrl ou companyId não configurados)");
    return;
  }

  const interval = Math.max(3000, printersConfig.pollingIntervalMs || 5000);
  pollingActive = true;
  consecutiveErrors = 0;
  log("info", "Queue", `Polling ativado: ${printersConfig.serverUrl} a cada ${interval}ms (companyId: ${printersConfig.companyId})`);
  pollForJobs();
}

function stopPolling() {
  if (pollingTimeout) {
    clearTimeout(pollingTimeout);
    pollingTimeout = null;
  }
  pollingActive = false;
}

// --- Watchdog: reinicia polling se parou inesperadamente ---
setInterval(() => {
  if (printersConfig.serverUrl && printersConfig.companyId && !pollingActive) {
    log("warn", "Watchdog", "Polling parou inesperadamente. Reiniciando...");
    startPolling();
  }
}, 60000);

// --- Graceful Shutdown ---
function shutdown(signal) {
  log("info", "System", `Recebido ${signal}. Encerrando...`);
  stopPolling();
  process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// --- Start ---
app.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║       ABRWF Print Agent v3.0                        ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║  API HTTP: http://localhost:${PORT}                    ║`);
  console.log("║  Status: ONLINE                                     ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log("║  Impressoras configuradas:                          ║");
  for (const p of printersConfig.printers) {
    const status = p.enabled ? "✓" : "✗";
    console.log(`║  ${status} ${p.name.padEnd(10)} → ${p.ip}:${p.port}`.padEnd(55) + "║");
  }
  console.log("╠══════════════════════════════════════════════════════╣");
  if (printersConfig.serverUrl && printersConfig.companyId) {
    console.log(`║  Fila: ${printersConfig.serverUrl}`.padEnd(55) + "║");
    console.log(`║  Company: ${printersConfig.companyId} | Poll: ${printersConfig.pollingIntervalMs || 5000}ms`.padEnd(55) + "║");
  } else {
    console.log("║  Fila: DESATIVADA (configure serverUrl/companyId)   ║");
  }
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("");

  startPolling();
});
