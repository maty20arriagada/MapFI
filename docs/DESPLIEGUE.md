# 🚀 Despliegue — MapFI

Guía para levantar MapFI en local, en el servidor de la facultad (Docker) o en la nube.

---

## 1. Requisitos

- **Docker** + **Docker Compose** (recomendado para todo entorno), **o**
- **Node.js ≥ 18** + **PostgreSQL ≥ 14** si se corre sin contenedores.

---

## 2. Despliegue con Docker (recomendado)

Es el camino pensado para el **servidor de la facultad**: un solo comando.

```bash
# 1. Clonar y entrar
git clone <url-del-repo> mapfi && cd mapfi

# 2. Configurar entorno
cp .env.example .env
#   editar .env: SESSION_SECRET, POSTGRES_PASSWORD, etc.

# 3. Levantar (construye imagen, arranca db + server, corre migraciones)
docker-compose up --build
#   → http://localhost:3000
```

Para producción detrás de HTTPS, setear `NODE_ENV=production` en `.env` (activa cookies `secure`).

Comandos útiles:

```bash
docker-compose up -d            # en segundo plano
docker-compose logs -f server   # ver logs del server
docker-compose down             # detener
docker-compose down -v          # detener y BORRAR datos (¡cuidado!)
```

---

## 3. Despliegue local sin Docker

```bash
# 1. Levantar solo Postgres con Docker (o usar uno propio)
npm run docker:db        # postgres en localhost:5433

# 2. Instalar dependencias
npm install

# 3. Configurar .env (DATABASE_URL apuntando a localhost:5433)
cp .env.example .env

# 4. Migrar y arrancar
npm run db:migrate
npm start                # → http://localhost:3000
#   o: npm run dev       (con recarga en caliente)
```

---

## 4. Despliegue en la nube (Railway / Render)

El repo incluye `Procfile` y `nixpacks.toml`.

1. Crear un servicio **PostgreSQL** en la plataforma → copia su `DATABASE_URL`.
2. Crear el servicio web apuntando al repo.
3. Configurar variables en el **dashboard** (no se usa `.env`):
   - `DATABASE_URL` (la del Postgres del paso 1)
   - `SESSION_SECRET`
   - `NODE_ENV=production`
4. Deploy. Las migraciones corren al arrancar.

> En la nube, `docker-compose.yaml` no se usa; la plataforma construye con nixpacks/Procfile.

---

## 5. Variables de entorno

Ver `.env.example` para la lista completa y comentada. Las esenciales:

| Variable | Para qué | Obligatoria |
|----------|----------|-------------|
| `DATABASE_URL` | Conexión a Postgres | Sí (host/cloud) |
| `SESSION_SECRET` | Firma de cookies de sesión | Sí |
| `NODE_ENV` | `development` \| `production` | No (default dev) |
| `PORT` | Puerto del server | No (default 3000) |
| `POSTGRES_USER/PASSWORD/DB/PORT` | Credenciales del `db` de compose | Sí (Docker) |

Genera un `SESSION_SECRET` con:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 6. Checklist de smoke test post-despliegue

- [ ] `GET /api/health` responde `200 { ok: true }`.
- [ ] La home (`/`) carga el calendario público.
- [ ] Login de un usuario semilla funciona.
- [ ] Crear una actividad la muestra en el calendario.
- [ ] El calculador de match responde y devuelve sugerencias.
- [ ] El mapa de calor renderiza colores por segmento.
- [ ] Reiniciar el contenedor **no** pierde datos (volumen persistente).

---

## 7. Respaldos (producción)

```bash
# Backup
docker exec -t mapfi-db-1 pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup_$(date +%F).sql

# Restore
cat backup_2026-06-08.sql | docker exec -i mapfi-db-1 psql -U $POSTGRES_USER $POSTGRES_DB
```

> Programar el backup como tarea diaria en el servidor de la facultad (cron).
