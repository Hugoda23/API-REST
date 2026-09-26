FROM php:8.4-fpm-bookworm AS base

RUN apt-get update && apt-get install -y --no-install-recommends unzip libpq-dev \
    && docker-php-ext-install -j"$(nproc)" pdo_pgsql opcache \
    && apt-get purge -y --auto-remove && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
ENV COMPOSER_HOME=/tmp/composer
WORKDIR /var/www/html

# ---------- Desarrollo: el código se monta desde el host ----------
FROM base AS dev
ARG UID=1000
ARG GID=1000
RUN groupmod -o -g ${GID} www-data && usermod -o -u ${UID} -g ${GID} www-data
USER www-data

# ---------- Producción: el código va dentro de la imagen ----------
FROM base AS prod
COPY docker/php/php.prod.ini /usr/local/etc/php/conf.d/99-prod.ini

COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction

COPY . .
RUN composer dump-autoload --optimize --no-dev \
    && chown -R www-data:www-data storage bootstrap/cache

COPY docker/php/entrypoint.prod.sh /usr/local/bin/entrypoint
RUN chmod +x /usr/local/bin/entrypoint

USER www-data
ENTRYPOINT ["entrypoint"]
CMD ["php-fpm"]
