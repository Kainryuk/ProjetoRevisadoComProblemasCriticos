# 🔐 ANÁLISE COMPLETA DE VULNERABILIDADES - MICROBLOG API

## 📊 Resumo Executivo

| Total | Críticas | Altas | Médias |
|-------|----------|-------|--------|
| **15 vulnerabilidades** | 8 | 5 | 2 |

---

## 🔴 VULNERABILIDADES CRÍTICAS (8)

### 1. ⭐ CADASTRO ABERTO - Mass Assignment (POST /api/usuarios)

**Problema:**
```javascript
// user-api/src/app.js - linha 93
app.post('/api/usuarios', async (req, res) => {
    const { username, password, role, departmentId } = req.body;
    // ❌ Campo 'role' vem direto do body sem validação
    const user = await User.create({ username, password: hashed, role, departmentId });
});
```

**Vulnerabilidade:**
- Qualquer pessoa **sem autenticação** pode criar usuário
- Campo `role` é aceito **como está** do body
- Novo usuário pode se declarar `ADMIN` durante cadastro

**Como Testar:**
```bash
# Criar admin sem autenticação
curl -X POST http://localhost:8080/api/usuarios \
  -H "Content-Type: application/json" \
  -d '{
    "username": "hacker",
    "password": "hacker123",
    "role": "ADMIN",
    "departmentId": 1
  }'

# Resposta: 201 Created com role: ADMIN ❌

# Fazer login
curl -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"hacker","password":"hacker123"}'

# Token terá: {"role":"ADMIN",...} ❌
```

**Por Que é Crítico:**
- Qualquer pessoa vira admin instantaneamente
- Sem autenticação = bypass completo de autorização
- Permite ataques em massa

**Correção:**
```javascript
app.post('/api/usuarios', async (req, res) => {
    // ✅ 1. Validar entrada
    const { username, password, departmentId } = req.body;
    
    if (!username || !password || !departmentId) {
        return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }
    
    if (username.length < 3 || password.length < 6) {
        return res.status(400).json({ error: 'Username mín 3 chars, password mín 6' });
    }
    
    // ✅ 2. NUNCA aceitar role do body
    // role é SEMPRE 'USER' no cadastro
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ 
        username, 
        password: hashed, 
        role: 'USER',  // ✅ Hardcoded, não do body
        departmentId 
    });
    
    res.status(201).json({ 
        id: user.id, 
        username: user.username,
        role: user.role,
        departmentId: user.departmentId 
    });
});
```

---

### 2. ⭐ ESCALAÇÃO DE PRIVILÉGIO - Sem Validação (PATCH /api/usuarios/:id/promote)

**Problema:**
```javascript
// user-api/src/app.js - linha 116
app.patch('/api/usuarios/:id/promote', authenticate, async (req, res) => {
    const { role } = req.body;
    // ❌ Nenhuma validação: qualquer user autenticado pode promover qualquer um
    await User.update({ role }, { where: { id: req.params.id } });
});
```

**Vulnerabilidade:**
- Qualquer usuário autenticado pode promover qualquer pessoa a admin
- Sem validação de autorização (deve ser admin, não user)
- Sem validação de propriedade

**Como Testar:**
```bash
# Login como alice (USER)
TOKEN_ALICE=$(curl -s -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"123"}' | jq -r .token)

# Alice promove a SI MESMA a ADMIN
curl -X PATCH http://localhost:8080/api/usuarios/1/promote \
  -H "Authorization: Bearer $TOKEN_ALICE" \
  -H "Content-Type: application/json" \
  -d '{"role":"ADMIN"}'

# Resposta: 200 OK - alice agora é ADMIN ❌

# Ou alice promove bob para admin
curl -X PATCH http://localhost:8080/api/usuarios/2/promote \
  -H "Authorization: Bearer $TOKEN_ALICE" \
  -H "Content-Type: application/json" \
  -d '{"role":"ADMIN"}'
```

**Por Que é Crítico:**
- User comum vira admin
- Controle de acesso completamente quebrado
- Permite attack chain: criar user → promover a admin

