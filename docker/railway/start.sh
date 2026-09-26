#!/bin/sh
set -e

# Diagnóstico para los logs de Railway: nombres de variables, nunca sus valores.
echo "Variables recibidas: $(env | cut -d= -f1 | grep -E '^(APP_|DB_|DATABASE_URL|API_KEY|PORT)' | sort | tr '\n' ' ')"

URL_BD="${DB_URL:-$DATABASE_URL}"
if [ -z "$URL_BD" ] && [ -z "$DB_HOST" ]; then
    echo "ERROR: no hay conexión a la base de datos configurada."
    echo "En Railway, servicio de la API > Variables: DB_URL=\${{Postgres.DATABASE_URL}}"
    echo "(si la variable existe pero llega vacía, el nombre del servicio de la base no es 'Postgres')."
    exit 1
fi
if [ -n "$URL_BD" ]; then
    echo "Base de datos: $(echo "$URL_BD" | sed -E 's|^[a-z]+://[^@]*@([^/?]+).*|\1|')"
fi
if [ -z "$APP_KEY" ]; then
    echo "ERROR: falta APP_KEY en las variables del servicio."
    exit 1
fi

php artisan config:cache
php artisan route:cache
php artisan migrate --force

exec frankenphp php-server --root public --listen ":${PORT:-8080}"
