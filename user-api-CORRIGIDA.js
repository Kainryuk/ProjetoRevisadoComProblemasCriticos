const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { Sequelize, DataTypes, Op } = require('sequelize');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

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

const Department = sequelize.define('Department', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false }
});

const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    username: { type: DataTypes.STRING, unique: true, allowNull: false },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.ENUM('USER', 'ADMIN'), defaultValue: 'USER' },
    departmentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: Department, key: 'id' }
    }
});
User.belongsTo(Department, { foreignKey: 'departmentId' });

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
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutos
    max: 5,
    message: 'Muitas tentativas de login, tente mais tarde',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health'
});

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

// ✅ LOGIN - Com validação de entrada (FIX #12)
app.post('/api/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Validação de entrada
        if (!username || !password) {
            return res.status(400).json({ error: 'Username e password obrigatórios' });
        }
        
        if (typeof username !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ error: 'Entrada inválida' });
        }
        
        if (username.length < 1 || password.length < 1) {
            return res.status(400).json({ error: 'Campos vazios' });
        }
        
        const user = await User.findOne({ where: { username }, include: [Department] });
        if (!user) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }
        
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }
        
        const token = jwt.sign(
            { id: user.id, role: user.role, departmentId: user.departmentId },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );
        
        console.log(`[AUDIT] Login bem-sucedido: ${username} (role: ${user.role})`);
        
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
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ✅ CRIAR USUÁRIO - Sem mass assignment (FIX #1)
app.post('/api/usuarios', async (req, res) => {
    try {
        const { username, password, departmentId } = req.body;
        
        // Validação de entrada
        if (!username || !password || !departmentId) {
            return res.status(400).json({ error: 'Campos obrigatórios: username, password, departmentId' });
        }
        
        if (username.length < 3) {
            return res.status(400).json({ error: 'Username deve ter pelo menos 3 caracteres' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password deve ter pelo menos 6 caracteres' });
        }
        
        // Verificar se department existe
        const dept = await Department.findByPk(departmentId);
        if (!dept) {
            return res.status(400).json({ error: 'Departamento não encontrado' });
        }
        
        // ✅ NUNCA aceitar role do body - sempre 'USER'
        const hashed = await bcrypt.hash(password, 10);
        const user = await User.create({
            username,
            password: hashed,
            role: 'USER',  // ✅ Hardcoded
            departmentId
        });
        
        console.log(`[AUDIT] Novo usuário criado: ${username} (ID: ${user.id})`);
        
        res.status(201).json({
            id: user.id,
            username: user.username,
            role: user.role,
            departmentId: user.departmentId
        });
    } catch (error) {
        console.error('Erro ao criar usuário:', error);
        res.status(500).json({ error: 'Erro ao criar usuário' });
    }
});

// ✅ LISTAR USUÁRIOS - Admin-only (FIX #4)
app.get('/api/usuarios', authenticate, requireAdmin, async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: { exclude: ['password'] },
            include: [Department]
        });
        res.json(users);
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ error: 'Erro ao listar usuários' });
    }
});

// ✅ PERFIL DO USUÁRIO - Já seguro
app.get('/api/usuarios/me', authenticate, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: { exclude: ['password'] },
            include: [Department]
        });
        res.json(user);
    } catch (error) {
        console.error('Erro ao buscar perfil:', error);
        res.status(500).json({ error: 'Erro ao buscar perfil' });
    }
});

// ✅ PROMOVER USUÁRIO - Com validações (FIX #2)
app.patch('/api/usuarios/:id/promote', authenticate, requireAdmin, async (req, res) => {
    try {
        const { role } = req.body;
        const userId = parseInt(req.params.id);
        
        // Validação
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        
        if (!['USER', 'ADMIN'].includes(role)) {
            return res.status(400).json({ error: 'Role deve ser USER ou ADMIN' });
        }
        
        // Não permitir rebaixar a si mesmo
        if (userId === req.user.id && role === 'USER') {
            return res.status(403).json({ error: 'Você não pode rebaixar sua própria conta' });
        }
        
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        await User.update({ role }, { where: { id: userId } });
        
        console.log(`[AUDIT] Admin ${req.user.id} alterou role de usuário ${userId} para ${role}`);
        
        const updated = await User.findByPk(userId, { attributes: { exclude: ['password'] } });
        res.json({ message: `Role atualizado para ${role}`, user: updated });
    } catch (error) {
        console.error('Erro ao promover usuário:', error);
        res.status(500).json({ error: 'Erro ao promover usuário' });
    }
});

// ✅ DELETAR USUÁRIO - Admin-only com validações (FIX #3)
app.delete('/api/usuarios/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        
        // Não permitir deletar a si mesmo
        if (userId === req.user.id) {
            return res.status(403).json({ error: 'Você não pode deletar sua própria conta' });
        }
        
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        console.log(`[AUDIT] Admin ${req.user.id} deletou usuário ${userId}`);
        
        await User.destroy({ where: { id: userId } });
        res.status(204).send();
    } catch (error) {
        console.error('Erro ao deletar usuário:', error);
        res.status(500).json({ error: 'Erro ao deletar usuário' });
    }
});

// ✅ LISTAR DEPARTAMENTOS
app.get('/api/departamentos', authenticate, async (req, res) => {
    try {
        const depts = await Department.findAll();
        res.json(depts);
    } catch (error) {
        console.error('Erro ao listar departamentos:', error);
        res.status(500).json({ error: 'Erro ao listar departamentos' });
    }
});

// ✅ CRIAR DEPARTAMENTO - Admin-only (FIX #9)
app.post('/api/departamentos', authenticate, requireAdmin, async (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name || name.trim().length < 3) {
            return res.status(400).json({ error: 'Nome do departamento deve ter pelo menos 3 caracteres' });
        }
        
        const dept = await Department.create({ name: name.trim() });
        
        console.log(`[AUDIT] Admin ${req.user.id} criou departamento: ${name}`);
        
        res.status(201).json(dept);
    } catch (error) {
        console.error('Erro ao criar departamento:', error);
        res.status(500).json({ error: 'Erro ao criar departamento' });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', service: 'user-api', timestamp: new Date().toISOString() });
});

async function startServer() {
    await initializeDatabase();
    
    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
        console.log(`\n🚨 User API CORRIGIDA rodando na porta ${PORT}`);
        console.log(`📍 Endpoints disponíveis:`);
        console.log(`   POST   /api/usuarios        - Criar usuário`);
        console.log(`   POST   /api/login           - Login (retorna token)`);
        console.log(`   GET    /api/usuarios        - Listar usuários (ADMIN-ONLY) ✅`);
        console.log(`   GET    /api/usuarios/me     - Perfil atual`);
        console.log(`   PATCH  /api/usuarios/:id/promote - Promover (ADMIN-ONLY) ✅`);
        console.log(`   DELETE /api/usuarios/:id    - Deletar (ADMIN-ONLY) ✅`);
        console.log(`   GET    /api/departamentos   - Listar departamentos`);
        console.log(`   POST   /api/departamentos   - Criar (ADMIN-ONLY) ✅`);
        console.log(`   GET    /health              - Health check\n`);
        console.log(`🔒 Proteções Ativas:`);
        console.log(`   ✅ Validação de entrada`);
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
