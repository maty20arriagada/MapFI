---
title: "Data Model 002 — Estados, visibilidad y datos derivados"
tags: [mapfi, data-model, estados, visibilidad, speckit]
date: 2026-07-27
status: completo
aliases: ["Modelo de estados MapFI"]
---

# Data Model: estados, visibilidad y datos derivados

**Feature**: 002-auditoria-robustez-corregir · **Fase**: 1

Esta feature **no crea entidades nuevas**. Redefine el significado operativo de
datos que ya existen y que hoy se interpretan de forma inconsistente.

---

## 1. Estado de la actividad como eje de visibilidad

Los cinco estados ya existen; lo que falta es un **criterio único** sobre qué
significa cada uno para quien mira.

Modelo **de moderación reactiva** (decidido en clarificación: no hay revisor diario).
Todo se publica al crearse; el administrador retira después.

| Estado | Significado | ¿Público? | ¿Su autor lo ve? | ¿Cuenta en saturación? | ¿Cuenta en choques? |
|---|---|:---:|:---:|:---:|:---:|
| Propuesta | Recién creada — **ya publicada** | **Sí** | Sí | Sí | **Sí** |
| Confirmada | Ratificada por el administrador | **Sí** | Sí | Sí | **Sí** |
| Realizada | Ya ocurrió | Sí (histórico) | Sí | Sí | No |
| Suspendida | **Retirada** por el administrador o cancelada por su autor | **No** | Sí (para corregir) | **No** | No |
| Reprogramada | Movida a otra fecha | No | Sí | No | No |
| Archivada | "Eliminada" de forma reversible | **No** | Sí (restaurable) | **No** | No |

**Regla derivada (fuente única):** el conjunto **vigente** = {propuesta,
confirmada, realizada}. Lo **retirado** = {suspendida, reprogramada, archivada}
**nunca es público**. Ese conjunto se consulta desde un único lugar y lo usan el
calendario, el mapa de calor y la detección de choques.

> Nota de diseño: *propuesta* y *confirmada* son ambas públicas; la diferencia es
> que la segunda fue revisada explícitamente. Esto permite endurecer el modelo en
> el futuro (si se designa un revisor) sin rehacer el esquema.

**Archivado reversible:** la eliminación deja de borrar filas. Se requiere registrar
**quién** archivó o retiró y **cuándo**, para trazabilidad de la moderación
reactiva y para permitir la restauración por parte de un administrador.

**Estado actual (defecto):** cada vista aplica un criterio distinto — el calendario
no filtra nada, el mapa de calor usa tres estados y los choques solo uno.

## 2. Datos derivados del Match (hoy siempre vacíos)

| Campo | Origen previsto | Estado real | Alimenta |
|---|---|---|---|
| `compatibilidad_pct` | Evaluación al guardar | **Siempre nulo** | Sello de coordinación |
| `alcance_estimado` | Evaluación al guardar | **Siempre nulo** | Reporte PDF, indicador de aporte |

**Cambio:** pasan a completarse en el servidor al crear o reprogramar una
actividad. Se recalculan cuando cambia la fecha o el público (los datos que los
determinan), no en cada edición.

**Regla de integridad:** ambos son **datos derivados**; nunca se aceptan del
cliente. Si el contexto no permite calcularlos, quedan nulos y quien los muestre
debe indicar que no hay estimación disponible.

## 3. Matrícula: naturaleza del dato

| Atributo | Situación |
|---|---|
| Cobertura | Los 70 segmentos (14 carreras × 5 niveles) |
| Valor actual | 100 por segmento — **valor de relleno uniforme** |
| Consumidores | Alcance estimado → reporte PDF → rendiciones y postulaciones |
| Origen futuro | **Matrícula oficial de Docencia** (confirmado obtenible) |

**Cambio:** cada registro de matrícula debe indicar si su valor es **oficial** o
**referencial**. Mientras exista al menos un segmento referencial involucrado en un
cálculo, las cifras derivadas se rotulan como estimación; al cargar los datos
oficiales, el rótulo desaparece **automáticamente**, sin intervención manual.

## 4. Sesión: de copia estática a estado vivo

| Aspecto | Hoy | Objetivo |
|---|---|---|
| Origen de rol y entidad | Copia del momento del ingreso | Estado actual de la cuenta |
| Efecto de desactivar | Solo impide nuevos ingresos | Corta la sesión en la siguiente acción |
| Efecto de cambiar entidad o rol | Se aplica al reingresar (hasta 8 h) | Inmediato |

## 5. Fechas: contrato de interpretación

| Punto | Hoy | Objetivo |
|---|---|---|
| Formulario → servidor | Texto sin zona horaria | Igual (sin cambiar el cliente) |
| Interpretación en servidor y base | Zona del contenedor (no definida ⇒ UTC) | Zona de Chile continental, explícita |
| Presentación | Convertida a la zona del navegador | Coincide con lo ingresado |

**Invariante a garantizar:** *para una misma actividad, la hora que ve su autor al
crearla, la que ve el público y la que aparece en el reporte son la misma.*

## 6. Transiciones de estado (flujo de moderación)

```text
   crea aportante                    ratifica admin
  (nueva) ──────► PROPUESTA ──────────────────────────► CONFIRMADA
                  (YA PÚBLICA)                          (YA PÚBLICA)
                       │                                     │
                       │        retira admin / cancela autor │
                       └──────────────► SUSPENDIDA ◄─────────┤
                                        (oculta)             │
                                             ▲               │ ocurre
                            restituye admin  │               ▼
                                             │           REALIZADA
   cualquiera ──► "eliminar" ──► ARCHIVADA ──┘            (histórico)
                                 (oculta, restaurable)
```

**Reglas de autorización sobre las transiciones:**

- Un aportante crea en **propuesta**, que **ya es pública** (no espera aprobación).
- Un aportante puede **cancelar** o **archivar** lo suyo, y **reprogramarlo**.
- Solo un administrador puede **retirar** actividades ajenas, **ratificar**
  (confirmar) y **restituir** lo retirado o archivado.
- El paso a **realizada** ocurre por el transcurso del tiempo o por acción del
  administrador; alimenta la reputación. Un aportante **no** puede marcar como
  realizada una actividad futura.
