# API-REST

API REST con un CRUD de **productos**. Node.js 20 + Express + PostgreSQL 16, todo en Docker.

## Endpoints

Base: `/api`

| Método | Ruta                  | Qué hace                                   | Respuesta |
|--------|-----------------------|--------------------------------------------|-----------|
| GET    | `/api`                | Información de la API                      | 200 |
| GET    | `/api/health`         | Estado de la API y de la base              | 200 / 503 |
| GET    | `/api/productos`      | Lista (`?buscar=`, `?pagina=`, `?por_pagina=` máx. 100) | 200 |
| GET    | `/api/productos/:id`  | Un producto                                | 200 / 404 |
| POST   | `/api/productos`      | Crea                                       | 201 / 422 |
| PUT    | `/api/productos/:id`  | Reemplaza (los campos no enviados vuelven a su valor por defecto) | 200 / 404 / 422 |
| PATCH  | `/api/productos/:id`  | Actualiza sólo los campos enviados         | 200 / 404 / 422 |
| DELETE | `/api/productos/:id`  | Elimina                                    | 204 / 404 |

Producto:

```json
{
  "nombre": "Teclado",        // obligatorio, máx. 120
  "descripcion": "Mecánico",  // opcional
  "precio": 350.50,           // obligatorio, >= 0
  "stock": 10                 // opcional, entero >= 0 (por defecto 0)
}
```

Si hay `API_KEY` configurada (en producción es obligatoria), **POST, PUT, PATCH y DELETE**
exigen la cabecera `X-API-Key: <clave>`. Los GET son públicos.

Los errores de validación vienen así (422):

```json
{ "mensaje": "Datos inválidos.", "errores": { "precio": "El precio es obligatorio y ..." } }
```

## Desarrollo

```bash
docker compose up -d --build        # API en http://localhost:3010/api, Postgres en :5436
```

Ejemplos:

```bash
curl localhost:3010/api/productos
curl -X POST localhost:3010/api/productos -H 'Content-Type: application/json' \
     -d '{"nombre":"Mouse","precio":90,"stock":5}'
curl -X PATCH localhost:3010/api/productos/1 -H 'Content-Type: application/json' -d '{"stock":4}'
curl -X DELETE localhost:3010/api/productos/1
```

Pruebas (usan la base `api_rest_test`; no tocan la de desarrollo):

```bash
npm install
docker exec api_rest_db createdb -U api_rest api_rest_test   # sólo la primera vez
DB_PORT=5436 DB_DATABASE=api_rest_test npm test
```

## Producción (VPS compartido con SGA y FadeApp)

El nginx del SGA tiene los puertos 80/443 y el HTTPS. La API **no publica puertos**: se une
a la red `sga_sga_network` con el alias `api-rest-web` y el nginx del SGA le pasa el tráfico,
igual que a FadeApp.

1. Subir el código y configurar:

   ```bash
   cd /root && git clone <repo> API-REST && cd API-REST
   cp .env.production.example .env.production
   nano .env.production     # DB_PASSWORD y API_KEY (openssl rand -hex 24)
   ```

2. Levantar:

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
   docker compose -f docker-compose.prod.yml ps        # los dos deben quedar healthy
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
       set $api_rest http://api-rest-web:3000;

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

Respaldo de la base:

```bash
docker exec api_rest_db pg_dump -U api_rest api_rest | gzip > api_rest_$(date +%F).sql.gz
```
