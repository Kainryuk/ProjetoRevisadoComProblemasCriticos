#!/usr/bin/env node

/**
 * Script de Verificação Rápida
 * 
 * Testa se o sistema está funcionando corretamente
 */

const http = require('http');

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';

function checkHealth(port, serviceName) {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}/health`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    console.log(`${GREEN}✅${RESET} ${serviceName}: OK (porta ${port})`);
                    resolve(true);
                } catch {
                    console.log(`${RED}❌${RESET} ${serviceName}: Resposta inválida`);
                    resolve(false);
                }
            });
        });

        req.on('error', () => {
            console.log(`${RED}❌${RESET} ${serviceName}: Desconectado (porta ${port})`);
            resolve(false);
        });

        req.setTimeout(3000, () => {
            req.destroy();
            console.log(`${RED}❌${RESET} ${serviceName}: Timeout (porta ${port})`);
            resolve(false);
        });
    });
}

async function checkDatabase() {
    require('dotenv').config();
    const { Sequelize } = require('sequelize');

    try {
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
        console.log(`${GREEN}✅${RESET} Database: OK`);
        await sequelize.close();
        return true;
    } catch (error) {
        console.log(`${RED}❌${RESET} Database: ${error.message}`);
        return false;
    }
}

async function runChecks() {
    console.log('\n' + '='.repeat(50));
    console.log('🔍 Verificação Rápida do Microblog');
    console.log('='.repeat(50) + '\n');

    const checks = await Promise.all([
        checkHealth(8080, 'User API'),
        checkHealth(8081, 'Post API'),
        checkDatabase()
    ]);

    console.log('\n' + '='.repeat(50));
    
    if (checks.every(c => c)) {
        console.log(`${GREEN}✅ Sistema está OPERACIONAL${RESET}`);
        console.log('='.repeat(50) + '\n');
        console.log('📌 Próximos passos:');
        console.log('  1. Acesse: http://localhost:8080/health');
        console.log('  2. Faça login com alice/123');
        console.log('  3. Consulte o guia: Guia_Didatico_Vulnerabilidades.md\n');
        process.exit(0);
    } else {
        console.log(`${RED}❌ Sistema com problemas${RESET}`);
        console.log('='.repeat(50) + '\n');
        console.log(`${YELLOW}⚠️  Checklist:${RESET}`);
        console.log('  □ MySQL está rodando?');
        console.log('  □ User API iniciada? (npm start em user-api/)');
        console.log('  □ Post API iniciada? (npm start em post-api/)');
        console.log('  □ Executou setup.js?\n');
        process.exit(1);
    }
}

runChecks();
