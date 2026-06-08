#!/bin/sh
# Arranque del contenedor Docker.
# server.js aplica las migraciones automaticamente en start() antes de escuchar,
# asi que aqui solo lanzamos el server.
set -e
echo "[run.sh] Iniciando MapFI..."
exec node server.js
