#!/bin/bash

# Script para configurar o agendamento de backup automático
# Executa o backup diariamente às 3h da manhã (GMT-3)

PROJECT_DIR="/home/ubuntu/erp-demo"
BACKUP_SCRIPT="$PROJECT_DIR/scripts/backup.mjs"
LOG_FILE="$PROJECT_DIR/backups/backup.log"

# Criar diretório de backups se não existir
mkdir -p "$PROJECT_DIR/backups"

# Criar arquivo de log
touch "$LOG_FILE"

# Cron job: Executar às 3h da manhã (GMT-3)
# Nota: O servidor pode estar em UTC, então ajustamos para 6h UTC (3h GMT-3)
CRON_SCHEDULE="0 6 * * * cd $PROJECT_DIR && node $BACKUP_SCRIPT >> $LOG_FILE 2>&1"

# Verificar se o cron job já existe
if crontab -l 2>/dev/null | grep -q "backup.mjs"; then
    echo "✓ Cron job para backup já está configurado"
else
    # Adicionar novo cron job
    (crontab -l 2>/dev/null; echo "$CRON_SCHEDULE") | crontab -
    echo "✓ Cron job configurado com sucesso"
    echo "  Agendamento: Diariamente às 3h da manhã (GMT-3)"
    echo "  Log: $LOG_FILE"
fi

# Exibir cron jobs ativos
echo ""
echo "Cron jobs ativos para backup:"
crontab -l 2>/dev/null | grep "backup.mjs" || echo "Nenhum cron job encontrado"
