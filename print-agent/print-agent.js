/**
 * ABRWF Print Agent v2.0
 * Serviço local que:
 *  1) Recebe comandos de impressão diretos via HTTP (desktop/KDS)
 *  2) Faz POLLING no servidor cloud para buscar jobs da fila (mobile/garçom)
 * 
 * Envia diretamente para impressoras térmicas via TCP (ESC/POS).
 * 
 * Roda no computador central do restaurante.
 * 
 * Uso: node print-agent.js
 * Porta padrão: 9100 (API) | Impressoras: configuradas via /config ou printers.json
 */

const express = require("express");
const cors = require("cors");
const net = require("net");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PRINT_AGENT_PORT || 9100;
const CONFIG_FILE = path.join(__dirname, "printers.json");

// --- Config ---
let printersConfig = loadConfig();

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("[Config] Erro ao carregar configuração:", e.message);
  }
  // Configuração padrão
  return {
    printers: [
      { department: "KITCHEN", name: "Cozinha", ip: "192.168.1.100", port: 9100, enabled: true },
      { department: "BAR", name: "Bar", ip: "192.168.1.101", port: 9100, enabled: true },
      { department: "CASHIER", name: "Caixa", ip: "192.168.1.102", port: 9100, enabled: true },
    ],
    // Configuração do servidor cloud para polling de fila de impressão
    serverUrl: "",   // Ex: "https://abrwf.com.br" — se vazio, polling desativado
    companyId: null, // Ex: 1 — ID da empresa no sistema
    pollingIntervalMs: 2000, // Intervalo de polling em ms (padrão: 2s)
  };
}

function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(printersConfig, null, 2));
    console.log("[Config] Configuração salva.");
  } catch (e) {
    console.error("[Config] Erro ao salvar:", e.message);
  }
}

