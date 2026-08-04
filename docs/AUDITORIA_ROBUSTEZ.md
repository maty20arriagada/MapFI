---
title: Auditoría de robustez de MapFI
tags:
  - mapfi
  - auditoria
  - robustez
  - hallazgos
  - dilemas
  - speckit
date: 2026-07-27
status: implementado
feature: 002-auditoria-robustez-corregir
aliases:
  - Auditoría
  - Auditoría de robustez
  - Hallazgos MapFI
cssclasses:
  - wide-page
---

# 🔍 Auditoría de robustez de MapFI

> Revisión transversal del proyecto en busca de errores e inconsistencias, con
> modelado de **dilemas y escenarios hipotéticos** de interacción real de usuarios.
> Todos los hallazgos fueron **verificados contra el código** o **demostrados
> empíricamente**; ninguno es una hipótesis sin comprobar.

**Feature Speckit**: `002-auditoria-robustez-corregir`
**Estado**: **implementado (2026-08-03)** · 82 tareas ejecutadas · 85/85 pruebas en verde
(línea base: 60/60 — ver [[../specs/002-auditoria-robustez-corregir/baseline|Baseline 002]]).
Verificación en navegador/Docker en vivo **pendiente** (Docker Desktop no
disponible durante la implementación) — ver notas de bloqueo en cada hallazgo.

## Documentos de la auditoría

| Documento | Contenido |
|---|---|
| [[../specs/002-auditoria-robustez-corregir/spec|Spec 002]] | Historias de usuario, requisitos y criterios de éxito |
| [[../specs/002-auditoria-robustez-corregir/plan|Plan 002]] | Enfoque técnico y verificación constitucional |
| [[../specs/002-auditoria-robustez-corregir/research|Research 002]] | Los 14 hallazgos con su evidencia |
| [[../specs/002-auditoria-robustez-corregir/dilemas|Dilemas 002]] | 5 dilemas de producto + 14 escenarios hipotéticos |
| [[../specs/002-auditoria-robustez-corregir/data-model|Data Model 002]] | Estados, visibilidad y datos derivados |
| [[../specs/002-auditoria-robustez-corregir/quickstart|Quickstart 002]] | Guion de validación reproducible |

Relacionados: [[BACKLOG_MEJORAS|Backlog de mejoras]] · [[ARQUITECTURA|Arquitectura]] · [[GUIA_TECNICA|Guía Técnica]]

---

## ⚠️ Resumen para quien tiene 30 segundos

La plataforma tenía **cuatro defectos críticos** que ninguna de sus 60 pruebas
detectaba, porque vivían **en las junturas entre capas** (navegador → servidor →
base de datos → navegador), que ninguna prueba recorría completa. Los cuatro
fallaban **en silencio**: nadie veía un error, el sistema simplemente hacía algo
distinto de lo prometido.

**Los 14 hallazgos ya están corregidos a nivel de código** (implementación
2026-08-03, 82 tareas de `tasks.md`). Lo que falta es la **verificación en vivo**
contra un stack Docker real, bloqueada durante esta sesión por no tener Docker
Desktop disponible — ver la columna "Estado" de cada hallazgo abajo.

| # | Defecto | Consecuencia en una frase | Estado |
|---|---|---|---|
| **H-01** | Zona horaria | Un evento cargado a las **21:00 se publicaba como 17:00** | ✅ Corregido (T010–T016) |
| **H-02** | Visibilidad por estado | **Rechazar una actividad no la retiraba** del calendario público | ✅ Corregido (T019–T028) |
| **H-03** | Match desconectado | El reporte de impacto decía **"0 estudiantes"** y el sello era inalcanzable | ✅ Corregido (T036–T039) |
| **H-04** | Autoridad del cliente | Un centro podía **publicar sin pasar por revisión** | ✅ Corregido (T046–T049) |

---

## 📋 Los 14 hallazgos

### Críticos — rompían una promesa del producto

**H-01 · La hora mostrada no era la hora ingresada** — ✅ **Corregido 2026-08-03 (T010–T016)**
El contenedor no definía zona horaria, así que corría en UTC. El formulario enviaba
la fecha **sin zona**, y tanto el servidor como la base la interpretaban como UTC.
Una persona en Chile cargaba las 21:00 y el calendario publicaba las **17:00**.
Lo más delicado: la configuración de pruebas **fijaba la zona chilena**, por lo que
las 60 pruebas pasaban sin detectarlo. *La suite validaba un entorno que no existía
en producción.*
**Fix**: `TZ=America/Santiago` en ambos contenedores (`docker-compose.yaml` +
`Dockerfile` con `tzdata`), `jest.setup.js` deja de forzar la zona incondicionalmente
(`npm run test:tz` ahora revela genuinamente el defecto), pruebas basadas en
subprocesos reales (`__tests__/services/fechas.test.js`,
`__tests__/services/matchService.test.js`). **Verificación en navegador (T017):
bloqueada** por falta de Docker en esta sesión.

