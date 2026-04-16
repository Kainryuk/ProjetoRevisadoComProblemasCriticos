# 🔐 Microblog - Sistema de Testes de Vulnerabilidades em APIs REST

Uma aplicação educacional para aprender sobre **segurança em APIs** identificando e explorando vulnerabilidades comuns.

## 📋 Visão Geral

Este projeto simula um microblog com dois microsserviços:
- **user-api** (porta 8080): Gerenciamento de usuários e autenticação
- **post-api** (porta 8081): Gerenciamento de postagens

O sistema contém **vulnerabilidades intencionais** para fins didáticos, cobrindo:
- ✗ Broken Access Control (BOLA/IDOR)
- ✗ Privilege Escalation  
- ✗ Excessive Data Exposure
- ✗ Mass Assignment
- ✗ Falta de validação de autorização

## 🚀 Início Rápido

### 1️⃣ Setup Automático (Recomendado)
```bash
node setup.js
```

Isso vai:
- Instalar todas as dependências
- Validar banco de dados
- Criar dados de teste
- Exibir credenciais

### 2️⃣ Iniciar Serviços

Após o setup, em **2 terminais diferentes**:

```bash
# Terminal 1
cd user-api && npm start

# Terminal 2  
cd post-api && npm start
```

### 3️⃣ Verificar Inicialização
```bash
curl http://localhost:8080/health
curl http://localhost:8081/health
```

## 📦 Estrutura do Projeto

```
microblog-main/
├── user-api/              # Serviço de Usuários (porta 8080)
│   ├── src/app.js
│   ├── .env
│   └── package.json
├── post-api/              # Serviço de Posts (porta 8081)
│   ├── src/app.js
│   ├── .env
│   └── package.json
├── frontend/              # Interface web
│   ├── index.html
│   ├── script.js
│   └── style.css
├── datas/                 # Scripts SQL
│   ├── user_db.sql
│   └── post_db.sql
├── init.js               # Script de inicialização de dados
├── setup.js              # Script de setup completo
├── start.bat             # Script para iniciar (Windows)
├── QUICKSTART.md         # Guia rápido
├── Guia_Didatico_Vulnerabilidades.md  # Guia completo
└── README.md             # Este arquivo
```

## 🔑 Credenciais de Teste

Após executar `setup.js`, use:

| Usuário | Senha | Role | Departamento |
|---------|-------|------|---|
| alice | 123 | USER | TI |
| bob | 123 | USER | RH |
| admin | admin123 | ADMIN | TI |

## 🧪 Testes de Segurança

O guia completo em [Guia_Didatico_Vulnerabilidades.md](./Guia_Didatico_Vulnerabilidades.md) contém:

- **7 testes de vulnerabilidade**
- Endpoints e payloads
- Análise de cada falha
- Propostas de correção

### Exemplo: Listar Todos os Usuários

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"123"}' | jq -r .token)

# Acessar dados de outros usuários (vulnerável!)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/usuarios
```

## 🛠️ Troubleshooting

### Porta em uso
```bash
# Windows
netstat -ano | findstr :8080
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :8080
kill -9 <PID>
```

### Erro de conexão com MySQL
- Verifique se MySQL está rodando
- Confirme credenciais em `.env`:
  ```
  DB_USER=ifsp
  DB_PASS=ifsp
  DB_HOST=localhost
  ```

### Módulos não encontrados
```bash
cd user-api && npm install
cd ../post-api && npm install
```

## 📚 Documentação

| Arquivo | Descrição |
|---------|-----------|
| [QUICKSTART.md](./QUICKSTART.md) | Início rápido em 5 minutos |
| [Guia_Didatico_Vulnerabilidades.md](./Guia_Didatico_Vulnerabilidades.md) | Guia completo com 7 testes |

## 🔗 Endpoints Disponíveis

### User API (8080)

```
POST   /api/login                - Login (retorna token)
POST   /api/usuarios             - Criar usuário
GET    /api/usuarios             - Listar usuários (requer auth) ⚠️
GET    /api/usuarios/me          - Dados do usuário logado
PATCH  /api/usuarios/:id/promote - Promover a admin (requer auth) ⚠️
DELETE /api/usuarios/:id         - Deletar usuário (requer auth) ⚠️
GET    /api/departamentos        - Listar departamentos
POST   /api/departamentos        - Criar departamento
GET    /health                   - Health check
```

### Post API (8081)

```
POST   /api/posts                  - Criar post (requer auth)
GET    /api/posts                  - Listar posts (requer auth) ⚠️
PUT    /api/posts/:id              - Editar post (requer auth) ⚠️
PATCH  /api/posts/:id/visibility  - Mudar visibilidade (requer auth) ⚠️
DELETE /api/posts/:id              - Deletar post (requer auth) ⚠️
GET    /health                     - Health check
```

⚠️ = Endpoints com vulnerabilidades intencionais

## 🎓 Objetivos de Aprendizado

Ao concluir os testes, você será capaz de:

1. ✅ Identificar Broken Access Control (BOLA/IDOR)
2. ✅ Explorar vulnerabilidades de autorização
3. ✅ Entender os princípios de segurança corretos
4. ✅ Propor correções com código real
5. ✅ Relacionar com OWASP Top 10 (2021)

## 🔒 Princípios de Segurança Abordados

- Autenticação vs Autorização
- Validação de propriedade de recursos
- Role-Based Access Control (RBAC)
- Isolamento de dados por contexto
- Menor privilégio (Least Privilege)
- Mass Assignment prevention

## 👨‍🏫 Disciplina

- **Disciplina:** Desenvolvimento Web 3
- **Professor:** Leonardo Arruda
- **Instituição:** TADS · IFSP Campinas

## 📝 Licença

Projeto educacional para fins didáticos.

---

**Pronto para começar?** Execute `node setup.js` e comece a explorar! 🚀
