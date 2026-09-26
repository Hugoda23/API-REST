# API-REST

API REST con un CRUD de **productos**. Laravel 13 (PHP 8.4) + PostgreSQL 16, todo en Docker.

## Endpoints

Base: `/api`

| Método | Ruta                  | Qué hace                                   | Respuesta |
|--------|-----------------------|--------------------------------------------|-----------|
| GET    | `/api`                | Información de la API                      | 200 |
| GET    | `/api/health`         | Estado de la API y de la base              | 200 / 503 |
| GET    | `/api/productos`      | Lista (`?buscar=`, `?page=`, `?por_pagina=` máx. 100) | 200 |
| GET    | `/api/productos/{id}` | Un producto                                | 200 / 404 |
| POST   | `/api/productos`      | Crea                                       | 201 / 422 |
| PUT    | `/api/productos/{id}` | Reemplaza (lo no enviado vuelve a su valor por defecto) | 200 / 404 / 422 |
| PATCH  | `/api/productos/{id}` | Actualiza sólo los campos enviados         | 200 / 404 / 422 |
| DELETE | `/api/productos/{id}` | Elimina                                    | 204 / 404 |

Producto:

```json
{
  "nombre": "Teclado",        // obligatorio, máx. 120
  "descripcion": "Mecánico",  // opcional
  "precio": 350.50,           // obligatorio, >= 0
  "stock": 10                 // opcional, entero >= 0 (por defecto 0)
}
```

Las respuestas vienen en `data` (y en la lista, además `links` y `meta` con la paginación).
Los errores de validación (422):

```json
{ "message": "El campo nombre es obligatorio.", "errors": { "nombre": ["El campo nombre es obligatorio."] } }
```

Si hay `API_KEY` configurada (en producción debe estarlo), **POST, PUT, PATCH y DELETE**
exigen la cabecera `X-API-Key: <clave>`; si falta o no coincide, 401. Los GET son públicos.
Límite: 120 peticiones por minuto por IP.

### Código

| Archivo | Qué hace |
|---|---|
| `routes/api.php` | Rutas |
| `app/Http/Controllers/Api/ProductoController.php` | CRUD |
| `app/Http/Requests/ProductoRequest.php` | Validación (POST/PUT completos, PATCH parcial) |
| `app/Http/Resources/ProductoResource.php` | Forma del JSON |
| `app/Http/Middleware/ExigirApiKey.php` | Cabecera `X-API-Key` |
| `database/migrations/…create_productos_table.php` | Tabla |

## Desarrollo

```bash
docker compose up -d --build                             # API en http://localhost:3010/api
docker exec api_rest_app composer install                # sólo si no existe vendor/
docker exec api_rest_app php artisan migrate --seed      # tabla + 15 productos de ejemplo
```

Postgres queda en `localhost:5436` (usuario/clave `api_rest`/`secret`).

Ejemplos:

```bash
curl localhost:3010/api/productos?buscar=mouse
curl -X POST localhost:3010/api/productos -H 'Content-Type: application/json' \
     -d '{"nombre":"Mouse","precio":90,"stock":5}'
curl -X PATCH localhost:3010/api/productos/1 -H 'Content-Type: application/json' -d '{"stock":4}'
curl -X DELETE localhost:3010/api/productos/1
```

Pruebas:

```bash
docker exec api_rest_app php artisan test
```

Corren contra la base `api_rest_test` (la crea `docker/postgres/init` al levantar la base por
primera vez). `phpunit.xml` la fija con `force="true"`, así que **nunca** vacían `api_rest`.

## Producción (VPS compartido con SGA y FadeApp)

El nginx del SGA tiene los puertos 80/443 y el HTTPS. La API **no publica puertos**: su nginx
se une a la red `sga_sga_network` con el alias `api-rest-web` y el nginx del SGA le pasa el
tráfico, igual que a FadeApp. Al arrancar, el contenedor cachea config y rutas y corre las
migraciones solo.

1. Subir el código y configurar:

   ```bash
   cd /root && git clone <repo> API-REST && cd API-REST
   cp .env.production.example .env.production
   docker compose -f docker-compose.prod.yml --env-file .env.production build
   docker compose -f docker-compose.prod.yml --env-file .env.production \
       run --rm --no-deps --entrypoint php app artisan key:generate --show   # → APP_KEY
   openssl rand -hex 24                                                      # → API_KEY
   nano .env.production     # APP_URL, APP_KEY, DB_PASSWORD, API_KEY
   ```

2. Levantar:

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d
   docker compose -f docker-compose.prod.yml ps
   ```

3. Apuntar el dominio (registro A a la IP del VPS), sacar el certificado con el certbot del SGA
   y añadir al final de `/root/SGA/docker/nginx/prod.conf` (con `cat >>`, **no** `sed -i`: es
   un bind mount de archivo suelto):

   ```nginx
   server {
       listen 80;
       server_name API_DOMINIO;
       location /.well-known/acme-challenge/ { root /var/www/certbot; }
       location / { return 301 https://$host$request_uri; }
   }

   server {
       listen 443 ssl;
       http2 on;
       server_name API_DOMINIO;

       ssl_certificate     /etc/letsencrypt/live/API_DOMINIO/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/API_DOMINIO/privkey.pem;

       resolver 127.0.0.11 valid=30s;
       set $api_rest http://api-rest-web;

       location / {
           proxy_pass $api_rest;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

   Luego `docker exec sga_nginx_prod nginx -t && docker exec sga_nginx_prod nginx -s reload`.
   Revisar que los paths del certificado y del webroot coincidan con los bloques que ya usa
   FadeApp en ese mismo archivo.

4. Probar: `curl https://API_DOMINIO/api/health`

Actualizar después de un cambio:

```bash
git pull && docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Respaldo de la base:

```bash
docker exec api_rest_db pg_dump -U api_rest api_rest | gzip > api_rest_$(date +%F).sql.gz
```