**Correção:**
```javascript
// Adicionar middleware de autorização
function requireAdmin(req, res, next) {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Acesso apenas para admins' });
    }
    next();
}

app.patch('/api/usuarios/:id/promote', authenticate, requireAdmin, async (req, res) => {
    const { role } = req.body;
    
    // ✅ Validar role permitido
    if (!['USER', 'ADMIN'].includes(role)) {
        return res.status(400).json({ error: 'Role inválido' });
    }
    
    // ✅ Verificar se usuário existe
    const user = await User.findByPk(req.params.id);
    if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // ✅ Não permitir admin remover a si mesmo
    if (req.params.id == req.user.id && role === 'USER') {
        return res.status(403).json({ error: 'Você não pode rebaixar a si mesmo' });
    }
    
    await User.update({ role }, { where: { id: req.params.id } });
    const updated = await User.findByPk(req.params.id, { attributes: { exclude: ['password'] } });
    res.json({ message: `Role atualizado para ${role}`, user: updated });
});
```

---

### 3. ⭐ IDOR - Deletar Outro Usuário (DELETE /api/usuarios/:id)

**Problema:**
```javascript
// user-api/src/app.js - linha 127
app.delete('/api/usuarios/:id', authenticate, async (req, res) => {
    // ❌ Sem validação de autorização
    // ❌ Sem verificação se é o próprio usuário
    // ❌ Qualquer autenticado deleta qualquer um
    await User.destroy({ where: { id: req.params.id } });
    res.status(204).send();
});
```

**Vulnerabilidade:**
- IDOR clássico: Insecure Direct Object Reference
- Qualquer user pode deletar qualquer outro user
- Sem restrição de admin

**Como Testar:**
```bash
# Login como alice
TOKEN_ALICE=$(curl -s -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"123"}' | jq -r .token)

# Alice deleta bob (id=2)
curl -X DELETE http://localhost:8080/api/usuarios/2 \
  -H "Authorization: Bearer $TOKEN_ALICE"

# Resposta: 204 No Content - bob foi deletado ❌

# Tentar login como bob
curl -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"bob","password":"123"}'

# Erro: credenciais inválidas (usuário não existe)
```

**Por Que é Crítico:**
- Deletar contas de outros usuários
- Data integrity violation
- Denial of Service ataque

**Correção:**
```javascript
app.delete('/api/usuarios/:id', authenticate, requireAdmin, async (req, res) => {
    const userId = parseInt(req.params.id);
    
    // ✅ Validação de entrada
    if (isNaN(userId)) {
        return res.status(400).json({ error: 'ID inválido' });
    }
    
    // ✅ Não permitir deletar a si mesmo
    if (userId === req.user.id) {
        return res.status(403).json({ error: 'Você não pode deletar sua própria conta' });
    }
    
    // ✅ Verificar se usuário existe
    const user = await User.findByPk(userId);
    if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // ✅ Logar ação (auditoria)
    console.log(`[AUDIT] Admin ${req.user.id} deletou usuário ${userId}`);
    
    await User.destroy({ where: { id: userId } });
    res.status(204).send();
});
```

---

### 4. ⭐ BOLA - Ver Todos os Usuários (GET /api/usuarios)

**Problema:**
```javascript
// user-api/src/app.js - linha 108
app.get('/api/usuarios', authenticate, async (req, res) => {
    // ❌ Qualquer usuário autenticado vê TODOS
    // ❌ Sem validação de papel (role)
    // ❌ Sem validação de departamento
    const users = await User.findAll({ 
        attributes: { exclude: ['password'] },
        include: [Department] 
    });
    res.json(users);
});
```

**Vulnerabilidade:**
- BOLA: Broken Object Level Authorization
- Usuário comum vê todos os usuários do sistema
- Expõe estrutura organizacional

**Como Testar:**
```bash
# Login como alice (USER)
TOKEN=$(curl -s -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"123"}' | jq -r .token)

# Alice lista todos os usuários
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/usuarios

# Resposta:
# [
#   {"id":1,"username":"alice","role":"USER","departmentId":1,...},
#   {"id":2,"username":"bob","role":"USER","departmentId":2,...},
#   {"id":3,"username":"admin","role":"ADMIN","departmentId":1,...}
# ] ❌
```

**Por Que é Crítico:**
- Exposição de dados sensíveis
- Permite reconnaissance attack
- Usuários podem descobrir estrutura organizacional

