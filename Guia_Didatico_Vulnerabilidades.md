# 🧪 Guia Didático: Teste de Vulnerabilidades em API REST
## Estudo de Caso com Microblog

**Disciplina:** Desenvolvimento Web 3
**Professor:** Leonardo Arruda
**Instituição:** TADS · IFSP Campinas

---

## 1. Introdução

APIs REST são o principal canal de comunicação entre sistemas web modernos. A segurança dessas APIs não depende apenas de criptografia ou autenticação — depende, acima de tudo, de **autorização correta**: garantir que cada usuário só acesse e manipule os recursos que lhe pertencem.

Este guia apresenta um estudo de caso prático baseado em uma aplicação de microblog, onde usuários pertencem a departamentos e publicam mensagens. O sistema contém **vulnerabilidades intencionais** que simulam falhas comuns encontradas em projetos reais. O objetivo é que você as identifique, explore, entenda suas causas e proponha correções fundamentadas.

A atividade segue três etapas:

1. **Configuração do ambiente** e criação dos usuários de teste.
2. **Execução dos testes**, documentando requisições, respostas e análise de cada falha.
3. **Proposta de correção**, com código real e reflexão arquitetural.

---

## 2. Objetivos de Aprendizagem

Ao concluir este guia, você será capaz de:

1. Identificar e explorar vulnerabilidades comuns em APIs REST, incluindo BOLA, IDOR, Privilege Escalation, Excessive Data Exposure e Mass Assignment.
2. Executar testes de segurança manualmente com Thunder Client, Postman ou `curl`.
3. Relacionar cada falha encontrada com as categorias do **OWASP Top 10 (2021)**.
4. Propor correções aplicando os princípios de menor privilégio, validação de propriedade e RBAC (Role-Based Access Control).
5. Refletir sobre a importância de uma arquitetura segura desde as primeiras fases do desenvolvimento.

---

## 3. Descrição do Sistema

A aplicação possui dois microsserviços:

- **user-api** (porta 8080): gerencia usuários, autenticação e departamentos.
- **post-api** (porta 8081): gerencia postagens do microblog.

### Modelos de dados

**Usuário:** `id`, `username`, `password` (hash bcrypt), `role` (`USER` ou `ADMIN`), `departmentId`

**Post:** `id`, `content`, `userId` (autor), `departmentId`, `visible` (booleano)

### Regras de negócio esperadas (não implementadas na versão vulnerável)

| Ação | USER | ADMIN |
|---|:---:|:---:|
| Ver posts do próprio departamento (visíveis) | ✅ | ✅ |
| Ver posts de outros departamentos | ❌ | ✅ |
| Ver posts ocultos | ❌ (exceto os próprios) | ✅ |
| Criar post | ✅ | ✅ |
| Editar próprio post | ✅ | ❌ |
| Ocultar/mostrar próprio post | ✅ | ✅ (qualquer post) |
| Excluir post | ❌ | ✅ |
| Listar todos os usuários | ❌ | ✅ |
| Promover/rebaixar usuário | ❌ | ✅ |
| Excluir usuário | ❌ | ✅ |
| Criar departamento | ❌ | ✅ |

A versão vulnerável **viola todas essas regras**: qualquer usuário autenticado realiza qualquer ação.

---

## 4. Configuração do Ambiente

### 4.0. Setup Automático (Recomendado) ⭐

Para executar o sistema sem erros, use um dos scripts de inicialização:

#### Opção 1: Setup Completo
```bash
node setup.js
```

Este script:
- ✅ Instala dependências de todas as APIs
- ✅ Valida variáveis de ambiente
- ✅ Conecta ao banco de dados
- ✅ Cria tabelas e departamentos
- ✅ Cria usuários de teste
- ✅ Exibe credenciais e instruções

#### Opção 2: Apenas Inicializar Dados
Se as dependências já estão instaladas:
```bash
node init.js
```

#### Opção 3: Iniciar Serviços em Paralelo
**Windows:**
```bash
.\start.bat
```

**Mac/Linux:**
```bash
chmod +x start.sh
./start.sh
```

### 4.1. Pré-requisitos

- Node.js v18+ e MySQL rodando localmente.
- Serviços **user-api** (porta 8080) e **post-api** (porta 8081) iniciados com `npm start`.
- Frontend servido via **live-server** na porta 3000.
- Ferramenta de testes: **Thunder Client** (VS Code), **Postman** ou `curl`.

### 4.2. Criação dos departamentos

Antes de criar usuários, crie os departamentos. O endpoint exige autenticação, então crie primeiro um usuário temporário, faça login, e use o token:

```http
POST http://localhost:8080/api/departamentos
Content-Type: application/json

{ "name": "TI" }
```

