#!/usr/bin/env node

/**
 * Setup completo do Microblog
 * 
 * Uso: node setup.js
 * 
 * Este script executa:
 * 1. Instala dependências em todas as pastas
 * 2. Cria/sincroniza banco de dados
 * 3. Cria dados de teste
 * 4. Exibe instruções de inicialização
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';

function log(type, message) {
    const icons = {
        success: `${GREEN}✅${RESET}`,
        error: `${RED}❌${RESET}`,
        info: `${BLUE}ℹ️${RESET}`,
        warn: `${YELLOW}⚠️${RESET}`,
        arrow: `${BLUE}→${RESET}`
    };
    console.log(`${icons[type]} ${message}`);
}

function section(title) {
    console.log(`\n${BOLD}${BLUE}═══════════════════════════════════════${RESET}`);
    console.log(`${BOLD}${BLUE}  ${title}${RESET}`);
    console.log(`${BOLD}${BLUE}═══════════════════════════════════════${RESET}\n`);
}

async function runSetup() {
    try {
        section('🚀 Setup Microblog - Sistema Completo');

        // 1. Instalar dependências
        section('📦 Instalando dependências');

        const folders = ['user-api', 'post-api'];
        
        for (const folder of folders) {
            const folderPath = path.join(__dirname, folder);
            if (fs.existsSync(path.join(folderPath, 'package.json'))) {
                log('arrow', `Instalando em ${folder}...`);
                execSync('npm install --prefer-offline', { cwd: folderPath, stdio: 'inherit' });
                log('success', `${folder} pronto`);
            }
        }

        log('success', 'Dependências instaladas');

        // 2. Verificar .env
        section('⚙️  Verificando configurações');

        const envFiles = [
            { file: 'user-api/.env', required: true },
            { file: 'post-api/.env', required: true },
            { file: '.env', required: true }
        ];

        for (const envFile of envFiles) {
            if (!fs.existsSync(path.join(__dirname, envFile.file))) {
                log('warn', `${envFile.file} não encontrado`);
            } else {
                log('success', `${envFile.file} presente`);
            }
        }

        // 3. Inicializar banco de dados
        section('🗄️  Inicializando banco de dados');

        log('arrow', 'Conectando e sincronizando...');
        execSync('node init.js', { cwd: __dirname, stdio: 'inherit' });

        // 4. Resumo final
        section('✅ Setup Concluído!');

        console.log(`${BOLD}Próximos passos:${RESET}\n`);
        log('arrow', 'Abra 2 terminais e execute:\n');
        console.log(`  ${BOLD}Terminal 1:${RESET}`);
        console.log(`    cd user-api && npm start\n`);
        console.log(`  ${BOLD}Terminal 2:${RESET}`);
        console.log(`    cd post-api && npm start\n`);

        console.log(`${BOLD}Ou use:${RESET}`);
        console.log(`  Windows: .\\start.bat`);
        console.log(`  Mac/Linux: ./start.sh\n`);

        console.log(`${BOLD}Verificar se está rodando:${RESET}`);
        console.log(`  curl http://localhost:8080/health`);
        console.log(`  curl http://localhost:8081/health\n`);

        console.log(`${BOLD}Documentação:${RESET}`);
        console.log(`  - QUICKSTART.md - Guia rápido`);
        console.log(`  - Guia_Didatico_Vulnerabilidades.md - Guia completo\n`);

    } catch (error) {
        log('error', `Erro durante setup: ${error.message}`);
        process.exit(1);
    }
}

runSetup();