**H-02 · La moderación no controlaba lo que se publicaba** — ✅ **Corregido 2026-08-03 (T019–T028)**
La consulta del calendario **no filtraba por estado**. Resultado: las actividades
**rechazadas seguían visibles** y las pendientes ya eran públicas desde su carga.
Además, las tres vistas usaban criterios distintos (calendario: todos · mapa de
calor: propuesta/confirmada/realizada · choques: solo confirmada).
**Fix**: fuente única `ESTADOS_VIGENTES` en `js/dao/actividadDao.js`, usada por
`listar()` (alcance público/propias), `conflictos()` y la vista
`vw_saturacion_segmento` (migración 009). El "eliminar" pasó a ser **archivado
reversible** (`archivar`/`retirar`/`restituir`, migración 008) con trazabilidad de
quién y cuándo. **Verificación en navegador (T033): bloqueada.**

**H-03 · El reporte y la gamificación estaban desconectados del Match** — ✅ **Corregido 2026-08-03 (T036–T039)**
Nadie guardaba la compatibilidad ni el alcance al crear una actividad. En
consecuencia: el reporte PDF informaba **siempre 0 estudiantes**, y el **Sello de
Coordinación Eficiente era matemáticamente inalcanzable**.
**Fix**: `evaluarMatchParaActividad()` en `server.js`, invocada en creación
individual, carga masiva (con caché de contexto por semana+público) y edición
(solo si cambia fecha/público); `actividadDao.actualizar()` persiste
`compatibilidad_pct`/`alcance_estimado`. Regresión: `reputationService.test.js`
demuestra el sello ahora alcanzable.

**H-04 · Un aportante podía publicar sin revisión** — ✅ **Corregido 2026-08-03 (T046–T049)**
La creación individual aceptaba el estado que enviara el cliente; la importación
masiva sí lo forzaba — la misma garantía existía en un camino y faltaba en el otro.
**Fix**: whitelist `camposActividadPermitidos()` (T009a) aplicada también a
`PUT /api/actividades/:id` (antes tenía un hueco real: permitía colar
compatibilidad/alcance); estado inicial derivado del rol de sesión en todas las
rutas; transiciones restringidas por rol (`ESTADOS_APORTANTE`); bloqueo de marcar
`REALIZADA` una actividad futura, para cualquier rol. 4 pruebas de intento-y-rechazo
en `routes/api.test.js`. **Verificación manual (T050): bloqueada.**

### Altos — dañaban datos o bloqueaban usuarios

- **H-05 · La carga del semestre fallaba** — ✅ **Corregido 2026-08-03 (T051–T055)**: el
  límite de 100 kB se superaba cerca de la fila 52. `CsvUtils.dividirEnLotes()`
  divide por tamaño serializado real (no un conteo fijo), envío secuencial con
  progreso visible, y errores de BD traducidos a mensaje humano (`traducirErrorBD`).
- **H-06 · Desactivar no revocaba** — ✅ **Corregido 2026-08-03 (T058–T059)**: la sesión
  conservaba una copia del usuario. `requireAuth`/`requireRole` ahora revalidan
  contra la BD en cada petición (costo despreciable) y destruyen la sesión si la
  cuenta está inactiva.
- **H-07 · Doble clic duplicaba** — ✅ **Corregido 2026-08-03 (T062)**: los botones de
  guardado se deshabilitan mientras la petición está en curso, en dashboard y
  calendario académico.
- **H-08 · Fechas inválidas** — ✅ **Corregido 2026-08-03 (T063–T064)**: validación de
  rango (término > inicio) en servidor **y** cliente, con mensaje específico junto
  al campo.

### Medios — degradaban calidad o escala

- **H-09 · Bloqueo colectivo** — ✅ **Corregido 2026-08-03 (T065–T066)**: el
  rate-limiter de login ahora se clave por IP **+ cuenta**, no solo IP; documentado
  en `DESPLIEGUE_SERVIDOR.md` por qué el reverse proxy debe reenviar la IP real.
- **H-10 · Cifras de relleno** — ✅ **Corregido 2026-08-03 (T040–T043)**: columna
  `origen` (oficial/referencial) en `matricula` (migración 010), rótulo automático
  en reportes mientras no se cargue la matrícula oficial, script
  `npm run seed:matricula` para importarla.
- **H-11 · Intentos en memoria**: sin cambios — aceptado para una sola instancia (ver
  comentario en el propio código); migrar a Redis/BD si algún día hay más de una.
- **H-12 · Preferencias por navegador** — ✅ **Corregido 2026-08-03 (T067)**: las
  claves de `localStorage` (onboarding, contexto del formulario) se asocian al id
  de cuenta y se limpian al cerrar sesión.
- **H-13 · Feriados sin confirmar** — ⚠️ **Parcialmente corregido 2026-08-03 (T069)**:
  Día de los Pueblos Indígenas 2026 corregido de 20 a 21 de junio (verificado
  contra gob.cl); San Pedro y San Pablo y Encuentro de Dos Mundos confirmados ya
  correctos. No se pudo verificar contra el Diario Oficial directamente en esta
  sesión — conviene recontrastar antes de producción.
