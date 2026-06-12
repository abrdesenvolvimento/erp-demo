/**
 * Instalador de Serviço Windows para o ABRWF Print Agent
 * 
 * Opções de instalação:
 * 1. Atalho na pasta Startup (mais simples, recomendado)
 * 2. Serviço Windows via NSSM (mais robusto, para uso avançado)
 * 
 * Uso: node install-service.js [--startup | --nssm]
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const AGENT_DIR = __dirname;
const BAT_FILE = path.join(AGENT_DIR, "start-agent.bat");

function getStartupFolder() {
  // Windows Startup folder
  return path.join(os.homedir(), "AppData", "Roaming", "Microsoft", "Windows", "Start Menu", "Programs", "Startup");
}

function installStartup() {
  const startupDir = getStartupFolder();
  const shortcutPath = path.join(startupDir, "ABRWF Print Agent.bat");

  // Cria um .bat na pasta Startup que chama o agent
  const content = `@echo off\r\ntitle ABRWF Print Agent\r\ncd /d "${AGENT_DIR}"\r\nstart /min "" node print-agent.js\r\n`;
  
  try {
    fs.writeFileSync(shortcutPath, content);
    console.log("✓ Print Agent instalado na Inicialização do Windows!");
    console.log(`  Arquivo: ${shortcutPath}`);
    console.log("");
    console.log("  O Print Agent será iniciado automaticamente ao ligar o computador.");
    console.log("  Para remover: delete o arquivo acima da pasta Startup.");
  } catch (err) {
    console.error(`✗ Erro ao instalar: ${err.message}`);
    console.error(`  Tente copiar manualmente o arquivo start-agent.bat para:`);
    console.error(`  ${startupDir}`);
  }
}

function installNSSM() {
  console.log("Instalação via NSSM (Non-Sucking Service Manager)");
  console.log("==================================================");
  console.log("");
  console.log("1. Baixe o NSSM: https://nssm.cc/download");
  console.log("2. Extraia e coloque nssm.exe em uma pasta no PATH");
  console.log("3. Execute como Administrador:");
  console.log("");
  console.log(`   nssm install ABRWFPrintAgent "${process.execPath}" "${path.join(AGENT_DIR, "print-agent.js")}"`);
  console.log(`   nssm set ABRWFPrintAgent AppDirectory "${AGENT_DIR}"`);
  console.log(`   nssm set ABRWFPrintAgent DisplayName "ABRWF Print Agent"`);
  console.log(`   nssm set ABRWFPrintAgent Description "Serviço de impressão térmica para Adega Beira Rio"`);
  console.log(`   nssm set ABRWFPrintAgent Start SERVICE_AUTO_START`);
  console.log(`   nssm start ABRWFPrintAgent`);
  console.log("");
  console.log("Para remover o serviço:");
  console.log("   nssm stop ABRWFPrintAgent");
  console.log("   nssm remove ABRWFPrintAgent confirm");
}

function showHelp() {
  console.log("ABRWF Print Agent - Instalador de Auto-Start");
  console.log("=============================================");
  console.log("");
  console.log("Uso: node install-service.js [opção]");
  console.log("");
  console.log("Opções:");
  console.log("  --startup    Instala atalho na pasta Inicialização do Windows (recomendado)");
  console.log("  --nssm       Mostra instruções para instalar como Serviço Windows via NSSM");
  console.log("  --help       Mostra esta ajuda");
  console.log("");
  console.log("Sem argumentos: instala na pasta Startup (padrão)");
}

// --- Main ---
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  showHelp();
} else if (args.includes("--nssm")) {
  installNSSM();
} else {
  // Default: instala na Startup
  installStartup();
}