```http
POST http://localhost:8080/api/departamentos
Content-Type: application/json

{ "name": "RH" }
```

> Guarde os IDs retornados (geralmente 1 e 2).
> 
> **Nota:** Se usou `node init.js` ou `node setup.js`, os departamentos já foram criados automaticamente!

### 4.3. Criação dos usuários de teste

O endpoint `POST /api/usuarios` é **público nesta versão**. Crie os três usuários abaixo:

```http
POST http://localhost:8080/api/usuarios
Content-Type: application/json

{ "username": "alice", "password": "123", "role": "USER", "departmentId": 1 }
```

```http
POST http://localhost:8080/api/usuarios
Content-Type: application/json

{ "username": "bob", "password": "123", "role": "USER", "departmentId": 2 }
```

```http
POST http://localhost:8080/api/usuarios
Content-Type: application/json

{ "username": "admin", "password": "admin123", "role": "ADMIN", "departmentId": 1 }
```

> **Atenção:** Observe que o campo `role` está sendo aceito livremente no cadastro. Isso já é uma vulnerabilidade. Retornaremos a isso no Teste 5.7.

### 4.3b. Verificar Inicialização (Health Check)

Para garantir que ambos os serviços iniciaram corretamente, execute:

**User API:**
```bash
curl http://localhost:8080/health
```

Resposta esperada:
```json
{"status":"OK","service":"user-api","timestamp":"2026-04-15T12:00:00.000Z"}
```

**Post API:**
```bash
curl http://localhost:8081/health
```

Resposta esperada:
```json
{"status":"OK","service":"post-api","timestamp":"2026-04-15T12:00:00.000Z"}
```

Se receber `Connection refused`, os serviços não iniciaram. Verifique:
- MySQL está rodando?
- Credenciais em `.env` estão corretas?
- As portas 8080 e 8081 estão livres?

### 4.4. Login e obtenção de tokens

Para cada usuário, faça login e **guarde o token retornado** — você precisará deles nos testes:

```http
POST http://localhost:8080/api/login
Content-Type: application/json

{ "username": "alice", "password": "123" }
```

Resposta esperada:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": 1, "username": "alice", "role": "USER", "departmentId": 1 }
}
```

Repita para `bob` e `admin`. Anote os três tokens e os IDs dos usuários — você vai precisar ao longo dos testes.

### 4.5. Criação de posts iniciais

Crie ao menos um post com cada usuário para ter dados para os testes:

```http
POST http://localhost:8081/api/posts
Authorization: Bearer <token_bob>
Content-Type: application/json

{ "content": "Post original do bob — departamento RH" }
```

> Guarde o `id` retornado (ex: `7`). Será usado nos testes 5.2 e 5.3.

```http
POST http://localhost:8081/api/posts
Authorization: Bearer <token_alice>
Content-Type: application/json

{ "content": "Post da alice — departamento TI" }
```

---

## 5. Roteiro de Testes

Para cada teste: anote a **requisição completa**, a **resposta obtida** e escreva uma análise explicando por que aquilo é um problema de segurança.

---

### Teste 5.1 — Falha de Isolamento por Departamento (BOLA)

**Categoria OWASP:** A01:2021 – Broken Access Control

**Objetivo:** Verificar se um usuário consegue ver posts de departamentos aos quais não pertence.

**Passos:**

1. Faça login como `alice` (departamento TI, id 1).
2. Execute:

```http
GET http://localhost:8081/api/posts
Authorization: Bearer <token_alice>
```

**Resultado esperado (incorreto):** A resposta lista **todos os posts** de todos os departamentos, inclusive os de `bob` (departamento RH).

**O problema:** A query `Post.findAll()` não aplica nenhum filtro de `departmentId`. Qualquer usuário autenticado recebe dados de outros departamentos.

**Pergunta para reflexão:** Que cláusula SQL/ORM resolveria esse problema? Ela deveria estar no endpoint ou em um middleware?

---

### Teste 5.2 — Edição de Post de Outro Usuário (BOLA)

**Categoria OWASP:** A01:2021 – Broken Access Control

**Objetivo:** Verificar se `alice` consegue editar um post que pertence a `bob`.

**Passos:**

1. Use o post de `bob` criado na seção 4.5 (id `7`).
2. Execute com o token de **alice**:

```http
PUT http://localhost:8081/api/posts/7
Authorization: Bearer <token_alice>
Content-Type: application/json

{ "content": "Editado pela alice (vulnerabilidade)" }
```

**Resultado esperado (incorreto):** Status `200` — o post é alterado com sucesso, mesmo `alice` não sendo a autora.

**O problema:** O endpoint `PUT /api/posts/:id` não verifica se `post.userId === req.user.id`. Qualquer autenticado edita qualquer post.

---

### Teste 5.2b — Alteração de Visibilidade de Post Alheio

**Categoria OWASP:** A01:2021 – Broken Access Control

**Objetivo:** Verificar se `alice` consegue ocultar um post de `bob`.

```http
PATCH http://localhost:8081/api/posts/7/visibility
Authorization: Bearer <token_alice>
Content-Type: application/json

