#!/usr/bin/env node

/**
 * Script de Inicialização do Sistema Microblog
 * 
 * Uso: node init.js
 * 
 * Este script:
 * 1. Conecta ao banco de dados
 * 2. Cria departamentos (se não existirem)
 * 3. Cria usuários de teste (se não existirem)
 * 4. Exibe credenciais de acesso
 */

require('dotenv').config();

const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');

async function initialize() {
    console.log('\n🚀 Iniciando sistema Microblog...\n');

    try {
        // Conectar ao banco
        const sequelize = new Sequelize(
            process.env.DB_NAME,
            process.env.DB_USER,
            process.env.DB_PASS,
            {
                host: process.env.DB_HOST,
                dialect: 'mysql',
                logging: false
            }
        );

        await sequelize.authenticate();
        console.log('✅ Banco de dados conectado\n');

        // Definir modelos
        const Department = sequelize.define('Department', {
            id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
            name: { type: DataTypes.STRING, allowNull: false }
        }, { timestamps: true });

        const User = sequelize.define('User', {
            id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
            username: { type: DataTypes.STRING, unique: true, allowNull: false },
            password: { type: DataTypes.STRING, allowNull: false },
            role: { type: DataTypes.ENUM('USER', 'ADMIN'), defaultValue: 'USER' },
            departmentId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'Departments', key: 'id' }
            }
        }, { timestamps: true });

        User.belongsTo(Department, { foreignKey: 'departmentId' });

        // Sincronizar modelos
        await sequelize.sync({ alter: true });
        console.log('✅ Tabelas sincronizadas\n');

        // Criar departamentos
        console.log('📁 Criando departamentos...');
        const depts = await Department.findOrCreate({
            where: { name: 'Tecnologia da Informação' },
            defaults: { name: 'Tecnologia da Informação' }
        });
        const tiId = depts[0].id;
        console.log(`   ✅ TI (ID: ${tiId})`);

        const depts2 = await Department.findOrCreate({
            where: { name: 'Recursos Humanos' },
            defaults: { name: 'Recursos Humanos' }
        });
        const rhId = depts2[0].id;
        console.log(`   ✅ RH (ID: ${rhId})\n`);

        // Criar usuários de teste
        console.log('👥 Criando usuários de teste...');
        
        const users = [
            { username: 'alice', password: '123', role: 'USER', departmentId: tiId, dept: 'TI' },
            { username: 'bob', password: '123', role: 'USER', departmentId: rhId, dept: 'RH' },
            { username: 'admin', password: 'admin123', role: 'ADMIN', departmentId: tiId, dept: 'TI' }
        ];

        for (const userData of users) {
            const hashedPassword = await bcrypt.hash(userData.password, 10);
            const [user, created] = await User.findOrCreate({
                where: { username: userData.username },
                defaults: {
                    username: userData.username,
                    password: hashedPassword,
                    role: userData.role,
                    departmentId: userData.departmentId
                }
            });
            const status = created ? '✅ Criado' : '⏭️  Já existe';
            console.log(`   ${status}: ${userData.username} (${userData.role}, ${userData.dept})`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('🎯 CREDENCIAIS DE ACESSO');
        console.log('='.repeat(60));
        console.log('\n📌 Usuários de teste:');
        console.log('\n   Usuário: alice');
        console.log('   Senha: 123');
        console.log('   Role: USER');
        console.log('   Departamento: TI\n');
        
        console.log('   Usuário: bob');
        console.log('   Senha: 123');
        console.log('   Role: USER');
        console.log('   Departamento: RH\n');
        
        console.log('   Usuário: admin');
        console.log('   Senha: admin123');
        console.log('   Role: ADMIN');
        console.log('   Departamento: TI\n');

        console.log('='.repeat(60));
        console.log('\n🚀 Para iniciar os serviços, execute em 2 terminais:\n');
        console.log('   Terminal 1: cd user-api && npm start');
        console.log('   Terminal 2: cd post-api && npm start\n');
        console.log('Acesse:');
        console.log('   User API:  http://localhost:8080/health');
        console.log('   Post API:  http://localhost:8081/health\n');

        await sequelize.close();
        process.exit(0);

    } catch (error) {
        console.error('❌ Erro durante inicialização:', error.message);
        process.exit(1);
    }
}

initialize();
