# Quickstart: validación de la corrección documental

**Feature**: 001-fix-guia-tecnica · **Fase**: 1 (Design)

Guía de validación **ejecutable** que prueba que la corrección quedó bien. No
contiene la implementación (el texto corregido va en la edición de los documentos,
guiada por `tasks.md`). Cada escenario mapea a un Success Criterion del spec.

## Prerrequisitos

- Repositorio en la raíz del proyecto MapFI.
- Bash (o Git Bash en Windows) para los comandos de verificación.
- Los documentos `docs/GUIA_TECNICA.md` y `docs/ARQUITECTURA.md` ya editados.

## Escenario 1 — Cero referencias al "simulador" (SC-003, FR-006)

```bash
grep -rniE "simulador|marketing" docs/GUIA_TECNICA.md docs/ARQUITECTURA.md
```

**Resultado esperado**: sin coincidencias (salida vacía, exit code 1).

## Escenario 2 — Todas las rutas citadas existen (SC-001, FR-008)

Extraer las rutas tipo `js/…`, `__tests__/…`, `db/…` mencionadas y comprobar que
existen:

```bash
grep -rhoE '(js|__tests__|db)/[A-Za-z0-9_./-]+' docs/GUIA_TECNICA.md docs/ARQUITECTURA.md \
  | sed 's/[.,)]$//' | sort -u \
  | while read p; do [ -e "$p" ] || echo "FALTA: $p"; done
```

**Resultado esperado**: no imprime ninguna línea `FALTA:` (todas existen).

## Escenario 3 — Testing apunta a la carpeta y patrón reales (SC-002, FR-001…FR-004)

```bash
# La guía menciona la carpeta real de DAOs y NO la carpeta equivocada
grep -q "__tests__/dao" docs/GUIA_TECNICA.md && echo "OK dao/"
! grep -q "__tests__/db\b" docs/GUIA_TECNICA.md && echo "OK sin __tests__/db"
# Menciona el patrón real y la nota de pg-mem
grep -qiE "jest.mock|mock.*js/db" docs/GUIA_TECNICA.md && echo "OK patron mock"
grep -qi "pg-mem" docs/GUIA_TECNICA.md && echo "OK nota pg-mem"
# Menciona ambas carpetas de tests de API
grep -q "__tests__/server" docs/GUIA_TECNICA.md && grep -q "__tests__/routes" docs/GUIA_TECNICA.md && echo "OK server+routes"
```

**Resultado esperado**: imprime las 5 líneas `OK …`.

**Validación humana (SC-002)**: alguien nuevo que siga §2 y §6 al pie de la letra
crea el test de un DAO nuevo en `__tests__/dao/` con `jest.mock("../../js/db")`,
sin preguntar a nadie.

## Escenario 4 — El diagrama de `js/` cubre cada carpeta real (SC-004, FR-005)

```bash
for c in dao services views db vendor; do
  grep -q "js/$c" docs/GUIA_TECNICA.md && echo "OK $c" || echo "FALTA $c en diagrama"
done
```

**Resultado esperado**: `OK dao`, `OK services`, `OK views`, `OK db`, `OK vendor`.

## Escenario 5 — No hay regresión de alcance (FR-007, FR-009)

- La Guía Técnica conserva sus secciones de convenciones, agregar endpoint,
  migraciones y errores/logging (revisión visual del índice del documento).
- La Arquitectura conserva capas, flujo de match, seguridad y escalabilidad sin
  cambios más allá de las referencias al "simulador".

**Resultado esperado**: ambos documentos mantienen su estructura y longitud
salvo las correcciones puntuales de D1–D6.

---

> Nota: esta feature no ejecuta código de la app ni la base de datos; `npm test`
> debe seguir en verde porque no se toca ningún test (validación de no-regresión
> del código: `npm test`).
