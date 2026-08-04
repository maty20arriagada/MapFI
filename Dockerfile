# ── Imagen base oficial de Node.js 20 (Alpine = ligera) ─────────
FROM node:20-alpine

# Spec 002 / H-01: Alpine no trae datos de zona horaria por defecto — sin
# tzdata, la variable TZ del compose no tiene efecto y Node/OpenSSL siguen
# operando en UTC pese a estar "configurados".
RUN apk add --no-cache tzdata

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar primero solo package.json para aprovechar la cache de Docker
# (si no cambian las dependencias, salta el npm install en rebuilds)
COPY package*.json ./

# Instalar solo dependencias de produccion
RUN npm install --omit=dev

# Copiar el resto del codigo fuente
COPY . .

# Ejecutar como usuario no-root por seguridad
USER node

# Comando de arranque (aplica migraciones y levanta el server)
CMD ["sh", "run.sh"]
