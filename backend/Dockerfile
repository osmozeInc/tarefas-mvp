FROM php:8.4-cli-alpine

# Instala dependências do sistema e extensões PHP (PostgreSQL e GMP para WebPush)
RUN apk add --no-cache \
    postgresql-dev \
    gmp-dev \
    libzip-dev \
    unzip \
    git \
    && docker-php-ext-install pdo pdo_pgsql gmp zip bcmath

# Copia o binário do Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Copia os arquivos do projeto para dentro da imagem (usado no deploy em nuvem)
COPY . .

# Instala pacotes de produção otimizados
RUN composer install --no-interaction --optimize-autoloader --no-dev \
    && chmod -R 775 storage bootstrap/cache \
    && chmod +x docker-entrypoint.sh

ENV PHP_CLI_SERVER_WORKERS=4

EXPOSE 8000

CMD ["./docker-entrypoint.sh"]