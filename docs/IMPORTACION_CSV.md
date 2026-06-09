# 📥 Importación de evaluaciones por CSV

Permite cargar **muchas fechas del calendario académico de una sola vez** (ideal cuando una misma evaluación —p. ej. *Cálculo I*— aplica a varias carreras). Disponible para **administradores** en **Calendario académico → Importar evaluaciones (CSV)**.

---

## Formato del archivo

- Codificación **UTF-8**.
- Separador de columnas: **`,` o `;`** (se autodetecta — sirve el CSV exportado por Excel en español).
- La **primera fila es el encabezado** con los nombres de columna (en minúsculas).
- Una fila por evaluación. El **público** de cada fila puede abarcar varias carreras y años.

### Columnas

| Columna | Obligatoria | Descripción |
|---------|:----------:|-------------|
| `titulo` | ✅ | Nombre de la evaluación/fecha. |
| `tipo` | – | `EXAMEN` (evaluación), `HITO_ACADEMICO` o `EVENTO`. Por defecto `EXAMEN`. |
| `inicio` | ✅ | Fecha y hora `AAAA-MM-DD HH:MM` (ej. `2026-04-15 18:30`). |
| `fin` | – | Igual formato. Si se deja **vacío**, se asume `inicio + 2 horas`. |
| `carreras` | ✅ | Uno o varios **códigos** separados por `\|`, o `*` para **todas**. |
| `niveles` | ✅ | Uno o varios **años** separados por `\|` (ej. `1` o `1\|2`), o `*` para **todos**. |
| `ubicacion` | – | Lugar (texto libre). |
| `entidad` | – | Sigla de la entidad responsable. Por defecto **DOCFI** (Dirección de Docencia). |

> El **público objetivo** resultante de cada fila = **cada carrera × cada año** indicado.
> Ej.: `carreras = ICI\|ICINF` y `niveles = 1\|2` → 4 segmentos (ICI-1, ICI-2, ICINF-1, ICINF-2).

### Códigos de carrera

| Código | Carrera |
|--------|---------|
| `IC` | Ingeniería Civil |
| `ICAE` | Ingeniería Civil Aeroespacial |
| `ICB` | Ingeniería Civil Biomédica |
| `ICEL` | Ingeniería Civil Electrónica |
| `ICE` | Ingeniería Civil Eléctrica |
| `ICI` | Ingeniería Civil Industrial |
| `ICINF` | Ingeniería Civil Informática |
| `ICMAT` | Ingeniería Civil de Materiales |
| `ICM` | Ingeniería Civil Mecánica |
| `ICMET` | Ingeniería Civil Metalúrgica |
| `ICMIN` | Ingeniería Civil de Minas |
| `ICQ` | Ingeniería Civil Química |
| `ICT` | Ingeniería Civil en Telecomunicaciones |
| `ICPC` | Ingeniería Civil – Plan Común |

*(Si cambian los códigos en la plataforma, se respetan los que estén cargados; estos son los del seed inicial.)*

---

## Ejemplo

```csv
titulo,tipo,inicio,fin,carreras,niveles,ubicacion
Certamen 1 Cálculo I,EXAMEN,2026-04-15 18:30,2026-04-15 20:00,ICI|ICINF|ICM|ICE,1,Aula Magna
Certamen 2 Física I,EXAMEN,2026-05-20 18:30,,*,1,
Entrega Proyecto de Título,HITO_ACADEMICO,2026-06-10 23:59,,ICI,5,
Charla de Bienvenida,EVENTO,2026-03-12 12:00,2026-03-12 13:30,*,1,Auditorio
```

Interpretación:
1. *Certamen 1 Cálculo I*: 4 carreras × 1.er año = 4 segmentos, fin explícito, en Aula Magna.
2. *Certamen 2 Física I*: **todas** las carreras, 1.er año; sin `fin` → dura 2 h.
3. *Entrega Proyecto*: solo ICI, 5.º año.
4. *Charla de Bienvenida*: evento para todas las carreras de 1.er año.

---

## Cómo importar

1. Entra como **administrador** → **Calendario académico**.
2. En **Importar evaluaciones (CSV)**: pega el contenido o **sube el archivo**.
   - Puedes **Descargar plantilla** para partir de un ejemplo.
3. Pulsa **Importar**. Verás cuántas se crearon y, si las hay, las **filas con error** (con el motivo) para corregirlas y reintentar.

> Las filas válidas se importan aunque otras fallen: corriges las erróneas y vuelves a subir solo esas.

---

## Errores comunes

| Mensaje | Causa / solución |
|---------|------------------|
| `Encabezado inválido` | Falta alguna columna obligatoria (`titulo`, `inicio`, `carreras`, `niveles`). |
| `código de carrera desconocido: X` | El código no existe; revisa la tabla de códigos. |
| `inicio inválido` | Formato de fecha distinto a `AAAA-MM-DD HH:MM`. |
| `faltan carreras o niveles` | La celda quedó vacía; usa códigos o `*`. |