**Correção:**
```javascript
app.get('/api/usuarios', authenticate, requireAdmin, async (req, res) => {
    // ✅ Apenas ADMIN pode listar todos
    // ✅ USER só vê a si mesmo (use /api/usuarios/me)
    const users = await User.findAll({ 
        attributes: { exclude: ['password'] },
        include: [Department] 
    });
    res.json(users);
});
```

---

### 5. ⭐ BOLA - Posts: Ver Todos (GET /api/posts)

**Problema:**
```javascript
// post-api/src/app.js - linha 56
app.get('/api/posts', authenticate, async (req, res) => {
    // ❌ Retorna TODOS os posts
    // ❌ Sem filtro por departamento
    // ❌ Sem filtro por visibilidade
    const posts = await Post.findAll({ order: [['createdAt', 'DESC']] });
    res.json(posts);
});
```

**Vulnerabilidade:**
- Qualquer usuário vê posts de outros departamentos
- Viola isolamento de dados

**Como Testar:**
```bash
# Login como alice (departamento TI)
TOKEN=$(curl -s -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"123"}' | jq -r .token)

# Alice vê posts de bob (departamento RH)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8081/api/posts

# Resposta mostra posts de ambos os departamentos ❌
```

**Correção:**
```javascript
app.get('/api/posts', authenticate, async (req, res) => {
    // ✅ USERs veem: posts do próprio depto (visible=true) + seus posts privados
    // ✅ ADMINs veem: todos
    
    let query;
    
    if (req.user.role === 'ADMIN') {
        // Admin vê tudo
        query = await Post.findAll({ order: [['createdAt', 'DESC']] });
    } else {
        // USER vê:
        // - Posts do seu depto que são visíveis
        // - Seus próprios posts (mesmo se privados)
        const { Op } = require('sequelize');
        query = await Post.findAll({
            where: {
                [Op.or]: [
                    { departmentId: req.user.departmentId, visible: true },
                    { userId: req.user.id }
                ]
            },
            order: [['createdAt', 'DESC']]
        });
    }
    
    res.json(query);
});
```

---

### 6. ⭐ IDOR - Editar Post Alheio (PUT /api/posts/:id)

**Problema:**
```javascript
// post-api/src/app.js - linha 62
app.put('/api/posts/:id', authenticate, async (req, res) => {
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });
    
    // ❌ Sem validação de propriedade
    // ❌ Qualquer um edita qualquer post
    // ❌ Aceita qualquer campo (mass assignment)
    await post.update(req.body);
    res.json(post);
});
```

**Vulnerabilidade:**
- IDOR: Qualquer um edita qualquer post
- Mass Assignment: Pode alterar userId, departmentId

**Como Testar:**
```bash
# Login como alice
TOKEN_ALICE=$(curl -s -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"123"}' | jq -r .token)

# Alice cria um post
POST_ID=$(curl -s -X POST http://localhost:8081/api/posts \
  -H "Authorization: Bearer $TOKEN_ALICE" \
  -H "Content-Type: application/json" \
  -d '{"content":"Post da alice"}' | jq -r .id)

# Login como bob
TOKEN_BOB=$(curl -s -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"bob","password":"123"}' | jq -r .token)

# Bob edita o post de alice
curl -X PUT http://localhost:8081/api/posts/$POST_ID \
  -H "Authorization: Bearer $TOKEN_BOB" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Editado por bob!",
    "userId": 2,
    "departmentId": 2
  }'

# Resposta: 200 OK - post foi alterado ❌
```

**Correção:**
```javascript
app.put('/api/posts/:id', authenticate, async (req, res) => {
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });
    
    // ✅ Validar propriedade: só o dono edita
    if (post.userId !== req.user.id) {
        return res.status(403).json({ error: 'Você não pode editar este post' });
    }
    
    // ✅ Aceitar apenas 'content'
    const { content } = req.body;
    
    if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'Conteúdo vazio' });
    }
    
    if (content.length > 5000) {
        return res.status(400).json({ error: 'Post muito longo (máx 5000 chars)' });
    }
    
    await post.update({ content });
    res.json(post);
});
```

---

### 7. ⭐ IDOR - Deletar Post (DELETE /api/posts/:id)

