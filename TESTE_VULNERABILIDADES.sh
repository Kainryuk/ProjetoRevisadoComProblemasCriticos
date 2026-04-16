#!/usr/bin/env bash
# Script para testar todas as vulnerabilidades do Microblog
# Requisito: curl e jq instalados

API_USER="http://localhost:8080"
API_POST="http://localhost:8081"

RESET='\033[0m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'

function log_test() {
    echo -e "${YELLOW}[TEST] $1${RESET}"
}

function log_fail() {
    echo -e "${RED}❌ $1${RESET}"
}

function log_pass() {
    echo -e "${GREEN}✅ $1${RESET}"
}

echo -e "\n${YELLOW}═══════════════════════════════════════════════════${RESET}"
echo -e "${YELLOW}   🔴 TESTE DE VULNERABILIDADES - Microblog${RESET}"
echo -e "${YELLOW}═══════════════════════════════════════════════════${RESET}\n"

# Teste 1: Criar admin sem autenticação (Mass Assignment)
log_test "Vulnerabilidade 1: Mass Assignment - Criar ADMIN sem auth"
RESPONSE=$(curl -s -X POST $API_USER/api/usuarios \
  -H "Content-Type: application/json" \
  -d '{"username":"hacker1","password":"hacker123","role":"ADMIN","departmentId":1}')

ROLE=$(echo $RESPONSE | jq -r '.role')
if [ "$ROLE" = "ADMIN" ]; then
    log_fail "Sistema permitiu criar ADMIN sem autenticação! ❌"
    echo "Response: $RESPONSE\n"
else
    log_pass "Sistema rejeitou! (Role é: $ROLE ou erro)"
fi

# Teste 2: Login para obter tokens
log_test "Preparando: Login dos usuários"
TOKEN_ALICE=$(curl -s -X POST $API_USER/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"123"}' | jq -r '.token')

TOKEN_BOB=$(curl -s -X POST $API_USER/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"bob","password":"123"}' | jq -r '.token')

TOKEN_ADMIN=$(curl -s -X POST $API_USER/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.token')

if [ -z "$TOKEN_ALICE" ] || [ "$TOKEN_ALICE" = "null" ]; then
    log_fail "Erro ao fazer login! Verifique se as APIs estão rodando."
    exit 1
fi

log_pass "Tokens obtidos"

# Teste 3: Escalação de privilégio
log_test "Vulnerabilidade 2: Escalação de Privilégio - Alice se promove"
RESPONSE=$(curl -s -X PATCH $API_USER/api/usuarios/1/promote \
  -H "Authorization: Bearer $TOKEN_ALICE" \
  -H "Content-Type: application/json" \
  -d '{"role":"ADMIN"}')

RESULT=$(echo $RESPONSE | jq -r '.error // .message')
if [[ "$RESULT" == *"Acesso apenas para administradores"* ]] || [[ "$RESULT" == *"admin"* ]]; then
    log_pass "Sistema bloqueou acesso!"
else
    log_fail "Alice conseguiu se promover! Response: $RESULT"
fi

# Teste 4: IDOR - Deletar outro usuário
log_test "Vulnerabilidade 3: IDOR - Alice tenta deletar Bob"
RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE $API_USER/api/usuarios/2 \
  -H "Authorization: Bearer $TOKEN_ALICE")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "403" ]; then
    log_pass "Sistema bloqueou com 403 Forbidden!"
else
    log_fail "Sistema respondeu com código $HTTP_CODE (esperado 403)"
fi

# Teste 5: BOLA - Ver todos os usuários
log_test "Vulnerabilidade 4: BOLA - Alice tenta listar todos os usuários"
RESPONSE=$(curl -s -X GET $API_USER/api/usuarios \
  -H "Authorization: Bearer $TOKEN_ALICE")

ERROR=$(echo $RESPONSE | jq -r '.error // empty')
if [ -z "$ERROR" ]; then
    COUNT=$(echo $RESPONSE | jq 'length')
    log_fail "Alice conseguiu ver $COUNT usuários! Response: $RESPONSE"
