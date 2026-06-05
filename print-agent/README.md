# ABRWF Print Agent

Serviço local para impressão térmica direta via ESC/POS. Roda no computador central do restaurante e recebe comandos de impressão do sistema web, direcionando automaticamente para a impressora correta de cada departamento.

## Requisitos

- Node.js 18+ instalado no computador central
- Impressoras térmicas conectadas via rede (Ethernet ou Wi-Fi)
- Impressoras com suporte a ESC/POS (Epson, Elgin, Bematech, Daruma, etc.)

## Instalação

```bash
cd print-agent
npm install
```

## Configuração

Edite o arquivo `printers.json` com os IPs das suas impressoras:

```json
{
  "printers": [
    { "department": "KITCHEN", "name": "Cozinha", "ip": "192.168.1.100", "port": 9100, "enabled": true },
    { "department": "BAR", "name": "Bar", "ip": "192.168.1.101", "port": 9100, "enabled": true },
    { "department": "CASHIER", "name": "Caixa", "ip": "192.168.1.102", "port": 9100, "enabled": true }
  ]
}
```

A porta padrão das impressoras térmicas de rede é **9100** (RAW printing).

## Uso

```bash
npm start
```

O agente inicia na porta **9100** (API). O sistema web detecta automaticamente quando o agente está ativo.

## Iniciar com o Windows

Para iniciar automaticamente com o Windows, crie um atalho do arquivo `start-agent.bat` na pasta de Inicialização:

1. Pressione `Win + R` e digite `shell:startup`
2. Cole o atalho de `start-agent.bat` nesta pasta

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /status | Health check e lista de impressoras |
| GET | /config | Retorna configuração atual |
| PUT | /config | Atualiza configuração de impressoras |
| POST | /test | Testa conexão com uma impressora |
| POST | /print | Envia job de impressão para um departamento |
| POST | /print-multi | Envia job para múltiplos departamentos |

## Teste de Impressora

```bash
curl -X POST http://localhost:9100/test -H "Content-Type: application/json" -d '{"department": "KITCHEN"}'
```

## Solução de Problemas

1. **Impressora não responde:** Verifique se o IP está correto e se a impressora está na mesma rede
2. **Timeout:** A impressora pode estar desligada ou com cabo desconectado
3. **Caracteres estranhos:** Verifique se a impressora suporta ESC/POS (maioria das térmicas suporta)
4. **Porta em uso:** Altere a porta do agente com `PRINT_AGENT_PORT=9101 npm start`