**Problema:**
```javascript
// post-api/src/app.js - linha 75
app.delete('/api/posts/:id', authenticate, async (req, res) => {
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });
    
    // ❌ Sem validação: qualquer um deleta qualquer post
    // ❌ Sem validação de admin
    await post.destroy();
    res.status(204).send();
});
```

**Vulnerabilidade:**
- Qualquer usuário deleta qualquer post
- Sem restrição de admin

**Como Testar:**
```bash
# Bob deleta post de alice
curl -X DELETE http://localhost:8081/api/posts/$POST_ID \
  -H "Authorization: Bearer $TOKEN_BOB"

# Resposta: 204 - post deletado ❌
```

**Correção:**
```javascript
app.delete('/api/posts/:id', authenticate, async (req, res) => {
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });
    
    // ✅ Apenas proprietário OU admin pode deletar
    const isOwner = post.userId === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';
    
    if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Você não pode deletar este post' });
    }
    
    console.log(`[AUDIT] Usuário ${req.user.id} deletou post ${post.id}`);
    
    await post.destroy();
    res.status(204).send();
});
```

---

### 8. ⭐ IDOR - Visibilidade de Post Alheio (PATCH /api/posts/:id/visibility)

**Problema:**
```javascript
// post-api/src/app.js - linha 68
app.patch('/api/posts/:id/visibility', authenticate, async (req, res) => {
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });
    
    // ❌ Sem validação de propriedade
    // ❌ Qualquer um oculta/mostra qualquer post
    await post.update({ visible: req.body.visible });
    res.json(post);
});
```

**Vulnerabilidade:**
- Qualquer um pode ocultar posts de outros

**Como Testar:**
```bash
# Bob oculta post de alice
curl -X PATCH http://localhost:8081/api/posts/$POST_ID/visibility \
  -H "Authorization: Bearer $TOKEN_BOB" \
  -H "Content-Type: application/json" \
  -d '{"visible": false}'

# Resposta: 200 OK - post ocultado por bob ❌
```

**Correção:**
```javascript
app.patch('/api/posts/:id/visibility', authenticate, async (req, res) => {
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });
    
    // ✅ Proprietário pode mudar sua própria visibilidade
    // ✅ Admin pode mudar qualquer uma
    const isOwner = post.userId === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';
    
    if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Você não pode alterar a visibilidade deste post' });
    }
    
    // ✅ Validar valor
    const { visible } = req.body;
    if (typeof visible !== 'boolean') {
        return res.status(400).json({ error: 'visible deve ser true ou false' });
    }
    
    await post.update({ visible });
    res.json(post);
});
```

---

## 🟠 VULNERABILIDADES ALTAS (5)

### 9. Sem Validação: Criar Departamento

**Problema:**
```javascript
// user-api/src/app.js - linha 137
app.post('/api/departamentos', authenticate, async (req, res) => {
    const { name } = req.body;
    // ❌ Sem validação se é admin
    // ❌ Sem validação de entrada
    const dept = await Department.create({ name });
    res.status(201).json(dept);
});
```

**Como Testar:**
```bash
# Alice (USER) cria departamento
curl -X POST http://localhost:8080/api/departamentos \
  -H "Authorization: Bearer $TOKEN_ALICE" \
  -H "Content-Type: application/json" \
  -d '{"name":"Departamento Falso"}'

# Resposta: 201 - Criado ❌
```

**Correção:**
```javascript
app.post('/api/departamentos', authenticate, requireAdmin, async (req, res) => {
    const { name } = req.body;
    
    if (!name || name.trim().length < 3) {
        return res.status(400).json({ error: 'Nome do departamento inválido' });
    }
    
    const dept = await Department.create({ name: name.trim() });
    res.status(201).json(dept);
});
```

---

### 10. Sem Filtro de Departamento: GET /api/departamentos

**Problema:**
```javascript
// user-api/src/app.js - linha 131
app.get('/api/departamentos', authenticate, async (req, res) => {
    // ❌ Qualquer um vê todos (normal, mas sem validação)
    const depts = await Department.findAll();
    res.json(depts);
});
```

**Nota:** Este é menos crítico, pois departamentos são info pública. Mas sem admin-only na criação, fica ruim.

**Correção:**
```javascript
app.get('/api/departamentos', authenticate, async (req, res) => {
    const depts = await Department.findAll();
    res.json(depts);
});

// Mantém igual, pois departamentos devem ser visíveis a todos
// Mas a CRIAÇÃO deve ser admin-only (vide #9)
```

