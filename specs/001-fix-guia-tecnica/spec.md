# Feature Specification: Documentación técnica alineada con el código real

**Feature Branch**: `001-fix-guia-tecnica`

**Created**: 2026-07-17

**Status**: Draft

**Input**: User description: Guía Técnica de MapFI (docs/GUIA_TECNICA.md) pegada como plantilla de referencia, con la instrucción de "adaptarla a esto" — es decir, corregirla para que describa fielmente las convenciones y la estructura reales del proyecto MapFI, en vez de las de un proyecto hermano ("el simulador") del que fue copiada.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ubicar y escribir tests en la carpeta correcta (Priority: P1)

Una persona desarrolladora que se suma al proyecto sigue `docs/GUIA_TECNICA.md` para saber dónde y con qué herramienta probar un DAO nuevo. Hoy la guía indica una carpeta y una herramienta que no coinciden con lo que existe en el repositorio, lo que le hace perder tiempo buscando archivos que no existen o instalando/aprendiendo una herramienta que el proyecto no usa.

**Why this priority**: Es la sección de la guía con más probabilidad de generar trabajo directamente incorrecto (archivos creados en la carpeta equivocada, suposiciones erróneas sobre la herramienta de testing). Es el bloque de mayor impacto práctico para quien extiende el código.

**Independent Test**: Se puede validar leyendo la sección de Testing de la guía y comparándola contra las carpetas y patrones reales en `__tests__/`, sin depender de ninguna otra sección del documento.

**Acceptance Scenarios**:

1. **Given** la guía técnica actualizada, **When** una persona desarrolladora busca dónde va el test de un DAO nuevo, **Then** la ruta y la herramienta indicadas (carpeta y patrón de mock) coinciden exactamente con lo usado en los tests de DAO existentes del repositorio.
2. **Given** la guía técnica actualizada, **When** una persona desarrolladora revisa la tabla de tipos de test, **Then** cada fila (servicios, DAO, API) apunta a una carpeta que existe en `__tests__/` y describe la herramienta/patrón que realmente usan los archivos de esa carpeta.

---

### User Story 2 - Orientarse en la estructura real de `js/` (Priority: P2)

Una persona desarrolladora usa el diagrama de "Estructura de `js/`" de la guía para entender dónde vive cada responsabilidad (vistas, utilidades, DAOs, servicios) antes de agregar código nuevo. Hoy el diagrama omite carpetas y archivos que existen en el proyecto (por ejemplo las vistas de página, el panel de administración, utilidades de import/export), por lo que da una imagen incompleta del código.

**Why this priority**: Es la referencia rápida que más se consulta al planear dónde ubicar código nuevo; una imagen incompleta lleva a duplicar funcionalidad o ubicar archivos de forma inconsistente con el resto del proyecto.

**Independent Test**: Se puede validar comparando el listado del diagrama contra el resultado real de listar `js/` y sus subcarpetas, de forma independiente del resto de la guía.

**Acceptance Scenarios**:

1. **Given** la guía técnica actualizada, **When** se compara el diagrama de estructura con el contenido real de `js/`, **Then** todas las carpetas de primer nivel (`dao/`, `services/`, `views/`, `db/`, `vendor/`) están representadas con al menos un ejemplo de archivo y su propósito.
2. **Given** la guía técnica actualizada, **When** una persona desarrolladora busca dónde ubicar un archivo nuevo de un tipo ya existente (por ejemplo otra vista de página o utilidad de frontend), **Then** encuentra en el diagrama una carpeta o archivo análogo que le sirve de referencia.

---

### User Story 3 - Leer una guía autocontenida, sin referencias a otro proyecto (Priority: P3)

Una persona desarrolladora que nunca ha trabajado en el proyecto hermano ("el simulador") lee la guía técnica y la arquitectura de MapFI. Hoy ambos documentos justifican decisiones de diseño comparándolas con ese otro proyecto, lo cual no le aporta información (no lo conoce) y da la impresión de que la documentación fue copiada sin revisar.

**Why this priority**: Es una corrección de calidad/confianza en la documentación, no bloquea tareas concretas como las historias 1 y 2, pero afecta la percepción de que la documentación es confiable y propia del proyecto.

**Independent Test**: Se puede validar con una búsqueda de texto de la palabra "simulador" en `docs/GUIA_TECNICA.md` y `docs/ARQUITECTURA.md`; el resultado esperado es que no haya coincidencias, o que las decisiones que antes se justificaban por comparación queden justificadas con argumentos propios de MapFI.

**Acceptance Scenarios**:

1. **Given** los documentos `docs/GUIA_TECNICA.md` y `docs/ARQUITECTURA.md` actualizados, **When** se busca la palabra "simulador" en ambos archivos, **Then** no aparece ninguna referencia a ese proyecto externo.
2. **Given** una decisión de diseño que antes se explicaba solo "igual que el simulador" (por ejemplo, no usar framework de frontend, o cómo se arma `DATABASE_URL` en Docker), **When** se lee la versión actualizada, **Then** la justificación se sostiene por sí sola con razones propias de MapFI.

### Edge Cases

