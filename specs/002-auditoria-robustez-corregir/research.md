---
title: "Research 002 — Hallazgos de la auditoría de MapFI"
tags: [mapfi, research, auditoria, hallazgos, speckit]
date: 2026-07-27
status: completo
aliases: ["Hallazgos", "Auditoría MapFI"]
---

# Research: hallazgos de la auditoría

**Feature**: 002-auditoria-robustez-corregir · **Fase**: 0

14 hallazgos, todos **verificados contra el código o demostrados empíricamente**.
No son hipótesis: cada uno indica dónde se comprobó. Se ordenan por severidad.

Leyenda de severidad: **C** crítico (rompe una promesa del producto) · **A** alto
(daña datos o bloquea a usuarios) · **M** medio (degrada calidad o escala).

---

## H-01 · [C] La hora mostrada no es la hora ingresada

**Evidencia (demostrada):** con el proceso en la zona horaria del contenedor
(UTC), un valor de formulario `2026-04-17T21:00` se almacena como
`2026-04-17T21:00:00.000Z` y el navegador de una persona en Chile lo vuelve a
mostrar como **17:00**. Desfase de 4 horas (3 en horario de verano).

**Causa:** el campo de fecha del navegador entrega un texto **sin zona horaria**;
tanto Node como PostgreSQL lo interpretan con la zona del entorno, que en el
contenedor es UTC porque **ni `docker-compose.yaml` ni el `Dockerfile` definen
`TZ`** (verificado: no hay ninguna referencia a `TZ` ni `timezone`).

**Agravante:** `jest.setup.js` fija `TZ=America/Santiago`, por lo que **las 60
pruebas pasan sin detectarlo**. La suite valida un entorno que no es el de
producción.

**Decisión:** fijar explícitamente la zona horaria en el contenedor de aplicación
y en la base de datos, y dejar de fijar una zona única en las pruebas (ejecutar la
suite en dos zonas). **Alternativa descartada:** convertir a UTC en el cliente
enviando fechas con zona — es más correcto a largo plazo, pero obliga a tocar cada
formulario y cada punto de render, con más riesgo para el mismo beneficio inmediato.
Queda anotado como evolución futura.

**Riesgo de la corrección:** los eventos ya cargados quedaron desplazados; hay que
decidir si se ajustan (ver [dilemas.md](./dilemas.md), D-1).

---

## H-02 · [C] La moderación no controla lo que se publica

**Evidencia (código):** `actividadDao.listar()` construye su cláusula de filtrado
**sin ninguna condición sobre `estado`** (verificado: los filtros son entidad,
tipo, fechas, carrera y nivel). El calendario público, por tanto, muestra todos los
estados, incluidas las actividades **rechazadas** (`SUSPENDIDA`) y las que aún
están **en revisión** (`PROPUESTA`).

**Consecuencia:** el flujo "el centro propone → el administrador aprueba",
construido en la fase 6, **no tiene efecto sobre el público**. Rechazar no retira
nada; aprobar no publica nada que no estuviera ya visible.

**Inconsistencia adicional entre vistas** (verificada):

| Vista | Estados que considera |
|---|---|
| Calendario y "Mis eventos" | **todos** |
| Mapa de calor (`vw_saturacion_segmento`) | propuesta, confirmada, realizada |
| Detección de choques | **solo confirmada** |

Tres criterios distintos para la misma pregunta ("¿qué actividades cuentan?").

**Decisión:** definir un criterio único de visibilidad en el DAO y alinear las tres
vistas. La decisión de producto sobre si lo propuesto se muestra al público está en
[dilemas.md](./dilemas.md), D-2.

---

## H-03 · [C] El reporte de impacto y la gamificación están desconectados del Match

**Evidencia (código):** ningún punto del sistema envía `alcanceEstimado` ni
`compatibilidadPct` al crear una actividad — ni el panel del aportante, ni el
formulario de fechas académicas, ni la importación masiva. El DAO los recibe como
`undefined` y los guarda como **nulos** siempre.

**Consecuencias en cadena:**

1. El reporte en PDF suma `alcance_estimado` ⇒ siempre informa **"Alcance total
   estimado: 0 estudiantes"**.
2. El **Sello de Coordinación Eficiente** exige que una fracción alta de los
   eventos tenga compatibilidad registrada; como nunca la hay, el sello es
   **matemáticamente inalcanzable**.
3. El indicador de alcance por entidad del panel de administración es siempre 0.

**Por qué no lo detectaron las pruebas:** las pruebas del generador de reportes le
pasan datos con alcance ya poblado, de modo que validan el formateo, no el flujo.

**Decisión:** al guardar una actividad, el servidor evalúa el Match y persiste el
resultado. Se calcula **en el servidor**, no se acepta del cliente (evita que se
inflen cifras que luego van a un documento oficial).

---

## H-04 · [C] Un aportante puede publicar sin revisión

