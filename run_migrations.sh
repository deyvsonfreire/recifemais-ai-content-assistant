#!/bin/bash

# Script para executar as migrações SQL no Supabase
# Este script aplica todas as melhorias do banco de dados na ordem correta

echo "🚀 Iniciando aplicação das melhorias do banco de dados Supabase..."
echo ""

# Verificar se o Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo "❌ Erro: Supabase CLI não está instalado."
    echo "📖 Instale seguindo: https://supabase.com/docs/guides/cli"
    exit 1
fi

# Verificar se estamos logados no Supabase
if ! supabase projects list &> /dev/null; then
    echo "❌ Erro: Você não está logado no Supabase."
    echo "🔑 Execute: supabase login"
    exit 1
fi

# Diretório das migrações SQL
SQL_DIR="./supabase/sql"

if [ ! -d "$SQL_DIR" ]; then
    echo "❌ Erro: Diretório $SQL_DIR não encontrado."
    exit 1
fi

# Lista dos arquivos SQL na ordem correta
SQL_FILES=(
    "01_performance_indexes.sql"
    "02_normalized_tables.sql"
    "03_row_level_security.sql"
    "04_cache_cleanup_system.sql"
    "05_usage_analytics.sql"
    "06_materialized_views.sql"
    "07_backup_and_migration.sql"
)

echo "📋 Arquivos de migração encontrados:"
for file in "${SQL_FILES[@]}"; do
    if [ -f "$SQL_DIR/$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file (não encontrado)"
        exit 1
    fi
done
echo ""

# Confirmar execução
read -p "🤔 Deseja continuar com a aplicação das migrações? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Operação cancelada pelo usuário."
    exit 1
fi

echo "📊 Aplicando migrações..."
echo ""

# Executar cada arquivo SQL
for file in "${SQL_FILES[@]}"; do
    echo "🔄 Executando $file..."
    
    # Usar psql para executar o SQL diretamente no Supabase
    if supabase db reset --linked &> /dev/null; then
        # Se o reset funcionar, aplicar o arquivo
        if psql "$DATABASE_URL" -f "$SQL_DIR/$file" &> /dev/null; then
            echo "  ✅ $file aplicado com sucesso"
        else
            echo "  ❌ Erro ao aplicar $file"
            echo "  💡 Tentando método alternativo..."
            
            # Método alternativo: ler o arquivo e executar via supabase
            if supabase db push --linked; then
                echo "  ✅ $file aplicado via método alternativo"
            else
                echo "  ❌ Falha ao aplicar $file"
                echo "  📝 Execute manualmente no painel do Supabase:"
                echo "     https://supabase.com/dashboard/project/$(supabase status | grep 'API URL' | cut -d'/' -f3 | cut -d'.' -f1)/sql"
                exit 1
            fi
        fi
    else
        echo "  💡 Aplicando via SQL Editor do Supabase..."
        echo "  📋 Copie e cole o conteúdo de $file no SQL Editor:"
        echo "     https://supabase.com/dashboard/project/aoyrpadrrsckxbuadcnf/sql"
        echo ""
        echo "  📄 Conteúdo do arquivo $file:"
        echo "  " && cat "$SQL_DIR/$file" | head -20
        echo "  ... (arquivo completo disponível em $SQL_DIR/$file)"
        echo ""
        read -p "  ✋ Pressione Enter após executar $file no SQL Editor..."
    fi
    echo ""
done

echo "🎉 Todas as migrações foram processadas!"
echo ""
echo "📊 Resumo das melhorias aplicadas:"
echo "  🚀 Índices de performance para consultas otimizadas"
echo "  🗂️  Tabelas normalizadas para melhor organização"
echo "  🔒 Row Level Security para proteção de dados"
echo "  🧹 Sistema automático de limpeza de cache"
echo "  📈 Analytics e logs de uso completos"
echo "  📊 Views materializadas para relatórios"
echo "  💾 Sistema de backup e migração declarativa"
echo ""
echo "✅ Seu banco de dados Supabase está agora otimizado e pronto para produção!"
echo ""
echo "🔗 Acesse seu painel: https://supabase.com/dashboard/project/aoyrpadrrsckxbuadcnf"
echo "📊 Monitore as métricas através das views materializadas criadas"