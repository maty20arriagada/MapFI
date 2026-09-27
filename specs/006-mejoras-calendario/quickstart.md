# Quickstart: validar la Spec 006

Guía para demostrar que cada historia funciona de punta a punta. Detalle de datos en
[data-model.md](data-model.md); detalle de las rutas en [contracts/api.md](contracts/api.md).

> **Se valida con `server.js`, nunca con un servidor estático.** La Spec 004 se escapó a
> producción porque se verificó con `python -m http.server`, que no aplica las reglas de Express.

## Requisitos

```bash
npm install
npm run docker:db        # solo Postgres
npm run db:migrate       # aplica hasta la 019
npm run dev              # http://localhost:3000
```

Cuentas: `admin@mapfi.cl` y las de los centros sembradas con `npm run seed:cuentas`
(p. ej. `industrial@mapfi.cl`, `informatica@mapfi.cl`).

## Pruebas automáticas

```bash
npm test
npm run test:tz          # la misma batería con TZ=UTC
```

Ambas en verde, sin pruebas omitidas.

---

## US1 · El certamen de ejemplo desaparece

1. Sobre una base **limpia** (`docker compose down -v`, luego arrancar): el calendario no muestra
   "Certamen 1 - Cálculo I" ni "Semana del Novato".
2. En la base:
   ```sql
   SELECT count(*) FROM actividad
    WHERE titulo IN ('Certamen 1 - Cálculo I', 'Semana del Novato')
      AND descripcion IN ('Primera evaluación del semestre', 'Actividad de bienvenida a primer año');
   -- esperado: 0

   SELECT titulo, motivo FROM borrado_definitivo WHERE motivo LIKE 'Dato de ejemplo%';
   -- esperado: las dos filas, con el motivo de la migración 018
   ```
3. `GET /api/actividades/eliminadas` no menciona a Docencia.
4. **Protección de datos reales**: como `industrial@mapfi.cl`, crear una actividad titulada
   "Certamen 1 - Cálculo I" en otra fecha. Ejecutar **a mano** el SQL de la 018 (el runner no
   repite una migración ya registrada, así que `npm run db:migrate` no probaría nada):
   ```bash
   docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'      < db/migrations/018_limpiar_actividades_muestra.sql
   ```
   La actividad real sigue existiendo, y la segunda pasada no borra nada (idempotencia).

**En producción**, tras desplegar: el id 1 ya no aparece en `GET /api/actividades`.

## US2 · Aviso de verificación

1. Sin sesión, abrir `/calendario.html` y `/index.html`: el aviso se ve **arriba** del calendario
   sin desplazarse.
2. Con sesión de centro y de administrador: el mismo aviso.
3. Imprimir el calendario (Ctrl+P): el aviso aparece en la vista previa.
4. Tema oscuro (botón de tema): el aviso sigue legible.
5. Lector de pantalla (NVDA o Narrador): se anuncia como nota, sin interrumpir la carga.

## US3 · El calendario recuerda dónde quedó

1. En `/calendario.html` ir a **noviembre**, vista **Semana**. La URL cambia a algo como
   `?vista=semana&fecha=2026-11-09`.
2. **Recargar** (F5): misma semana, misma vista.
3. Elegir una carrera en el filtro: el calendario **no** se mueve de noviembre y la URL gana
   `carreraId=`.
4. Navegar cinco meses hacia adelante y pulsar **Atrás** en el navegador: sale de la página (o
   vuelve a la anterior), no retrocede mes por mes.
5. Copiar la URL y abrirla en una ventana privada: misma semana, vista y filtros.
6. Abrir `/calendario.html?vista=inventada&fecha=2026-13-45&carreraId=6`: abre en el mes en curso,
   vista Mes, **con** la carrera 6 filtrada, sin mensaje de error.
7. Como `industrial@mapfi.cl`, abrir `/calendario.html` sin parámetros: se preselecciona
   Industrial. Abrir `/calendario.html?carreraId=`: queda en "Todas las carreras".

## US4 · Editar desde el calendario

Con `industrial@mapfi.cl`:

1. Clic en una actividad de Industrial: se abre el **panel de edición** con los datos cargados.
2. Cambiar la fecha, guardar: confirmación visible, la actividad en su nueva fecha, el calendario
   sin moverse de la semana.
3. Poner la hora de fin antes que la de inicio: no guarda, mensaje junto al campo.
4. Vaciar el título: no guarda, mensaje junto al campo. **Además**, forzar la petición:
   ```bash
   # con la cookie de sesión del centro
   curl -X PUT http://localhost:3000/api/actividades/<id> -H "Content-Type: application/json" \
        -b cookie.txt -d '{"titulo":"   "}'
   # esperado: 400 {"error":"El título no puede quedar vacío"}
   ```
5. En el panel, "Añadir a mi calendario" abre el panel de siempre.
6. Clic en una actividad de **Metalúrgica**: panel de siempre, **sin** edición, y no se puede
   arrastrar.
7. **Arrastrar** una actividad propia a otro día: aparece la confirmación con origen y destino.
   *Cancelar* → vuelve a su lugar. *Mover* → queda en el nuevo día.
8. **Concurrencia**: abrir el panel de la misma actividad en dos pestañas; guardar en la primera,
   luego en la segunda → mensaje "Esta actividad cambió mientras la editabas…".
9. **Autorización real**: con `informatica@mapfi.cl`, forzar un `PUT` a una actividad de Industrial
   → 403.
10. Sin sesión: clic en cualquier actividad → panel de siempre.
11. **Calendario externo**: suscribir el feed `.ics` en Google Calendar, cambiar la fecha de una
    actividad, esperar la sincronización: el evento se mueve, no se duplica.

## US5 · Mapa de calor con todas las generaciones

1. `/mapa-calor.html`: elegir Industrial y **"Todas las generaciones"**. Las dos vistas (por hora
   y semestre) muestran resultados.
2. La URL conserva `nivel=todos`; recargar mantiene la selección.
3. Marcar **5** carreras con "Todas las generaciones": aviso antes de pedir el mapa, explicando
   el límite de 4.
4. **Conteo correcto del semestre**: crear una actividad dirigida a Industrial años 1 a 5 en un día
   sin otras actividades. Con "Todas las generaciones", ese día cuenta **1** actividad, no 5.
5. Forzar `GET /api/heatmap/semana?carreraId=1&carreraId=2&carreraId=3&carreraId=4&carreraId=5&nivel=todos`
   → 400 con el mensaje de las 4 carreras.
6. `GET /api/heatmap/semana?carreraId=6` (sin nivel) sigue respondiendo 400.

---

## Cierre

- [ ] `npm test` y `npm run test:tz` en verde.
- [ ] Las cinco historias verificadas en el navegador **contra `server.js`**.
- [ ] Capturas de las pantallas nuevas (aviso, panel de edición, confirmación de arrastre,
      selector de generaciones).
- [ ] Tras el despliegue en la Facultad, repetir US1.3 y US3.1-3 en producción. Como en la Spec
      004, la historia se cierra en el servidor real, no con el merge.
