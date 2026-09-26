#!/bin/sh
set -e

php artisan config:cache
php artisan route:cache
php artisan migrate --force

exec frankenphp php-server --root public --listen ":${PORT:-8080}"