---

### 11. Mass Assignment: PUT /api/posts/:id

**Problema:**
```javascript
// Ao aceitar req.body inteiro, permite alterar campos não desejados
await post.update(req.body);  // ❌ Poderia alterar userId, departmentId
```

**Como Testar:**
```bash
# Alice edita seu post MAS tenta alterar userId
curl -X PUT http://localhost:8081/api/posts/$POST_ID \
  -H "Authorization: Bearer $TOKEN_ALICE" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Novo conteúdo",
    "userId": 3,
    "departmentId": 2
  }'

# Resposta pode permitir alteração ❌
```

**Correção:**
```javascript
// Já incluída na correção de #6
const { content } = req.body;  // ✅ Apenas este campo
```

---

### 12. Sem Validação de Entrada em Login

**Problema:**
```javascript
// user-api/src/app.js - linha 71
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    // ❌ Sem validação de entrada
    const user = await User.findOne({ where: { username } });
});
```

**Como Testar:**
```bash
# Enviar null
curl -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":null,"password":null}'

# Ou injetar SQL (Node.js + Sequelize protege, mas é prática ruim)
```

**Correção:**
```javascript
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username e password obrigatórios' });
    }
    
    if (typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'Entrada inválida' });
    }
    
    const user = await User.findOne({ where: { username } });
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });
    
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });
    
    const token = jwt.sign(
        { id: user.id, role: user.role, departmentId: user.departmentId },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
    );
    res.json({
        token,
        user: {
            id: user.id,
            username: user.username,
            role: user.role,
            departmentId: user.departmentId,
            departmentName: user.Department ? user.Department.name : null
        }
    });
});
```

---

### 13. CORS Sem Restrição

**Problema:**
```javascript
// Ambos: user-api e post-api - linha 54
app.use(cors());  // ❌ Permite requisições de QUALQUER origem
```

**Por Que é Crítico:**
- Qualquer site pode fazer requisições
- CSRF attacks mais fáceis
- Exposição de dados

**Como Testar:**
```bash
# De um site malicioso, fazer requisição
fetch('http://localhost:8080/api/usuarios', {
  headers: { 'Authorization': 'Bearer ' + stolenToken }
})
```

**Correção:**
```javascript
// Configurar CORS restritivo
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5500', 'http://127.0.0.1:5500'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
```

---

## 🟡 VULNERABILIDADES MÉDIAS (2)

### 14. Sem Tratamento de Erros em Endpoints

**Problema:**
```javascript
// Nenhum try-catch em endpoints
app.get('/api/usuarios', authenticate, async (req, res) => {
    const users = await User.findAll(...);  // ❌ Se cair, exponha stack trace
});
```

**Correção:**
```javascript
app.get('/api/usuarios', authenticate, async (req, res) => {
    try {
        const users = await User.findAll({ 
            attributes: { exclude: ['password'] },
            include: [Department] 
        });
        res.json(users);
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});
```

---

### 15. Sem Rate Limiting

**Problema:**
- Nenhuma proteção contra brute force
- Nenhuma proteção contra DDoS

**Correção:**
```javascript
const rateLimit = require('express-rate-limit');

// Limite de login: 5 requisições por 15 minutos
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Muitas tentativas de login, tente mais tarde',
    standardHeaders: true,
    legacyHeaders: false
});

app.post('/api/login', loginLimiter, async (req, res) => {
    // ...
});

// Rate limit geral: 100 requisições por hora
const generalLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 100,
    skip: (req) => req.path === '/health'  // Não limitar health check
});

app.use(generalLimiter);
```

---

## 📋 TABELA RESUMO - FIXUP RÁPIDO