**Evidencia (código):** en la creación individual, el cuerpo de la petición se
propaga entero al DAO (`{ ...b }`), y el DAO usa `estado` si viene informado. Como
la ruta **no lo sobrescribe**, una sesión de aportante puede enviar el estado
publicado y saltarse la revisión. En la importación masiva sí se fuerza el estado
(el propio comentario del código dice "el aportante no puede elegir entidad ni
estado"), de modo que **la garantía existe en un camino y falta en el otro**.
Lo mismo aplica a la edición y al cambio de estado de una actividad propia.

**Decisión:** derivar el estado y la entidad del rol de la sesión en todas las
rutas de escritura; descartar esos campos del cuerpo. Solo el administrador puede
dejar una actividad publicada.

---

## H-05 · [A] La carga de un semestre completo falla con "Error inesperado"

**Evidencia (medida):** el límite de tamaño de petición es de 100 kB. Una actividad
dirigida a toda la facultad expande a 70 pares (14 carreras × 5 niveles) y ocupa
≈ 2 kB. Medición real: **20 filas → 40 kB (bien) · 50 filas → 100 kB (al límite) ·
100 filas → 199 kB (rechazado)**. El caso "todos los certámenes del semestre para
toda la facultad" supera el límite alrededor de la fila 52.

**Agravante:** el código de respuesta correspondiente **no está traducido** en el
cliente, así que el usuario ve el texto genérico "Error inesperado", sin ninguna
pista de que debe dividir el archivo.

**Decisión:** enviar la importación por lotes desde el cliente (sin subir el límite
del servidor, que existe como protección) y traducir el error de tamaño a un
mensaje accionable.

---

## H-06 · [A] Desactivar una cuenta no revoca el acceso

**Evidencia (código):** la comprobación de autenticación solo mira la copia del
usuario guardada en la sesión al momento del ingreso; no vuelve a consultar la base
de datos. Desactivar una cuenta impide **nuevos** ingresos, pero **no interrumpe la
sesión abierta**, que dura hasta 8 horas.

**Decisión:** revalidar el estado de la cuenta en cada petición autenticada
(consulta ligera por identificador, ya indexada como clave primaria), y usar los
valores frescos de rol y entidad.

---

## H-07 · [A] Doble clic crea actividades duplicadas

**Evidencia (código):** en el panel del aportante y en el formulario de fechas
académicas **no hay ninguna desactivación del botón** mientras la petición está en
curso (verificado: no existen referencias a `disabled` en esos módulos). El
calculador de Match sí lo hace, lo que confirma que el patrón es conocido en el
proyecto pero se aplicó de forma desigual.

**Impacto:** duplicados en un calendario compartido, que además inflan el mapa de
calor y la saturación que usa el algoritmo.

**Decisión:** bloquear el botón durante el envío en todos los formularios de
escritura, siguiendo el patrón ya usado.

---

## H-08 · [A] Fecha de término inválida produce un error técnico

**Evidencia (código):** el servidor no valida que el término sea posterior al
inicio; la restricción existe solo en la base de datos. El usuario recibe un error
interno genérico y, en la importación, el texto crudo de la restricción de la base
de datos aparece en la tabla de errores por fila.

**Decisión:** validar antes de guardar y devolver un mensaje específico; traducir
los errores de la base de datos antes de mostrarlos.

---

## H-09 · [M] Una persona puede bloquear el ingreso de toda la facultad

**Evidencia (código):** el límite de intentos de ingreso se aplica **por dirección
de origen**. La aplicación confía en el intermediario para obtener la dirección
real; si el intermediario del servidor no la reenvía, todas las personas de la red
comparten una sola dirección y **cinco intentos fallidos de una bloquean a todas**
durante quince minutos.

**Decisión:** limitar por combinación de dirección **y** cuenta, de modo que un
fallo repetido afecte al intento sobre esa cuenta y no al resto; documentar la
configuración necesaria del intermediario.

---

## H-10 · [M] Cifras de alcance basadas en datos de relleno

**Evidencia (código):** la matrícula se sembró con **100 estudiantes por segmento**
para los 70 segmentos, con un comentario que lo declara provisorio. Ese número es
la base del alcance que, una vez corregido H-03, aparecerá en los reportes que los
centros usan para rendiciones y postulación a fondos.

**Decisión:** marcar explícitamente el origen del dato en pantalla y en el
documento mientras la matrícula sea referencial, y habilitar su carga. Ver el
dilema ético en [dilemas.md](./dilemas.md), D-3.

---

## H-11 · [M] El control de intentos se pierde al reiniciar

**Evidencia (código):** el registro de intentos vive en memoria del proceso. Un
reinicio lo vacía y, con más de una instancia, cada una llevaría su propia cuenta.

**Decisión:** aceptable para una instancia; documentar la limitación y dejar
prevista su migración si el despliegue crece.

---

## H-12 · [M] Preferencias compartidas en un computador común

**Evidencia (código):** la bienvenida y el contexto del formulario se guardan por
navegador. En el computador compartido de la sede de un centro, la segunda persona
no ve el tutorial y hereda las carreras preseleccionadas de la anterior.

**Decisión:** asociar esas claves al identificador de la cuenta y limpiarlas al
cerrar sesión.

---

## H-13 · [M] Feriados móviles sin confirmar

**Evidencia (datos):** varias fechas del calendario de feriados siguen marcadas
para verificación. El calculador puede aprobar una fecha que en realidad es
feriado, contradiciendo su promesa principal.

**Decisión:** confirmar las fechas con la fuente oficial antes del inicio del
semestre; es trabajo de datos, no de código.

---

## H-14 · [M] La detección de choques no se acota

**Evidencia (código):** la consulta cruza **todas** las actividades publicadas
entre sí y se ejecuta en **cada** carga del calendario, sin filtrar por rango de
fechas ni por segmento. Con el volumen actual es imperceptible; crece de forma
cuadrática con el histórico acumulado.

**Decisión:** acotar por el rango visible del calendario y apoyar con índice.

---

## Conclusión de la fase 0

Los cuatro hallazgos críticos comparten una causa de fondo: **las garantías se
definieron en la interfaz o en un solo camino de código, no en el servidor como
regla única**. La corrección apunta a consolidar esas reglas en un lugar y a que
las pruebas ejerciten las interacciones entre capas, no solo funciones aisladas.

Sin elementos pendientes de aclaración técnica. Las decisiones que requieren
criterio de producto están aisladas en [dilemas.md](./dilemas.md).