- ¿Qué pasa si en el futuro se agrega una nueva carpeta bajo `js/` o `__tests__/` y la guía vuelve a quedar desactualizada? (Fuera del alcance de esta corrección puntual, pero la redacción no debe invitar a ese desfase, p. ej. evitando listar exhaustivamente cada archivo cuando basta un ejemplo representativo por carpeta.)
- ¿Qué pasa con la dependencia `pg-mem` declarada en `package.json` pero no usada por ningún test? Debe quedar explícitamente señalada como no utilizada actualmente, para que nadie asuma que es el mecanismo real de testing de DAOs.
- ¿Qué pasa si alguien sigue el patrón de "agregar entidad" (Sección 2 de la guía) tal como está hoy? Debe producir una carpeta de test coherente con el resto del proyecto, no una carpeta nueva y distinta (`__tests__/db/`) que rompería la consistencia aunque Jest igual la ejecute.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `docs/GUIA_TECNICA.md` MUST describir la ubicación real de los tests de DAO (`__tests__/dao/`) en el patrón de "agregar entidad" (Sección 2) y en la tabla de Testing (Sección 6).
- **FR-002**: `docs/GUIA_TECNICA.md` MUST describir el patrón real usado para probar DAOs (mock manual de `js/db` vía `jest.mock`, con un cliente simulado) en vez de referirse a `pg-mem` como si fuera el mecanismo activo.
- **FR-003**: `docs/GUIA_TECNICA.md` MUST señalar que `pg-mem` figura como dependencia de desarrollo pero no está en uso por ningún test actualmente, para evitar que alguien lo asuma como el patrón vigente.
- **FR-004**: `docs/GUIA_TECNICA.md` MUST reflejar en la tabla de Testing (Sección 6) que existen tests de API/rutas tanto en `__tests__/server/` como en `__tests__/routes/`, describiendo qué distingue a cada carpeta (por ejemplo, contra la app real vs. con `js/db` mockeado).
- **FR-005**: `docs/GUIA_TECNICA.md` MUST actualizar el diagrama de "Estructura de `js/`" (Sección 7) para incluir las carpetas y archivos reales de primer nivel que hoy faltan, incluyendo como mínimo: `js/dao/` (con ejemplo de archivo), `js/views/` (vistas de página), y los módulos de frontend existentes que no aparecen hoy (por ejemplo `admin-panel.js`, `app-boot.js`, `csv-utils.js`, `filters.js`, `horarios-view.js`, `kpis-view.js`, `layout.js`, `sanitize.js`, `vendor/`).
- **FR-006**: `docs/GUIA_TECNICA.md` y `docs/ARQUITECTURA.md` MUST eliminar toda referencia al proyecto externo "el simulador", reemplazando cualquier justificación que dependiera de esa comparación por una razón propia de MapFI (o eliminándola si no aporta información nueva).
- **FR-007**: `docs/ARQUITECTURA.md` MUST mantener sin alterar el contenido ya verificado como correcto (capas y responsabilidades, flujo de match, patrón de migraciones, seguridad, configuración por entorno, decisiones técnicas, escalabilidad), limitando los cambios a las referencias al proyecto externo identificadas en FR-006.
- **FR-008**: Todas las rutas de archivos y carpetas mencionadas en `docs/GUIA_TECNICA.md` y `docs/ARQUITECTURA.md` MUST corresponder a rutas que existen efectivamente en el repositorio en el momento de la corrección.
- **FR-009**: `docs/GUIA_TECNICA.md` MUST conservar su función original de guía de patrones para desarrolladores (cómo agregar una entidad, cómo agregar un endpoint, convenciones de código, migraciones, errores y logging) sin reducir su alcance a solo la sección de testing y estructura.

### Key Entities

- **Guía Técnica** (`docs/GUIA_TECNICA.md`): documento de referencia para desarrolladores que extienden el código; describe patrones (agregar entidad, agregar endpoint), convenciones, testing y estructura de `js/`.
- **Arquitectura** (`docs/ARQUITECTURA.md`): documento de referencia de más alto nivel, lectura previa recomendada antes de la Guía Técnica; describe capas, flujo de peticiones, seguridad y decisiones técnicas.
- **Estructura real del repositorio**: el conjunto de carpetas y archivos bajo `js/`, `__tests__/` y `db/migrations/` tal como existen hoy, que sirve de fuente de verdad contra la cual se valida cada afirmación de ambos documentos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las rutas de archivo y carpeta mencionadas en `docs/GUIA_TECNICA.md` y `docs/ARQUITECTURA.md` existen en el repositorio (verificable listando cada ruta citada).
- **SC-002**: Una persona nueva en el proyecto que sigue la Sección 2 y la Sección 6 de la Guía Técnica al pie de la letra crea el archivo de test de un DAO nuevo en la misma carpeta y con el mismo patrón de mock que los DAOs existentes, sin necesidad de preguntar a otra persona del equipo.
- **SC-003**: Cero coincidencias de la palabra "simulador" al buscar en `docs/GUIA_TECNICA.md` y `docs/ARQUITECTURA.md`.
- **SC-004**: El diagrama de estructura de `js/` en la Guía Técnica incluye al menos un ejemplo representativo de cada carpeta de primer nivel que existe hoy bajo `js/`.

## Assumptions

- El alcance de esta corrección son los documentos `docs/GUIA_TECNICA.md` y `docs/ARQUITECTURA.md`; el resto de la documentación (`MODELO_DATOS.md`, `ALGORITMO_MATCH.md`, `DESPLIEGUE.md`, `DESPLIEGUE_SERVIDOR.md`, `GUIA_APORTANTE.md`, `IMPORTACION_CSV.md`, `ROADMAP.md`) queda fuera de esta corrección salvo que se detecten en ella las mismas referencias al "simulador" (fuera de alcance confirmado para estos dos archivos).
- La discrepancia entre `pg-mem` (declarado pero no usado) y el patrón real de mock manual se resuelve documentando la realidad del código, no cambiando el código de los tests existentes para adoptar `pg-mem`.
- No se requiere renombrar carpetas de test existentes (`__tests__/dao/`, `__tests__/server/`, `__tests__/routes/`) ni mover archivos; la corrección es puramente documental.
- El resto del contenido de ambos documentos (secciones de convenciones, migraciones, seguridad, decisiones técnicas, etc.) ya es preciso salvo lo señalado explícitamente en los Requisitos Funcionales, y se conserva tal cual.