| # | Endpoint | Vulnerabilidade | Gravidade | Teste | Fix |
|---|----------|-----------------|-----------|-------|-----|
| 1 | POST /api/usuarios | Mass Assignment | 🔴 | Criar admin sem auth | Hardcode role='USER' |
| 2 | PATCH /api/usuarios/:id/promote | Priv Escalation | 🔴 | Alice promove a si | Verificar if admin |
| 3 | DELETE /api/usuarios/:id | IDOR | 🔴 | Alice deleta bob | Verificar if admin |
| 4 | GET /api/usuarios | BOLA | 🔴 | Ver todos | Admin-only |
| 5 | GET /api/posts | BOLA | 🔴 | Ver posts outros depto | Filtrar por dept |
| 6 | PUT /api/posts/:id | IDOR | 🔴 | Bob edita post alice | Verificar propriedade |
| 7 | DELETE /api/posts/:id | IDOR | 🔴 | Bob deleta post alice | Owner + admin |
| 8 | PATCH /api/posts/:id/visibility | IDOR | 🔴 | Bob oculta post alice | Owner + admin |
| 9 | POST /api/departamentos | Sem Auth | 🟠 | User cria depto | Admin-only |
| 10 | GET /api/departamentos | Info Leak | 🟠 | Ver todos (normal) | Deixar igual |
| 11 | PUT /api/posts/:id | Mass Assign | 🟠 | Alterar userId | Aceitar só content |
| 12 | POST /api/login | Sem Validação | 🟠 | Enviar null | Validar entrada |
| 13 | CORS | Sem Restrição | 🟠 | CSRF fácil | Whitelist origins |
| 14 | Todos | Sem Try-Catch | 🟡 | Error exposure | Envolver em try-catch |
| 15 | Todos | Sem Rate Limit | 🟡 | Brute force | Adicionar rate-limit |

---

## 🚀 PRÓXIMAS AÇÕES

### Passo 1: Criar Arquivo de Correções
Copie as correções acima para novos arquivos:
- `user-api-fixed.js`
- `post-api-fixed.js`

### Passo 2: Criar Testes Automatizados
Faça testes para cada vulnerabilidade usando `curl` ou Postman.

### Passo 3: Documentação
Entregue este relatório ao professor.

---

## 📝 Respostas às perguntas de segurança

### a) Por que confiar no front-end para controlar o acesso é perigoso?
Confiar no front-end para controlar o acesso é perigoso porque o código do navegador é controlado pelo usuário e pode ser facilmente alterado ou ignorado. No projeto, o frontend apenas renderiza botões e chama endpoints como `/api/posts/:id` ou `/api/usuarios` com o token, mas o backend não faz validações suficientes de autorização. Por exemplo, qualquer usuário autenticado pode chamar diretamente `PUT /api/posts/123` ou `DELETE /api/posts/123` para editar/excluir um post de outro departamento, mesmo que o UI só mostre esses botões para o autor. O cliente não é uma âncora de segurança; ele pode ser manipulado com console, proxy ou Postman, então todas as regras de acesso devem existir no servidor.

### b) Estratégia de longo prazo para evitar que essas vulnerabilidades voltem
A estratégia de longo prazo deve incluir autorização centralizada, testes automatizados de segurança, revisão de código e integração no pipeline CI/CD. Defina políticas de acesso em um módulo de autorização reutilizável, use bibliotecas como CASL ou accesscontrol para modelar permissões de forma declarativa e evite lógica dispersa em cada rota. Adicione testes de segurança que verifiquem cenários como: usuário comum não pode promover outro para ADMIN, não pode editar posts de outro departamento e não pode alterar `userId` ou `departmentId`. Use revisão de código com checklist de segurança para endpoints sensíveis e integre esses testes no CI/CD para que qualquer PR que quebre autorização falhe automaticamente. Assim a proteção é contínua, audível e não fica dependente de boas intenções do desenvolvedor.

### c) Como projetar o sistema desde o início para isolamento por departamento e autorização granular
Desde o início, a autorização deve viver no backend em camadas claras: autenticação, políticas de autorização e validação de entrada. Crie um middleware de autorização para verificar `req.user` e funções como `canViewPost(user, post)`, `canEditPost(user, post)` e `canManageUsers(user)` em um módulo separado. A lógica deve ser testada com unit tests das regras e integration tests de API que simulam usuários de diferentes departamentos e roles. Documente no README ou em `docs/authorization.md` a arquitetura de autorização, as roles existentes, as políticas de departamento e o fluxo de decisão. Isso ajuda novos desenvolvedores a entender que o servidor é responsável pelo isolamento, e torna o código fácil de manter e auditar.

---

**Relatório Gerado:** 15 de Abril de 2026
**Total de Vulnerabilidades:** 15 (8 Críticas, 5 Altas, 2 Médias)
