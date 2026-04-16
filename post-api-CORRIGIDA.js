const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { Sequelize, DataTypes, Op } = require('sequelize');
const jwt = require('jsonwebtoken');

// ✅ Validação de ambiente
function validateEnv() {
    const required = ['DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME', 'JWT_SECRET', 'PORT'];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        console.error(`❌ Variáveis de ambiente faltando: ${missing.join(', ')}`);
        process.exit(1);
    }
}

validateEnv();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false
});

const Post = sequelize.define('Post', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    content: { type: DataTypes.TEXT, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    departmentId: { type: DataTypes.INTEGER, allowNull: false },
    visible: { type: DataTypes.BOOLEAN, defaultValue: true }
});

async function initializeDatabase() {
    try {
        await sequelize.authenticate();
        console.log('✅ Conexão com banco de dados estabelecida');
        await sequelize.sync({ alter: true });
        console.log('✅ Modelos sincronizados com o banco');
    } catch (error) {
        console.error('❌ Erro ao conectar ao banco de dados:', error.message);
        process.exit(1);
    }
}

const app = express();

// ✅ CORS restritivo (FIX #13)
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5500', 'http://127.0.0.1:5500'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// ✅ Rate limiting (FIX #15)
const generalLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,  // 1 hora
    max: 100,
    skip: (req) => req.path === '/health'
});

app.use(generalLimiter);

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token necessário' });
    const token = authHeader.split(' ')[1];
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Token inválido' });
    }
}

// ✅ Middleware para verificar admin (NEW)
function requireAdmin(req, res, next) {
    if (req.user.role !== 'ADMIN') {
        console.log(`[SECURITY] Usuário ${req.user.id} tentou acessar endpoint admin`);
        return res.status(403).json({ error: 'Acesso apenas para administradores' });
    }
    next();
}

// ✅ CRIAR POST - Já seguro
app.post('/api/posts', authenticate, async (req, res) => {
    try {
        const { content } = req.body;
        
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Conteúdo não pode estar vazio' });
        }
        
        if (content.length > 5000) {
            return res.status(400).json({ error: 'Post muito longo (máximo 5000 caracteres)' });
        }
        
        const post = await Post.create({
            content,
            userId: req.user.id,
            departmentId: req.user.departmentId,
            visible: true
        });
        
        console.log(`[AUDIT] Usuário ${req.user.id} criou post ${post.id}`);
        
        res.status(201).json(post);
    } catch (error) {
        console.error('Erro ao criar post:', error);
        res.status(500).json({ error: 'Erro ao criar post' });
    }
});

// ✅ LISTAR POSTS - Com isolamento por departamento (FIX #5)
app.get('/api/posts', authenticate, async (req, res) => {
    try {
        let query;
        
        if (req.user.role === 'ADMIN') {
            // Admin vê TODOS os posts
            query = await Post.findAll({ order: [['createdAt', 'DESC']] });
        } else {
            // USER vê:
            // 1. Posts do próprio departamento que são visíveis
            // 2. Seus próprios posts (mesmo se privados)
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
    } catch (error) {
        console.error('Erro ao listar posts:', error);
        res.status(500).json({ error: 'Erro ao listar posts' });
    }
});

// ✅ EDITAR POST - Com validação de propriedade (FIX #6, #11)
app.put('/api/posts/:id', authenticate, async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        
        if (isNaN(postId)) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        
        const post = await Post.findByPk(postId);
        if (!post) {
            return res.status(404).json({ error: 'Post não encontrado' });
        }
        
        // ✅ Validar propriedade: apenas proprietário pode editar
        if (post.userId !== req.user.id) {
            console.log(`[SECURITY] Usuário ${req.user.id} tentou editar post ${postId} de outro usuário`);
            return res.status(403).json({ error: 'Você não pode editar este post' });
        }
        
        // ✅ Aceitar APENAS 'content' (sem mass assignment)
        const { content } = req.body;
        
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Conteúdo não pode estar vazio' });
        }
        
        if (content.length > 5000) {
            return res.status(400).json({ error: 'Post muito longo (máximo 5000 caracteres)' });
        }
        
        await post.update({ content });
        
        console.log(`[AUDIT] Usuário ${req.user.id} editou post ${postId}`);
        
        res.json(post);
    } catch (error) {
        console.error('Erro ao editar post:', error);
        res.status(500).json({ error: 'Erro ao editar post' });
    }
});