{ "visible": false }
```

**Resultado esperado (incorreto):** Status `200` — o post de `bob` é ocultado por `alice`.

**O problema:** Assim como a edição, a rota de visibilidade não verifica a propriedade do recurso.

> Este teste cobre um vetor que o guia original não incluía. É importante testá-lo separadamente porque a correção para edição e para visibilidade podem ter lógicas diferentes — o dono pode ocultar seu post, mas o admin também pode ocultar qualquer post.

---

### Teste 5.3 — Exclusão de Post sem Ser Admin

**Categoria OWASP:** A01:2021 – Broken Access Control / Missing Function Level Access Control

**Objetivo:** Verificar se um usuário comum consegue excluir qualquer post.

**Importante:** Para este teste, crie um **novo post** com `bob` antes de executar (não use o mesmo do 5.2, pois seu estado pode ter sido alterado):

```http
POST http://localhost:8081/api/posts
Authorization: Bearer <token_bob>
Content-Type: application/json

{ "content": "Post para testar exclusão" }
```

Guarde o novo `id` (ex: `8`). Agora execute com o token de **alice**:

```http
DELETE http://localhost:8081/api/posts/8
Authorization: Bearer <token_alice>
```

**Resultado esperado (incorreto):** Status `204` — post excluído. Qualquer usuário comum pode excluir qualquer post.

**O problema:** A exclusão deveria ser restrita a ADMIN, mas não há verificação de `role`.

---

### Teste 5.4 — Exposição de Dados Sensíveis

**Categoria OWASP:** A01:2021 – Broken Access Control + A04:2021 – Insecure Design

**Objetivo:** Verificar se um usuário comum consegue listar todos os usuários do sistema.

```http
GET http://localhost:8080/api/usuarios
Authorization: Bearer <token_alice>
```

**Resultado esperado (incorreto):** Retorna todos os usuários com `id`, `username`, `role` e `departmentId`.

**O problema:** Dados administrativos (lista de usuários, seus papéis e departamentos) estão acessíveis a qualquer autenticado. Um atacante pode mapear toda a estrutura organizacional do sistema.

---

### Teste 5.5 — Escalada de Privilégio

**Categoria OWASP:** A01:2021 – Broken Access Control / Privilege Escalation

**Objetivo:** Verificar se `alice` consegue se promover a ADMIN.

Use o `id` de `alice` obtido na seção 4.4 (ex: `id = 1`):

```http
PATCH http://localhost:8080/api/usuarios/1/promote
Authorization: Bearer <token_alice>
Content-Type: application/json

{ "role": "ADMIN" }
```

**Resultado esperado (incorreto):** Status `200` — `alice` agora é ADMIN.

**O problema:** A rota de promoção não verifica se quem faz a requisição é ADMIN. Qualquer autenticado pode promover a si mesmo ou a qualquer outro usuário.

**Pergunta para reflexão:** Depois de executar este teste, `alice` tem um novo token? O que isso implica? Tente usar o token antigo de `alice` para fazer algo que só ADMIN pode fazer na versão corrigida.

---

### Teste 5.6 — IDOR: Exclusão de Outro Usuário

**Categoria OWASP:** A01:2021 – Broken Access Control / IDOR

**Objetivo:** Verificar se `alice` consegue excluir a conta de `bob`.

Use o `id` de `bob` (ex: `id = 2`):

```http
DELETE http://localhost:8080/api/usuarios/2
Authorization: Bearer <token_alice>
```

**Resultado esperado (incorreto):** Status `204` — `bob` é removido do sistema.

**O problema:** A URL aceita qualquer `id` como parâmetro e não valida se o usuário logado tem autoridade sobre aquele recurso. É um IDOR clássico: basta adivinhar ou descobrir o `id` de outro usuário.

---

### Teste 5.7 — Mass Assignment: Criação de Admin no Cadastro ⭐

**Categoria OWASP:** A04:2021 – Insecure Design / A08:2021 – Software and Data Integrity Failures

**Objetivo:** Verificar se é possível criar um usuário com `role: "ADMIN"` diretamente pelo endpoint de cadastro.

```http
POST http://localhost:8080/api/usuarios
Content-Type: application/json

{ "username": "hacker", "password": "hacker123", "role": "ADMIN", "departmentId": 1 }
```

Agora faça login com este usuário e verifique o token retornado:

```http
POST http://localhost:8080/api/login
Content-Type: application/json

