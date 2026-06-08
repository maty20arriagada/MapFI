# ── Imagen base oficial de Node.js 20 (Alpine = ligera) ─────────
FROM node:20-alpine

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar primero solo package.json para aprovechar la cache de Docker
# (si no cambian las dependencias, salta el npm install en rebuilds)
COPY package*.json ./

# Instalar solo dependencias de produccion
RUN npm install --omit=dev

# Copiar el resto del codigo fuente
COPY . .

# Comando de arranque (aplica migraciones y levanta el server)
CMD ["sh", "run.sh"]