// ✅ MUDAR VISIBILIDADE - Com validação de propriedade (FIX #8)
app.patch('/api/posts/:id/visibility', authenticate, async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        
        if (isNaN(postId)) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        
        const post = await Post.findByPk(postId);
        if (!post) {
            return res.status(404).json({ error: 'Post não encontrado' });
        }
        
        // ✅ Proprietário OU admin podem mudar visibilidade
        const isOwner = post.userId === req.user.id;
        const isAdmin = req.user.role === 'ADMIN';
        
        if (!isOwner && !isAdmin) {
            console.log(`[SECURITY] Usuário ${req.user.id} tentou mudar visibilidade de post ${postId} de outro usuário`);
            return res.status(403).json({ error: 'Você não pode alterar a visibilidade deste post' });
        }
        
        // ✅ Validar entrada
        const { visible } = req.body;
        if (typeof visible !== 'boolean') {
            return res.status(400).json({ error: 'visible deve ser true ou false' });
        }
        
        await post.update({ visible });
        
        console.log(`[AUDIT] Usuário ${req.user.id} alterou visibilidade do post ${postId}`);
        
        res.json(post);
    } catch (error) {
        console.error('Erro ao alterar visibilidade:', error);
        res.status(500).json({ error: 'Erro ao alterar visibilidade' });
    }
});

// ✅ DELETAR POST - Proprietário OU admin (FIX #7)
app.delete('/api/posts/:id', authenticate, async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        
        if (isNaN(postId)) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        
        const post = await Post.findByPk(postId);
        if (!post) {
            return res.status(404).json({ error: 'Post não encontrado' });
        }
        
        // ✅ Apenas proprietário OU admin pode deletar
        const isOwner = post.userId === req.user.id;
        const isAdmin = req.user.role === 'ADMIN';
        
        if (!isOwner && !isAdmin) {
            console.log(`[SECURITY] Usuário ${req.user.id} tentou deletar post ${postId} de outro usuário`);
            return res.status(403).json({ error: 'Você não pode deletar este post' });
        }
        
        console.log(`[AUDIT] Usuário ${req.user.id} deletou post ${postId}`);
        
        await post.destroy();
        res.status(204).send();
    } catch (error) {
        console.error('Erro ao deletar post:', error);
        res.status(500).json({ error: 'Erro ao deletar post' });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', service: 'post-api', timestamp: new Date().toISOString() });
});

async function startServer() {
    await initializeDatabase();
    
    const PORT = process.env.PORT || 8081;
    app.listen(PORT, () => {
        console.log(`\n🚨 Post API CORRIGIDA rodando na porta ${PORT}`);
        console.log(`📍 Endpoints disponíveis:`);
        console.log(`   POST   /api/posts                  - Criar post`);
        console.log(`   GET    /api/posts                  - Listar (filtrado por dept) ✅`);
        console.log(`   PUT    /api/posts/:id              - Editar (proprietário) ✅`);
        console.log(`   PATCH  /api/posts/:id/visibility  - Mudar visibilidade (prop/admin) ✅`);
        console.log(`   DELETE /api/posts/:id              - Deletar (prop/admin) ✅`);
        console.log(`   GET    /health                     - Health check\n`);
        console.log(`🔒 Proteções Ativas:`);
        console.log(`   ✅ Isolamento por departamento`);
        console.log(`   ✅ Validação de propriedade`);
        console.log(`   ✅ RBAC (Role-Based Access Control)`);
        console.log(`   ✅ Rate Limiting`);
        console.log(`   ✅ CORS Restritivo`);
        console.log(`   ✅ Try-Catch em todos os endpoints`);
        console.log(`   ✅ Sem Mass Assignment\n`);
    });
}

startServer().catch(err => {
    console.error('❌ Erro ao iniciar servidor:', err);
    process.exit(1);
});
