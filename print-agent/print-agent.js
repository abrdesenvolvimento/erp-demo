/**
 * ABRWF Print Agent v1.0
 * Serviço local que recebe comandos de impressão do sistema web
 * e envia diretamente para impressoras térmicas via TCP (ESC/POS).
 * 
 * Roda no computador central do restaurante.
 * 
 * Uso: node print-agent.js
 * Porta padrão: 9100 (API) | Impressoras: configuradas via /config
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
    ]
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
    }, 5000);

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

// --- Routes ---

// Health check
app.get("/status", (req, res) => {
  res.json({
    status: "online",
    version: "1.0.0",
    printers: printersConfig.printers.map(p => ({
      department: p.department,
      name: p.name,
      ip: p.ip,
      port: p.port,
      enabled: p.enabled,
    })),
    timestamp: new Date().toISOString(),
  });
});

// Get config
app.get("/config", (req, res) => {
  res.json(printersConfig);
});

// Update config
app.put("/config", (req, res) => {
  const { printers } = req.body;
  if (!Array.isArray(printers)) {
    return res.status(400).json({ error: "printers deve ser um array" });
  }
  printersConfig.printers = printers;
  saveConfig();
  res.json({ success: true, printers: printersConfig.printers });
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

// Print job
app.post("/print", async (req, res) => {
  const { type, department, data } = req.body;

  if (!type || !department || !data) {
    return res.status(400).json({ error: "Campos obrigatórios: type, department, data" });
  }

  // Find printer for department
  const printer = printersConfig.printers.find(
    p => p.department === department && p.enabled
  );

  if (!printer) {
    return res.status(404).json({ error: `Nenhuma impressora ativa para departamento: ${department}` });
  }

  try {
    let formatted;
    switch (type) {
      case "production_ticket":
        formatted = formatProductionTicket(data);
        break;
      case "receipt":
        formatted = formatReceipt(data);
        break;
      case "raw":
        formatted = data.content || "";
        break;
      default:
        return res.status(400).json({ error: `Tipo desconhecido: ${type}` });
    }

    const result = await sendToPrinter(printer.ip, printer.port, formatted);
    console.log(`[Print] ${type} → ${printer.name} (${printer.ip}:${printer.port}) OK`);
    res.json({ success: true, printer: printer.name, ...result });
  } catch (err) {
    console.error(`[Print] ERRO ${type} → ${printer.name}:`, err.message);
    res.status(500).json({ success: false, error: err.message, printer: printer.name });
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
    const printer = printersConfig.printers.find(p => p.department === dept && p.enabled);
    if (!printer) {
      results.push({ department: dept, success: false, error: "Impressora não encontrada" });
      continue;
    }
    try {
      let formatted;
      switch (type) {
        case "production_ticket":
          formatted = formatProductionTicket({ ...data, destination: dept });
          break;
        case "receipt":
          formatted = formatReceipt(data);
          break;
        default:
          formatted = data.content || "";
      }
      await sendToPrinter(printer.ip, printer.port, formatted);
      results.push({ department: dept, success: true, printer: printer.name });
      console.log(`[Print-Multi] ${type} → ${printer.name} OK`);
    } catch (err) {
      results.push({ department: dept, success: false, error: err.message });
      console.error(`[Print-Multi] ERRO → ${printer.name}:`, err.message);
    }
  }
  res.json({ results });
});

// --- Start ---
app.listen(PORT, "0.0.0.0", () => {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║     ABRWF Print Agent v1.0                  ║");
  console.log("╠══════════════════════════════════════════════╣");
  console.log(`║  API: http://localhost:${PORT}                 ║`);
  console.log("║  Status: ONLINE                             ║");
  console.log("╠══════════════════════════════════════════════╣");
  console.log("║  Impressoras configuradas:                  ║");
  for (const p of printersConfig.printers) {
    const status = p.enabled ? "✓" : "✗";
    console.log(`║  ${status} ${p.name.padEnd(10)} → ${p.ip}:${p.port}`.padEnd(47) + "║");
  }
  console.log("╚══════════════════════════════════════════════╝");
});
