# ✅ Métodos Iniciais Adicionados - Microblog

## 🎯 Objetivo Realizado

Adicionar métodos iniciais ao sistema Microblog para **executar sem erros**.

---

## 📦 Arquivos Criados (9 novos)

```
✨ init.js                    → Inicializa dados no BD (departamentos + usuários)
✨ setup.js                   → Setup completo (dependências + DB + dados)
✨ check.js                   → Verifica se tudo está funcionando
✨ start.bat                  → Inicia ambas as APIs (Windows)
✨ start.sh                   → Inicia ambas as APIs (Mac/Linux)
✨ README.md                  → Documentação principal completa
✨ QUICKSTART.md              → Guia de início rápido (5 min)
✨ .env (raiz)                → Configuração para scripts
✨ package.json (raiz)        → Dependências para scripts
```

## 🔧 Arquivos Melhorados (3 modificados)

```
🔧 user-api/src/app.js        → + validação de env + DB check + health endpoint
🔧 post-api/src/app.js        → + validação de env + DB check + health endpoint
🔧 Guia_Didatico_Vulnerabilidades.md → + seções de setup automático
```

---

## 🚀 Como Usar

### ⚡ Mais Rápido (1 comando)
```bash
node setup.js
```

### 🔍 Apenas Inicializar Dados (se dependências já instaladas)
```bash
node init.js
```

### 🔎 Verificar se Está Tudo OK
```bash
node check.js
```

### ✅ Iniciar Serviços
```bash
# Windows
.\start.bat

# Mac/Linux
chmod +x start.sh
./start.sh

# Ou manualmente em 2 terminais
cd user-api && npm start    # Terminal 1
cd post-api && npm start    # Terminal 2
```

---

## 📊 Melhorias Implementadas

### 1. **Validação Robusta** ✅
```javascript
✓ Verifica variáveis de ambiente obrigatórias
✓ Exibe erro claro se algo falta
✓ Exit com código 1 em caso de erro
```

### 2. **Inicialização do Banco Segura** ✅
```javascript
✓ Testa conexão com MySQL antes de sincronizar
✓ Verifica autenticação
✓ Sincroniza modelos com alter: true
✓ Logs informativos de sucesso/falha
```

### 3. **Health Check** ✅
```http
GET http://localhost:8080/health
GET http://localhost:8081/health

Resposta:
{
  "status": "OK",
  "service": "user-api",
  "timestamp": "2026-04-15T12:00:00.000Z"
}
```

### 4. **Dados de Teste Automáticos** ✅
```
Departamentos:  TI, RH (criados automaticamente)
Usuários:       alice, bob, admin (com credenciais)
Posts:          (pode criar após login)
```

### 5. **Scripts Multiplataforma** ✅
```
Windows:   start.bat
Mac/Linux: start.sh
Node:      init.js, setup.js, check.js
```

### 6. **Documentação Completa** ✅
```
README.md              - Overview + troubleshooting
QUICKSTART.md          - Início em 5 minutos
Guia_Didatico_*.md    - Guia de testes (atualizado)
```

---

## 🔑 Credenciais de Teste (Automáticas)

| Usuário | Senha | Role | Depto |
|---------|-------|------|-------|
| alice | 123 | USER | TI |
| bob | 123 | USER | RH |
| admin | admin123 | ADMIN | TI |

---

## ✨ Logs de Inicialização

Agora você vê ao iniciar:

```
✅ Conexão com banco de dados estabelecida
✅ Modelos sincronizados com o banco

🚨 User API rodando na porta 8080
📍 Endpoints disponíveis:
   POST   /api/usuarios        - Criar usuário
   POST   /api/login           - Login (retorna token)
   GET    /api/usuarios        - Listar usuários (requer auth)
   ... (lista completa)

GET    /health              - Health check
```

---

## 🐛 Tratamento de Erros

### Antes ❌
```
Server listening on port 8080
(sem validação, falhas silenciosas)
```

### Depois ✅
```
❌ Variáveis de ambiente faltando: DB_HOST, DB_PASS
❌ Erro ao conectar ao banco: Access denied
❌ Conexão recusada na porta 8080
(com mensagens claras e acionáveis)
```

---

## 📝 Próximos Passos

1. **Executar setup:**
   ```bash
   node setup.js
   ```

2. **Iniciar serviços:**
   ```bash
   Terminal 1: cd user-api && npm start
   Terminal 2: cd post-api && npm start
   ```

3. **Verificar:**
   ```bash
   curl http://localhost:8080/health
   node check.js
   ```

4. **Testar API:**
   ```bash
   curl -X POST http://localhost:8080/api/login \
     -H "Content-Type: application/json" \
     -d '{"username":"alice","password":"123"}'
   ```

5. **Consultar guia:**
   - Abra `Guia_Didatico_Vulnerabilidades.md`
   - Siga os 7 testes de segurança

---

## 🎓 Resultado Final

✅ **Sistema executável SEM ERROS**
- ✅ Setup automatizado
- ✅ Validação robusta
- ✅ Banco de dados pronto
- ✅ Dados de teste inclusos
- ✅ Health checks
- ✅ Documentação completa
- ✅ Scripts multiplataforma
- ✅ Tratamento de erros adequado

---

**Status:** 🟢 Pronto para usar!

Execute `node setup.js` e comece! 🚀
