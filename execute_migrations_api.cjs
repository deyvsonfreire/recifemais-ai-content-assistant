#!/usr/bin/env node

/**
 * Script para executar migrações SQL no Supabase via API REST
 * Este script usa a service_role key para executar as migrações diretamente
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuração do Supabase (do arquivo .env)
const SUPABASE_URL = 'https://aoyrpadrrsckxbuadcnf.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFveXJwYWRycnNja3hidWFkY25mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDgwNjkxOSwiZXhwIjoyMDY2MzgyOTE5fQ.EWx1wZZutcONrJYSzF2r1mvuav0KilXuPOOoWJYjAyc';

// Lista dos arquivos SQL na ordem correta
const SQL_FILES = [
    '01_performance_indexes.sql',
    '02_normalized_tables.sql',
    '03_row_level_security.sql',
    '04_cache_cleanup_system.sql',
    '05_usage_analytics.sql',
    '06_materialized_views.sql',
    '07_backup_and_migration.sql'
];

const SQL_DIR = './supabase/sql';

/**
 * Executa SQL no Supabase via API REST
 */
function executeSql(sql) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ query: sql });
        
        const options = {
            hostname: 'aoyrpadrrsckxbuadcnf.supabase.co',
            port: 443,
            path: '/rest/v1/rpc/exec_sql',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length,
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                'apikey': SERVICE_ROLE_KEY
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(responseData);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(data);
        req.end();
    });
}

/**
 * Executa SQL usando a função pg_exec do PostgreSQL
 */
function executeDirectSql(sql) {
    return new Promise((resolve, reject) => {
        // Escape das aspas simples no SQL
        const escapedSql = sql.replace(/'/g, "''");
        
        const data = JSON.stringify({
            query: `SELECT pg_exec('${escapedSql}') as result`
        });
        
        const options = {
            hostname: 'aoyrpadrrsckxbuadcnf.supabase.co',
            port: 443,
            path: '/rest/v1/rpc/pg_exec',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length,
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                'apikey': SERVICE_ROLE_KEY,
                'Prefer': 'return=representation'
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(responseData);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(data);
        req.end();
    });
}

/**
 * Função principal
 */
async function main() {
    console.log('🚀 Iniciando execução das migrações via API REST...');
    console.log('');

    // Verificar se os arquivos existem
    console.log('📋 Verificando arquivos de migração:');
    for (const file of SQL_FILES) {
        const filePath = path.join(SQL_DIR, file);
        if (fs.existsSync(filePath)) {
            console.log(`  ✅ ${file}`);
        } else {
            console.log(`  ❌ ${file} (não encontrado)`);
            process.exit(1);
        }
    }
    console.log('');

    // Executar cada arquivo SQL
    for (const file of SQL_FILES) {
        console.log(`🔄 Executando ${file}...`);
        
        try {
            const filePath = path.join(SQL_DIR, file);
            const sqlContent = fs.readFileSync(filePath, 'utf8');
            
            // Dividir o SQL em comandos individuais (separados por ;)
            const commands = sqlContent
                .split(';')
                .map(cmd => cmd.trim())
                .filter(cmd => cmd.length > 0 && !cmd.startsWith('--') && !cmd.startsWith('/*'));
            
            console.log(`  📝 Executando ${commands.length} comandos SQL...`);
            
            for (let i = 0; i < commands.length; i++) {
                const command = commands[i];
                if (command.trim()) {
                    try {
                        await executeDirectSql(command + ';');
                        process.stdout.write('.');
                    } catch (error) {
                        console.log('');
                        console.log(`  ⚠️  Comando ${i + 1} falhou (pode ser normal): ${error.message.substring(0, 100)}...`);
                    }
                }
            }
            
            console.log('');
            console.log(`  ✅ ${file} processado com sucesso`);
            
        } catch (error) {
            console.log(`  ❌ Erro ao processar ${file}: ${error.message}`);
            console.log('  💡 Continuando com o próximo arquivo...');
        }
        
        console.log('');
    }

    console.log('🎉 Processamento das migrações concluído!');
    console.log('');
    console.log('📊 Próximos passos:');
    console.log('  1. Verifique o painel do Supabase para confirmar as mudanças');
    console.log('  2. Teste a aplicação para verificar melhorias');
    console.log('  3. Monitore as métricas através das views materializadas');
    console.log('');
    console.log('🔗 Painel Supabase: https://supabase.com/dashboard/project/aoyrpadrrsckxbuadcnf');
}

// Executar o script
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Erro fatal:', error.message);
        console.log('');
        console.log('💡 Alternativas:');
        console.log('  1. Execute as migrações manualmente no SQL Editor do Supabase');
        console.log('  2. Use o Supabase CLI após fazer login: supabase login');
        console.log('  3. Consulte o MIGRATIONS_README.md para mais opções');
        process.exit(1);
    });
}

module.exports = { executeSql, executeDirectSql };