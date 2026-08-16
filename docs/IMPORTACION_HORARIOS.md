---
title: Importación de horarios por CSV
tags:
  - documentacion
  - guia
  - horarios
date: 2026-08-15
status: verificado
aliases:
  - Importacion Horarios
---

# 📅 Importación de horarios por CSV

Permite cargar **el horario semanal completo de un curso de una sola vez**, en
lugar de agregar cada bloque a mano. Disponible en **Horarios** para
administradores y para el centro de estudiantes de la carrera correspondiente
(cada centro solo puede importar en la carrera de su propia entidad).

Ningún archivo se guarda en el servidor: se interpreta **enteramente en el
navegador** y solo viaja a MapFI el resultado ya estructurado.

---

## Formato del archivo

- Codificación **UTF-8** (tolera el BOM que agrega Excel).
- Separador de columnas: **`;`, `,` o tabulación** — se autodetecta. La
  tabulación es la que produce el portapapeles al **copiar celdas** desde una
  planilla: no hace falta exportar nada, basta con copiar y pegar.
- La **primera fila es el encabezado**. El orden de las columnas es libre.
- Una fila por bloque de clase.

### Columnas

| Columna | Obligatoria | Descripción |
|---------|:----------:|-------------|
| `dia` | ✅ | `LUN`..`VIE`, el nombre completo (`Lunes`..`Viernes`, con o sin tilde) o `1`..`5`. |
| `inicio` | ✅ | Hora de inicio, `HH:MM` o `H:MM` (24 horas). |
| `fin` | ✅ | Hora de término, mismo formato. Debe ser posterior a `inicio`. |
| `ramo` | ✅ | Nombre de la asignatura o actividad. Es lo que se ve en el bloque. |
| `tipo` | – | `CLASE` (por defecto), `PROTEGIDO` o `LIBRE`. |
| `codigo` | – | Código de la asignatura (ej. `525101`). |
| `seccion` | – | Sección, si la carrera dicta paralelos. |
| `sala` | – | Sala o laboratorio. |
| `docente` | – | Nombre del profesor. |

Se aceptan alias comunes en el encabezado (no distingue mayúsculas, tildes ni
guiones bajos): `asignatura`/`materia`/`descripcion` para `ramo`,
`hora_inicio` para `inicio`, `termino`/`hora_termino` para `fin`.

> Una hora que no cae en un cuarto de hora exacto (p. ej. `11:50`) **no es un
> error**: se importa igual y se ajusta solo al dibujarla en la grilla,
> conservando la hora real en la etiqueta del bloque.

---

## Ejemplo

```csv
dia;inicio;fin;ramo;tipo;codigo;seccion;sala;docente
LUN;08:00;09:30;Cálculo I;CLASE;525101;1;Aula 201;
LUN;09:45;10:30;Física I;CLASE;;;Lab. Física;
MIE;11:50;13:20;Bloque protegido FI;PROTEGIDO;;;;
```

Interpretación:
1. *Cálculo I*: lunes 08:00–09:30, con código y sala.
2. *Física I*: lunes 09:45–10:30, solo con sala.
3. *Bloque protegido FI*: miércoles 11:50–13:20 — se dibuja ajustado al
   cuarto de hora más cercano, pero la etiqueta muestra "11:50–13:20".

---

## Cómo importar

1. Entra a **Horarios**, elige tu **carrera** y **generación**.
2. En **Importar horario**: sube el archivo o pega el contenido copiado desde
   tu planilla. Puedes **Descargar plantilla** para partir de un ejemplo.
3. Pulsa **Vista previa**: verás cuántas filas son válidas y, si las hay, las
   **filas con error** (con el número de fila y el motivo) para corregirlas.
4. Elige qué hacer con el horario que ya exista en ese segmento:
   - **Agregar a lo existente** — suma los bloques del archivo a los que ya
     hay.
   - **Reemplazar el horario del segmento** — borra los bloques actuales de
     esa carrera y generación y carga los del archivo en su lugar.
   No hay una opción marcada por defecto: hay que elegir explícitamente.
5. Pulsa **Confirmar importación**.

> Las filas válidas se importan aunque otras del mismo archivo fallen:
> corriges las erróneas y vuelves a subir solo esas.

### Antes de vaciar un horario

El botón **"Vaciar horario de este segmento"** descarga automáticamente una
copia del horario actual (en este mismo formato) antes de pedir confirmación,
para que la operación tenga vuelta atrás: si te arrepientes, puedes
reimportar ese mismo archivo.

---

## Errores comunes

| Mensaje | Causa / solución |
|---------|------------------|
| `Encabezado inválido: se requieren columnas dia, inicio, fin y ramo` | Falta alguna columna obligatoria en la primera fila. |
| `día inválido: 'X'` | La celda de día no es `LUN`..`VIE`, un nombre completo ni `1`..`5`. |
| `hora de inicio inválida` / `hora de término inválida` | Formato distinto a `HH:MM`. |
| `la hora de término no puede ser anterior o igual a la de inicio` | Revisa que `fin` sea posterior a `inicio`. |
| `falta el ramo` | La celda de `ramo` quedó vacía. |
| *(archivo rechazado sin filas)* | Si arrastraste un `.xlsx` o `.pdf` real, la página lo detecta y te pide exportarlo a CSV o pegar las celdas en su lugar. |

---

## Quién puede importar

- **ADMIN** y **SUPERADMIN**: cualquier carrera y generación.
- **Centro de estudiantes (APORTANTE)**: solo la carrera de su propia
  entidad, en cualquier generación. Un centro sin carrera asociada
  (Vinculación con el Medio, Gearbox, Dirección de Docencia) no puede
  importar horarios.

La autorización se verifica en el servidor en cada importación, no solo en
la interfaz.
