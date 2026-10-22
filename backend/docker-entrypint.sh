#!/bin/sh
set -e

# Otimiza caches do Laravel em produção
# php artisan config:cache
# php artisan route:cache

# Roda as migrations pendentes no banco de produção sem pedir confirmação
php artisan migrate --force

# Inicia a API na porta injetada pelo Render/Railway (ou 8000 por padrão)
exec php artisan serve --host=0.0.0.0 --port="${PORT:-8000}"