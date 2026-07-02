# 🖥️ Plan de despliegue en el servidor de la Facultad (Docker)

Guía paso a paso para encender MapFI en el servidor **sin exponer la base de datos**.

> **Aclaración clave:** MapFI **ya tiene backend** (Node.js + Express, `server.js`).
> El navegador nunca habla con PostgreSQL: hace `fetch` a `/api/*` en el backend, y
> solo el backend consulta la BD. **No hay que reescribir nada en Python.**

---

## 1. Arquitectura (y por qué la BD queda privada)

```
 Internet ──► [ puerto público único ]  ─►  Backend Node/Express (contenedor "server")
                  (ej. 3000 o 443)              │
                                                │  red interna de Docker (no sale al host)
                                                ▼
                                        PostgreSQL (contenedor "db")  ← SIN puerto publicado
```

- **Solo se publica un puerto**: el del backend.
- El contenedor `db` **no publica ningún puerto al host** (en `docker-compose.yaml` usa `expose`, no `ports`). Solo es alcanzable por el contenedor `server` a través de la red interna de Docker, por el host `db:5432`.
- Por lo tanto: **no se abre ningún puerto de base de datos en el servidor.** Es justo lo que pedía el admin.

> El puerto de Postgres al host solo se publica en **desarrollo local**, mediante el override `docker-compose.dev.yaml` (que en el servidor **no se usa**).

---

## 2. Requisitos en el servidor

- **Docker** + **Docker Compose v2** (`docker compose version`).
- **git** (para clonar/actualizar).
- Un **puerto libre** para la app (por defecto 3000) **o** un reverse proxy (nginx) si se quiere HTTPS/dominio.

---

## 3. Despliegue (un solo comando)

```bash
# 1. Clonar
git clone <url-del-repo> mapfi && cd mapfi

# 2. Configurar entorno
cp .env.example .env
nano .env            # editar los valores de producción (ver paso 4)

# 3. Levantar en segundo plano (build + migraciones automáticas)
docker compose up -d --build        #  ó:  npm run docker:prod

# 4. Verificar
curl http://localhost:3000/api/health     # → {"ok":true,"service":"mapfi"}
docker compose ps                          # 'server' y 'db' como healthy
```

La app queda en `http://<IP-del-servidor>:3000`.
Admin inicial por defecto: **admin@mapfi.cl / admin1234** (cámbialo, ver paso 4).

---

## 4. Variables de entorno para producción (`.env`)

Lo mínimo a ajustar **antes** de levantar:

```ini
# Puerto público de la app
PORT=3000

# Secreto de sesión: genéralo único
SESSION_SECRET=<pega-aqui-un-valor-aleatorio>

# Credenciales de la BD interna (no se exponen, pero usa una clave fuerte)
POSTGRES_USER=mapfi
POSTGRES_PASSWORD=<clave-fuerte>
POSTGRES_DB=mapfi

# Admin inicial (se crea en la 1ª migración)
SEED_ADMIN_EMAIL=admin@fi.udec.cl
SEED_ADMIN_PASSWORD=<clave-admin-fuerte>

# Dejar 'development' si sirves por http://IP:PUERTO (cookies funcionan).
# Cambiar a 'production' SOLO si está detrás de HTTPS (ver paso 6).
# NODE_ENV=production
```

Generar el `SESSION_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> `DATABASE_URL` del `.env` se usa solo para correr en el host sin Docker. En
> Docker, el backend arma su conexión interna a `db:5432` automáticamente.

---

## 5. Operación

```bash
docker compose logs -f server     # ver logs (ó: npm run docker:logs)
docker compose ps                 # estado / health
docker compose restart server     # reiniciar solo la app

# Actualizar a una nueva versión
git pull
docker compose up -d --build      # reconstruye y aplica migraciones nuevas

# Detener / borrar (¡-v borra los datos!)
docker compose down
docker compose down -v            # ⚠ borra el volumen de la BD
```

Resetear la contraseña del admin sin perder datos:
```bash
docker compose exec server node js/db/reset-admin.js admin@fi.udec.cl <nueva-clave>
```

---

## 6. Endurecimiento recomendado (HTTPS + dominio)

Para servir por HTTPS con un dominio, pon **nginx** delante (en el mismo server o el proxy de la facultad):

1. Que la app escuche solo en localhost: en `docker-compose.yaml`, cambia
   `- ${PORT}:3000` por `- "127.0.0.1:${PORT}:3000"` (así solo nginx la alcanza).
2. Config de nginx (ejemplo):

```nginx
server {
    server_name mapfi.fi.udec.cl;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    listen 80;
}
```
3. Activa HTTPS (Let's Encrypt): `sudo certbot --nginx -d mapfi.fi.udec.cl`.
4. Con HTTPS funcionando, en `.env` pon `NODE_ENV=production` y `docker compose up -d` (activa cookies `secure`). El backend ya tiene `trust proxy`.

Firewall: deja abiertos solo 80/443 (o el puerto de la app). **No abras 5432.**

---

## 7. Respaldos

```bash
# Backup (el nombre del contenedor suele ser mapfi-db-1; verifícalo con `docker compose ps`)
docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup_$(date +%F).sql

# Restore
cat backup_AAAA-MM-DD.sql | docker compose exec -T db psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```
Programa el backup como cron diario en el servidor.

---

## 8. Checklist de encendido

- [ ] `.env` con `SESSION_SECRET`, `POSTGRES_PASSWORD` y `SEED_ADMIN_*` propios.
- [ ] `docker compose up -d --build` sin errores.
- [ ] `docker compose ps` → `server` y `db` *healthy*.
- [ ] `GET /api/health` responde `{ ok: true }`.
- [ ] Login con el admin; cambia su contraseña en **Mi cuenta**.
- [ ] `docker compose port db 5432` **no** devuelve nada público (la BD no está expuesta).
- [ ] (Opcional) nginx + HTTPS y `NODE_ENV=production`.
- [ ] Backup diario programado.

---

*Resumen para el admin (fruskin): el stack se levanta con `docker compose up -d --build`. Solo se publica el puerto de la app; PostgreSQL corre en un contenedor sin puerto al host, accesible únicamente por el backend en la red interna de Docker. No hay que abrir ningún puerto de base de datos.*