// --- Middleware ---
app.use(cors({
  origin: true, // Aceita qualquer origem (local)
  methods: ["GET", "POST", "PUT", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Chrome Local Network Access (LNA) / Private Network Access (PNA)
// O Chrome exige estes headers para permitir acesso de HTTPS → HTTP local
app.use((req, res, next) => {
  // Responde ao preflight de Private Network Access
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
  INIT: ESC + "@",                    // Initialize printer
  BOLD_ON: ESC + "E\x01",            // Bold on
  BOLD_OFF: ESC + "E\x00",           // Bold off
  DOUBLE_HEIGHT_ON: ESC + "!\x10",   // Double height
  DOUBLE_WIDTH_ON: ESC + "!\x20",    // Double width
  DOUBLE_ON: ESC + "!\x30",          // Double width + height
  NORMAL: ESC + "!\x00",             // Normal size
  ALIGN_CENTER: ESC + "a\x01",       // Center align
  ALIGN_LEFT: ESC + "a\x00",        // Left align
  ALIGN_RIGHT: ESC + "a\x02",       // Right align
  CUT: GS + "V\x00",                // Full cut
  PARTIAL_CUT: GS + "V\x01",        // Partial cut
  FEED_3: ESC + "d\x03",            // Feed 3 lines
  FEED_5: ESC + "d\x05",            // Feed 5 lines
  LINE: "------------------------------------------------\n",
  DASHED: "- - - - - - - - - - - - - - - - - - - - - - - -\n",
};

// --- Formatters ---
function formatProductionTicket(data) {
  const { tableNumber, orderId, items, destination, timestamp } = data;
  const time = new Date(timestamp || Date.now()).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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
  buf += ESCPOS.BOLD_OFF;
  buf += `Hora: ${time}\n`;
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
      buf += `      OBS: ${item.notes}\n`;
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
  const { tableNumber, orderId, waiterName, items, subtotal, tipPercent, tipAmount, totalAmount, companyName, timestamp } = data;
  const time = new Date(timestamp || Date.now()).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const date = new Date(timestamp || Date.now()).toLocaleDateString("pt-BR");

  let buf = "";
  buf += ESCPOS.INIT;
  buf += ESCPOS.ALIGN_CENTER;
  buf += ESCPOS.BOLD_ON;
  buf += ESCPOS.DOUBLE_ON;
  buf += `${companyName || "A Brasa Reune"}\n`;
  buf += ESCPOS.NORMAL;
  buf += ESCPOS.BOLD_OFF;
  buf += `${date} ${time}\n`;
  buf += ESCPOS.LINE;
  buf += ESCPOS.ALIGN_LEFT;
  buf += `Mesa: ${tableNumber}  Comanda: #${orderId}\n`;
  buf += `Garcom: ${waiterName || "-"}\n`;
  buf += ESCPOS.LINE;
  buf += ESCPOS.BOLD_ON;
  buf += padRight("ITEM", 24) + padRight("QTD", 5) + padLeft("VALOR", 10) + "\n";
  buf += ESCPOS.BOLD_OFF;
  buf += ESCPOS.DASHED;

  for (const item of items) {
    const name = truncate(item.productName, 24);
    const qty = String(item.quantity).padEnd(5);
    const price = formatMoney(item.totalPrice);
    buf += `${padRight(name, 24)}${qty}${padLeft(price, 10)}\n`;
  }

  buf += ESCPOS.LINE;
  buf += padRight("Subtotal:", 30) + padLeft(formatMoney(subtotal), 10) + "\n";
  if (tipPercent > 0) {
    buf += padRight(`Taxa Serviço (${tipPercent}%):`, 30) + padLeft(formatMoney(tipAmount), 10) + "\n";
  }
  buf += ESCPOS.BOLD_ON;
  buf += ESCPOS.DOUBLE_HEIGHT_ON;
  buf += padRight("TOTAL:", 20) + padLeft(formatMoney(totalAmount), 12) + "\n";
  buf += ESCPOS.NORMAL;
  buf += ESCPOS.BOLD_OFF;
  buf += ESCPOS.LINE;
  buf += ESCPOS.ALIGN_CENTER;
  buf += "Obrigado pela preferencia!\n";
  buf += "Volte sempre!\n";
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

// --- TCP Print ---
function sendToPrinter(printerIp, printerPort, data) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    const timeout = setTimeout(() => {
      client.destroy();
      reject(new Error(`Timeout conectando em ${printerIp}:${printerPort}`));
    }, 3000); // 3s TCP timeout (reduzido para responder rápido ao site)

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
      reject(new Error(`Erro na impressora ${printerIp}:${printerPort}: ${err.message}`));
    });
  });
}

/**
 * Executa um job de impressão (usado tanto por HTTP direto quanto pelo polling)
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
  console.log(`[Print] ${type} → ${printer.name} (${printer.ip}:${printer.port}) OK`);
  return { ...result, printer: printer.name };
}

// --- Routes ---

// Health check
app.get("/status", (req, res) => {
  res.json({
    status: "online",
    version: "2.0.0",
    polling: isPollingActive(),
    printers: printersConfig.printers.map(p => ({
      department: p.department,
      name: p.name,
      ip: p.ip,
      port: p.port,
      enabled: p.enabled,
    })),
    serverUrl: printersConfig.serverUrl || null,
    companyId: printersConfig.companyId || null,
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
    printersConfig.pollingIntervalMs = pollingIntervalMs;
  }
  saveConfig();
  // Restart polling with new config
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
      `Data: ${new Date().toLocaleString("pt-BR")}\n` +
      ESCPOS.FEED_3 + ESCPOS.PARTIAL_CUT;

    await sendToPrinter(printerIp, printerPort, testData);
    res.json({ success: true, message: `Teste enviado para ${printerIp}:${printerPort}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Print job (direct HTTP — used by desktop/KDS on same machine)
app.post("/print", async (req, res) => {
  const { type, department, data } = req.body;

  if (!type || !department || !data) {
    return res.status(400).json({ error: "Campos obrigatórios: type, department, data" });
  }

  try {
    const result = await executePrintJob(type, department, data);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(`[Print] ERRO ${type} → ${department}:`, err.message);
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

  const results = [];
  for (const dept of departments) {
    try {
      const result = await executePrintJob(type, dept, data);
      results.push({ department: dept, success: true, printer: result.printer });
    } catch (err) {
      results.push({ department: dept, success: false, error: err.message });
      console.error(`[Print-Multi] ERRO → ${dept}:`, err.message);
    }
  }
  res.json({ results });
});

// ==================== SERVER POLLING (PRINT QUEUE) ====================

let pollingInterval = null;
let pollingActive = false;
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 10; // Backoff after 10 consecutive errors

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
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const { jobs } = await response.json();
    consecutiveErrors = 0; // Reset on success

    if (!jobs || jobs.length === 0) return;

    console.log(`[Queue] Recebidos ${jobs.length} job(s) da fila`);

    // Process each job
    for (const job of jobs) {
      try {
        await executePrintJob(job.type, job.department, job.payload);
        // Report success
        await reportJobComplete(job.id, true);
        console.log(`[Queue] Job #${job.id} (${job.type}/${job.department}) ✓ impresso`);
      } catch (err) {
        // Report failure
        await reportJobComplete(job.id, false, err.message);
        console.error(`[Queue] Job #${job.id} ERRO:`, err.message);
      }
    }
  } catch (err) {
    consecutiveErrors++;
    if (consecutiveErrors <= 3 || consecutiveErrors % 10 === 0) {
      console.error(`[Queue] Erro ao buscar jobs (${consecutiveErrors}x):`, err.message);
    }
    // Backoff: if too many errors, slow down polling
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      stopPolling();
      const backoffMs = 30000; // 30s backoff
      console.warn(`[Queue] Muitos erros consecutivos. Tentando novamente em ${backoffMs / 1000}s...`);
      setTimeout(() => startPolling(), backoffMs);
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
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error(`[Queue] Erro ao reportar job #${jobId}:`, err.message);
  }
}

function startPolling() {
  stopPolling(); // Clear any existing interval
  if (!printersConfig.serverUrl || !printersConfig.companyId) {
    console.log("[Queue] Polling desativado (serverUrl ou companyId não configurados)");
    return;
  }

  const interval = printersConfig.pollingIntervalMs || 2000;
  pollingActive = true;
  consecutiveErrors = 0;
  pollingInterval = setInterval(pollForJobs, interval);
  console.log(`[Queue] Polling ativado: ${printersConfig.serverUrl} a cada ${interval}ms (companyId: ${printersConfig.companyId})`);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  pollingActive = false;
}

// --- Start ---
app.listen(PORT, "0.0.0.0", () => {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║     ABRWF Print Agent v2.0                      ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log(`║  API: http://localhost:${PORT}                     ║`);
  console.log("║  Status: ONLINE                                 ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log("║  Impressoras configuradas:                      ║");
  for (const p of printersConfig.printers) {
    const status = p.enabled ? "✓" : "✗";
    console.log(`║  ${status} ${p.name.padEnd(10)} → ${p.ip}:${p.port}`.padEnd(51) + "║");
  }
  console.log("╠══════════════════════════════════════════════════╣");
  if (printersConfig.serverUrl && printersConfig.companyId) {
    console.log(`║  Fila: ${printersConfig.serverUrl}`.padEnd(51) + "║");
    console.log(`║  Company: ${printersConfig.companyId}`.padEnd(51) + "║");
  } else {
    console.log("║  Fila: DESATIVADA (configure serverUrl/companyId)║");
  }
  console.log("╚══════════════════════════════════════════════════╝");

  // Start polling if configured
  startPolling();
});