- **H-14 · Choques sin acotar** — ✅ **Corregido 2026-08-03 (T022)**:
  `actividadDao.conflictos()` ahora exige un rango de fechas y usa el conjunto
  vigente completo.

---

## ✅ Dilemas resueltos (2026-07-31)

Detalle en [[../specs/002-auditoria-robustez-corregir/dilemas|Dilemas 002]].

| # | Dilema | **Decisión tomada** |
|---|---|---|
| **D-1** | ¿Ajustar la hora de los eventos ya cargados? | **Ajustar sin más**: no hay actividades reales, solo datos de muestra |
| **D-2** | ¿El público ve lo "en revisión"? | **Moderación reactiva**: se publica todo de inmediato; el administrador retira después |
| **D-3** | ¿Publicar alcances con matrícula ficticia? | **Sí, rotulado** como estimación; se cargará la matrícula oficial de Docencia |
| **D-4** | ¿Quién manda cuando dos centros chocan? | Confirmación explícita al agendar sobre saturación |
| **D-5** | ¿Un centro puede apuntar a otras carreras? | Mantener libertad + advertencia y trazabilidad |
| **nuevo** | ¿El borrado es reversible? | **Sí: archivar, no borrar**; un administrador puede restaurar |

> ### 🔄 Cambio estructural derivado de D-2
> Al confirmarse que **no hay revisor diario**, el modelo de **aprobación previa**
> construido en la fase 6 deja de ser viable: cualquier bloqueo dejaría el
> calendario desactualizado. Se reemplaza por **moderación reactiva** — publicar de
> inmediato y retirar después.
>
> **Consecuencia importante:** la autorización del servidor pasa a ser la **única
> barrera** de control. Por eso H-04 (autoridad del cliente) sube de prioridad: si
> un aportante puede restituir lo que el administrador retiró, la moderación deja
> de existir.

---

## 🎭 Escenarios hipotéticos destacados

Los 14 escenarios completos están en
[[../specs/002-auditoria-robustez-corregir/dilemas|Dilemas 002]]. Los más costosos
para el proyecto:

- **E-01 · La feria que nadie encontró** — el evento se difunde a las 21:00 y la
  plataforma publica 17:00. El primer uso masivo termina en mala experiencia
  pública; es el tipo de error que cuesta la confianza institucional.
- **E-03 · La rendición de cuentas vacía** — un centro adjunta a su postulación a
  fondos un reporte que dice "0 estudiantes" tras un semestre de trabajo.
- **E-05 · El atajo del estudiante de informática** — alguien descubre cómo
  publicar sin revisión y lo comparte como "truco" entre centros.
- **E-07 · La directiva que se fue** — una cuenta desactivada borra las actividades
  del centro desde su sesión aún abierta.
- **E-09 · La sala de computación bloqueada** — alguien olvida su contraseña y deja
  a toda la facultad sin poder entrar durante 15 minutos.
- **E-14 · La estudiante que solo quiere mirar** — *funciona bien hoy*: se usa como
  prueba de que las correcciones **no** deben romper la vista pública.

---

## 🧭 Qué queda pendiente

1. ~~Decidir los dilemas~~ → **✅ resueltos el 2026-07-31**.
2. ~~Generar las tareas con `/speckit-tasks`~~ → **✅ 83 tareas generadas**.
3. ~~Implementar en el orden del plan~~ → **✅ 82 tareas ejecutadas el 2026-08-03**
   (código, migraciones y pruebas; ver detalle por hallazgo arriba).
4. **Validar con el guion de
   [[../specs/002-auditoria-robustez-corregir/quickstart|Quickstart 002]] (V-1 a
   V-9) sobre un stack Docker real** — bloqueado durante la implementación por no
   tener Docker Desktop disponible en esta sesión. Es el paso que falta antes de
   dar la feature por cerrada.
5. **Tarea de datos en paralelo:** solicitar a Docencia la matrícula oficial por
   carrera y nivel (script listo: `npm run seed:matricula`), y recontrastar contra
   el Diario Oficial la fecha del feriado de Pueblos Indígenas (ver H-13).

> **El código está implementado y las 85 pruebas automatizadas pasan.** Lo que
> falta es la verificación en vivo (navegador + Docker) de cada historia — las
> tareas de verificación (T017, T033, T044, T050, T056, T061, T075, T082, entre
> otras) quedaron explícitamente marcadas como bloqueadas, no fabricadas, en
> [[../specs/002-auditoria-robustez-corregir/tasks|Tasks 002]].

---

*Auditoría realizada el 2026-07-27 sobre la rama `update/v2-seguridad-tutoriales`
(60 pruebas en verde al momento de la revisión). Implementación completada el
2026-08-03 (85 pruebas en verde, ver
[[../specs/002-auditoria-robustez-corregir/baseline|Baseline 002]]).*
