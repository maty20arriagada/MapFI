---
title: "Quickstart 002 — Validación de la auditoría de robustez"
tags: [mapfi, quickstart, validacion, pruebas, speckit]
date: 2026-07-27
status: completo
aliases: ["Validación 002"]
---

# Quickstart: cómo validar que la corrección funcionó

**Feature**: 002-auditoria-robustez-corregir · **Fase**: 1

Guion reproducible. Cada bloque corresponde a un criterio de éxito de la
[spec](./spec.md) y a un escenario de [dilemas.md](./dilemas.md).

## Prerrequisitos

- Stack levantado (`docker compose up -d --build`) y migraciones aplicadas.
- Una cuenta de administrador y una de aportante (por ejemplo, la del CEE de
  Industrial).
- Herramienta para llamadas HTTP autenticadas (la propia consola del navegador
  sirve, con la sesión iniciada).

---

## V-1 · La hora publicada es la ingresada · SC-001 · E-01

1. Confirmar la zona horaria efectiva del contenedor de aplicación y de la base de
   datos (ambas deben ser la de Chile continental).
2. Como aportante, crear un evento a las **21:00** de un día hábil.
3. Verificar la hora mostrada en: **el calendario público**, **"Mis eventos"** y
   **el reporte descargado**.

**Esperado:** las tres muestran **21:00**. Repetir con una fecha posterior al
cambio de horario de verano para confirmar que también coincide.

---

## V-2 · Publicación inmediata y retiro efectivo · SC-002, SC-003 · E-02

1. Como aportante, importar una planilla con dos actividades.
2. Sin sesión iniciada (ventana privada), abrir el calendario público.

**Esperado:** **ambas aparecen de inmediato** (moderación reactiva, sin aprobación
previa).

3. Como administrador, **retirar** una de las dos.
4. Recargar el calendario público.

**Esperado:** la retirada **no aparece**; la otra sigue visible. El autor sigue
viendo ambas en "Mis eventos" con su estado.

5. Comprobar que el mapa de calor y el aviso de choques **no** consideran la
   retirada.

**Esperado:** las tres vistas coinciden en qué actividades cuentan.

6. Como aportante, **eliminar** una actividad propia; luego, como administrador,
   **restaurarla**.

**Esperado:** al eliminar desaparece de todas las vistas públicas; al restaurar
vuelve íntegra. Queda registro de quién hizo cada acción.

---

## V-3 · El reporte refleja el trabajo real · SC-004, SC-005 · E-03, E-04

1. Como aportante, crear varias actividades usando **Evaluar compatibilidad** antes
   de guardar.
2. Como administrador, aprobarlas y marcarlas como realizadas.
3. Recalcular la reputación desde el panel de indicadores.
4. Descargar el reporte de impacto de esa entidad.

**Esperado:** el alcance total es **mayor que cero** y coherente con el público
declarado; la entidad **obtiene el Sello de Coordinación Eficiente**; y toda cifra
de alcance aparece rotulada como estimación referencial mientras la matrícula no
sea real.

---

## V-4 · El servidor manda sobre entidad y estado · SC-006 · E-05

Con una sesión de **aportante**, intentar:

1. Crear una actividad a nombre de **otra entidad**.
2. **Restituir** una actividad que el administrador había retirado.
3. Marcar como **realizada** una actividad con fecha futura (para inflar reputación).
4. Enviar valores propios de **compatibilidad y alcance** al crear.

**Esperado:** (1) se asigna a su propia entidad; (2) y (3) se rechazan; (4) el
servidor descarta esos valores y usa los que él calcula. Ninguna logra su objetivo.

---

## V-5 · La carga del semestre completo funciona · SC-007 · E-06

1. Preparar una planilla con **al menos 120 filas**, varias dirigidas a todas las
   carreras y años.
2. Importarla como aportante.

**Esperado:** se procesa completa (por lotes si corresponde), informando el avance
y el resultado. Si por diseño se rechaza un tamaño mayor, el mensaje indica el
límite y cómo dividir el archivo — nunca un texto genérico.

---

## V-6 · Desactivar corta el acceso · SC-008 · E-07

1. Iniciar sesión como aportante en una ventana.
2. Desde otra ventana, como administrador, **desactivar** esa cuenta.
3. En la primera ventana, intentar crear o eliminar una actividad.

**Esperado:** la acción es rechazada y se solicita iniciar sesión.

---

## V-7 · Sin duplicados ni mensajes técnicos · SC-009 · E-08

1. Pulsar **Guardar** dos veces rápidamente en el formulario de evento.
2. Crear un evento con **fecha de término anterior al inicio**.
3. Importar una planilla con una fila inválida.

**Esperado:** (1) se crea **una sola** actividad; (2) mensaje específico sobre las
fechas, no un error interno; (3) el error de la fila está redactado en lenguaje
comprensible, sin texto técnico de la base de datos.

---

## V-8 · La vista pública sigue intacta · E-14 (no regresión)

Sin iniciar sesión y desde un teléfono:

1. Abrir el calendario y filtrar por una carrera y un año.
2. Abrir el mapa de calor.
3. Consultar el centro de ayuda.

**Esperado:** todo funciona sin pedir sesión, con las mismas prestaciones que antes
de la corrección.

---

## V-9 · Las pruebas ya no ocultan defectos de fecha · SC-010

Ejecutar la suite completa en **dos zonas horarias distintas** (la de Chile y una
diferente, como la del servidor por defecto).

**Esperado:** verde en ambas. Si una prueba solo pasa en una zona, señala una
dependencia oculta que debe corregirse.

---

> Nota: los escenarios E-12 (evento que cruza la medianoche) y E-13 (crecimiento
> del historial) se validan con datos de prueba específicos; su definición precisa
> se aborda en las tareas correspondientes.
