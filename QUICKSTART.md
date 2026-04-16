# 🚀 Quickstart - Microblog

Guia rápido para executar o sistema sem erros.

## ⚙️ Pré-requisitos

- **Node.js** v18+ instalado
- **MySQL** rodando em `localhost:3306`
- **Git Bash** ou PowerShell

## 📋 Passo a Passo

### 1️⃣ Instalar dependências

```bash
cd user-api && npm install
cd ../post-api && npm install
cd ..
```

### 2️⃣ Criar/importar banco de dados

No MySQL:
```bash
mysql -u ifsp -p < datas/user_db.sql
mysql -u ifsp -p < datas/post_db.sql
```

Ou use o MySQL Workbench para importar os arquivos SQL.

### 3️⃣ Inicializar dados de teste

```bash
node init.js
```

Isso vai:
- ✅ Conectar ao banco de dados
- ✅ Criar tabelas
- ✅ Inserir departamentos (TI, RH)
- ✅ Criar usuários de teste (alice, bob, admin)
- ✅ Exibir credenciais

### 4️⃣ Iniciar os serviços

**Terminal 1:**
```bash
cd user-api
npm start
```

**Terminal 2:**
```bash
cd post-api
npm start
```

### ✅ Verificar se está rodando

```bash
# User API
curl http://localhost:8080/health

# Post API
curl http://localhost:8081/health
```

Você deve ver:
```json
{"status":"OK","service":"user-api","timestamp":"2026-04-15T..."}
```

## 🧪 Testar API

### Login
```bash
curl -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"123"}'
```

Resposta com token:
```json
{
  "token": "eyJhbGc...",
  "user": {...}
}
```

### Criar post
```bash
curl -X POST http://localhost:8081/api/posts \
  -H "Authorization: Bearer <seu_token>" \
  -H "Content-Type: application/json" \
  -d '{"content":"Olá mundo!"}'
```

## 🐛 Solução de problemas

### "ECONNREFUSED - Connection refused"
- MySQL não está rodando
- Use: `mysql.server start` (Mac) ou abra MySQL Workbench

### "ER_ACCESS_DENIED_FOR_USER"
- Verifique credenciais no `.env` (user: `ifsp`, pass: `ifsp`)
- Crie o usuário no MySQL se necessário

### "Port already in use"
- Mude `PORT` no `.env`
- Ou mate o processo: `lsof -i :8080` (Mac/Linux)

## 📚 Recursos

- **Guia completo:** [Guia_Didatico_Vulnerabilidades.md](./Guia_Didatico_Vulnerabilidades.md)
- **Frontend:** [frontend/index.html](./frontend/index.html)
- **Documentação API:** Veja endpoints em `/health` de cada serviço

---

**Pronto!** Você está com o sistema executando. Agora pode testar as vulnerabilidades! 🔐
