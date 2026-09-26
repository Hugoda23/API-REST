# Imagen para Railway (o cualquier PaaS): un solo contenedor con FrankenPHP
# que sirve Laravel en el puerto $PORT que asigna la plataforma.
FROM dunglas/frankenphp:1-php8.4-bookworm

RUN install-php-extensions pdo_pgsql opcache zip

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY docker/php/php.prod.ini /usr/local/etc/php/conf.d/99-prod.ini

WORKDIR /app

COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction

COPY . .
RUN composer dump-autoload --optimize --no-dev \
    && chmod +x docker/railway/start.sh \
    && chown -R www-data:www-data storage bootstrap/cache /data/caddy /config/caddy

USER www-data

ENV APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    SESSION_DRIVER=array \
    CACHE_STORE=database \
    QUEUE_CONNECTION=sync \
    DB_CONNECTION=pgsql

CMD ["docker/railway/start.sh"]