{ "username": "hacker", "password": "hacker123" }
```

**Resultado esperado (incorreto):** O usuário `hacker` é criado com `role: "ADMIN"`. O token gerado no login já carrega essa role, dando acesso total ao sistema.

**O problema:** O endpoint de cadastro aceita o campo `role` do body sem restrição. O código `User.create({ ..., role })` passa o valor diretamente para o banco. Qualquer pessoa pode se auto-declarar administrador no momento do cadastro.

**Pergunta para reflexão:** Como a versão segura resolve isso? O campo `role` deve ser simplesmente ignorado, ou deve gerar um erro?

---

## 6. Relação com o OWASP Top 10

| Vulnerabilidade testada | Categoria OWASP | Princípio violado |
|---|---|---|
| Ver posts de outros departamentos (5.1) | A01 – Broken Access Control | Isolamento de dados por contexto |
| Editar/ocultar post alheio (5.2, 5.2b) | A01 – Broken Access Control | Validação de propriedade do recurso |
| Excluir post sem ser admin (5.3) | A01 – Broken Access Control | Controle de função por papel (RBAC) |
| Expor lista de usuários (5.4) | A01 + A04 – Insecure Design | Menor privilégio |
| Promover usuário sem ser admin (5.5) | A01 – Broken Access Control | Separação de privilégios |
| Excluir outro usuário (5.6) | A01 – Broken Access Control (IDOR) | Autorização em nível de objeto |
| Criar admin no cadastro (5.7) | A04 + A08 – Mass Assignment | Validação e sanitização de entrada |

> **Nota:** Todas as falhas giram em torno da categoria A01:2021 — Broken Access Control, a vulnerabilidade mais prevalente em aplicações web segundo o OWASP.

---

## 7. Atividade: Relatório Técnico

Após realizar todos os testes, elabore um **relatório técnico** respondendo aos itens abaixo. O relatório deve ter no máximo **3 páginas** (sem contar código).

### 7.1. Análise das Causas

Para **cada uma das 7 vulnerabilidades**, responda:

- Em qual endpoint ou trecho de código a falha está localizada?
- Qual princípio de segurança foi violado? (menor privilégio, validação de propriedade, separação de funções, etc.)
- A falha é no backend, no frontend, ou em ambos?

### 7.2. Proposta de Correção

Para cada falha, escreva o trecho de código corrigido (Node.js/Express) e explique em uma frase por que a correção resolve o problema.

**Exemplo de correção para o Teste 5.2 (edição de post alheio):**

```javascript
// PUT /api/posts/:id — versão corrigida
app.put('/api/posts/:id', authenticate, async (req, res) => {
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });

    // Verifica propriedade: apenas o dono pode editar
    if (post.userId !== req.user.id) {
        return res.status(403).json({ error: 'Você só pode editar seus próprios posts' });
    }

    const { content } = req.body; // aceita apenas o campo content — não req.body inteiro
    await post.update({ content });
    res.json(post);
});
```

**Por que funciona:** A verificação `post.userId !== req.user.id` garante que somente o autor do post pode editá-lo. O `req.user.id` vem do token JWT, que não pode ser forjado pelo cliente.

### 7.3. Reflexão

Responda às três perguntas abaixo com no mínimo um parágrafo cada:

**a)** Por que a abordagem de "confiar no front-end para controlar o acesso" é perigosa? Dê um exemplo concreto usando este projeto.

**b)** Qual seria a estratégia de longo prazo para evitar que essas vulnerabilidades voltem a aparecer em projetos futuros? Considere: testes automatizados de segurança, revisão de código, bibliotecas de autorização (ex: CASL, accesscontrol), e integração com pipelines CI/CD.

**c)** Como você projetaria o sistema desde o início para garantir isolamento por departamento e autorização granular? Pense em: onde essa lógica viveria no código, como seria testada e como seria documentada para novos desenvolvedores no projeto.

---

## 8. Referências Bibliográficas

- OWASP Foundation. *OWASP Top 10 – 2021*. Disponível em: https://owasp.org/Top10/. Acesso em: abr. 2026.
- OWASP Foundation. *OWASP API Security Top 10*. Disponível em: https://owasp.org/www-project-api-security/. Acesso em: abr. 2026.
- STALLINGS, William; BROWN, Lawrie. *Segurança de Computadores: Princípios e Práticas*. 2. ed. Rio de Janeiro: Elsevier, 2014.
- SÊMOLA, Marcos. *Gestão da Segurança da Informação: Uma Visão Executiva*. 2. ed. Rio de Janeiro: Elsevier, 2014.
- HINTZBERGEN, Jule et al. *Fundamentos de Segurança da Informação: com base na ISO 27001 e na ISO 27002*. Rio de Janeiro: Brasport, 2018.