else
    log_pass "Sistema bloqueou com erro: $ERROR"
fi

# Teste 6: Criar post
log_test "Preparando: Criar post de teste"
POST_RESPONSE=$(curl -s -X POST $API_POST/api/posts \
  -H "Authorization: Bearer $TOKEN_BOB" \
  -H "Content-Type: application/json" \
  -d '{"content":"Post original do Bob - Departamento RH"}')

POST_ID=$(echo $POST_RESPONSE | jq -r '.id')
log_pass "Post criado com ID: $POST_ID"

# Teste 7: BOLA - Ver posts de outro departamento
log_test "Vulnerabilidade 5: BOLA - Alice tenta ver posts de Bob (outro depto)"
RESPONSE=$(curl -s -X GET $API_POST/api/posts \
  -H "Authorization: Bearer $TOKEN_ALICE")

HAS_BOB=$(echo $RESPONSE | jq --arg bob "Bob" 'map(select(.content | contains($bob))) | length')
if [ "$HAS_BOB" -gt 0 ]; then
    log_fail "Alice conseguiu ver posts de outro departamento! Posts encontrados: $HAS_BOB"
else
    log_pass "Alice não consegue ver posts de outro departamento"
fi

# Teste 8: IDOR - Editar post de outro usuário
log_test "Vulnerabilidade 6: IDOR - Alice tenta editar post de Bob"
RESPONSE=$(curl -s -X PUT $API_POST/api/posts/$POST_ID \
  -H "Authorization: Bearer $TOKEN_ALICE" \
  -H "Content-Type: application/json" \
  -d '{"content":"Editado por Alice - HACKED!"}')

ERROR=$(echo $RESPONSE | jq -r '.error // empty')
if [ -z "$ERROR" ]; then
    log_fail "Alice conseguiu editar post de Bob! Response: $RESPONSE"
else
    log_pass "Sistema bloqueou: $ERROR"
fi

# Teste 9: IDOR - Deletar post de outro usuário
log_test "Vulnerabilidade 7: IDOR - Alice tenta deletar post de Bob"
RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE $API_POST/api/posts/$POST_ID \
  -H "Authorization: Bearer $TOKEN_ALICE")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "403" ]; then
    log_pass "Sistema bloqueou com 403 Forbidden!"
else
    log_fail "Sistema respondeu com código $HTTP_CODE (esperado 403)"
fi

# Teste 10: IDOR - Mudar visibilidade de post alheio
log_test "Vulnerabilidade 8: IDOR - Alice tenta ocultar post de Bob"
RESPONSE=$(curl -s -X PATCH $API_POST/api/posts/$POST_ID/visibility \
  -H "Authorization: Bearer $TOKEN_ALICE" \
  -H "Content-Type: application/json" \
  -d '{"visible":false}')

ERROR=$(echo $RESPONSE | jq -r '.error // empty')
if [ -z "$ERROR" ]; then
    log_fail "Alice conseguiu ocultar post de Bob! Response: $RESPONSE"
else
    log_pass "Sistema bloqueou: $ERROR"
fi

# Teste 11: Criar departamento como USER
log_test "Vulnerabilidade 9: Alice (USER) tenta criar departamento"
RESPONSE=$(curl -s -X POST $API_USER/api/departamentos \
  -H "Authorization: Bearer $TOKEN_ALICE" \
  -H "Content-Type: application/json" \
  -d '{"name":"Departamento Falso"}')

ERROR=$(echo $RESPONSE | jq -r '.error // empty')
if [ -z "$ERROR" ]; then
    log_fail "Alice conseguiu criar departamento! Response: $RESPONSE"
else
    log_pass "Sistema bloqueou: $ERROR"
fi

echo -e "\n${YELLOW}═══════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}   ✅ Testes de Segurança Concluídos${RESET}"
echo -e "${YELLOW}═══════════════════════════════════════════════════${RESET}\n"

echo "📊 Resumo:"
echo "   Se todos os testes mostrarem ✅, significa que as correções foram aplicadas!"
echo "   Se houver ❌, significa que a vulnerabilidade ainda existe.\n"
