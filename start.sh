#!/bin/bash

# Script para iniciar o sistema Microblog em Mac/Linux
# Inicia user-api e post-api em paralelo

echo ""
echo "============================================================"
echo "  🚀 Iniciando Microblog - User API e Post API"
echo "============================================================"
echo ""

# Verificar se estamos na pasta certa
if [ ! -f "user-api/package.json" ] || [ ! -f "post-api/package.json" ]; then
    echo "❌ Erro: Execute este script na pasta raiz do projeto"
    exit 1
fi

# Função para iniciar um serviço
start_service() {
    local service=$1
    local port=$2
    
    cd "$service"
    echo "Starting $service (port $port)..."
    npm start
    cd ..
}

# Iniciar ambos os serviços em background
start_service "user-api" "8080" &
USER_API_PID=$!

sleep 3

start_service "post-api" "8081" &
POST_API_PID=$!

echo ""
echo "============================================================"
echo "  ✅ Serviços iniciados!"
echo "============================================================"
echo ""
echo "  User API:  http://localhost:8080"
echo "  Post API:  http://localhost:8081"
echo ""
echo "  PIDs:"
echo "    - User API: $USER_API_PID"
echo "    - Post API: $POST_API_PID"
echo ""
echo "  Para parar os serviços: Ctrl+C ou kill $USER_API_PID $POST_API_PID"
echo ""

# Aguardar ambos os processos
wait
