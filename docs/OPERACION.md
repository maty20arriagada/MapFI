---
title: "Operación — limpiar datos y borrado definitivo"
tags: [mapfi, operacion, mantenimiento, superadmin]
date: 2026-08-13
status: vigente
aliases: ["Operación MapFI"]
---

# 🧹 Operación: puesta a punto, limpieza y borrado definitivo

---

# PARTE 0 · Dejar la plataforma lista desde cero

Secuencia completa para partir con la base limpia y todas las cuentas creadas.
**Ejecutada y verificada el 2026-08-13.**

### Paso 1 · Respaldar (siempre, aunque creas que no hay nada)

```bash
mkdir -p respaldos
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > respaldos/respaldo_$(date +%Y%m%d_%H%M).sql
```

Comprueba que pesa algo antes de seguir: `ls -lh respaldos/`. Un respaldo de 0 bytes no
sirve de nada, y es justo lo que descubres tarde.

> La carpeta `respaldos/` está en `.gitignore`: **un volcado contiene los hashes de las
> contraseñas y no debe subirse nunca al repositorio.**

### Paso 2 · Borrar todo y volver a levantar

```bash
docker compose down -v && docker compose up -d --build
```

Esto destruye el volumen de la base. Al arrancar se aplican solas las **15 migraciones** y
se siembran los catálogos: 14 carreras, 5 niveles, 17 entidades, feriados y matrícula
referencial.

### Paso 3 · Crear las cuentas

```bash
# 16 cuentas: los 14 centros + Vinculación con el Medio + Gearbox
docker compose exec server node js/db/seed-cuentas.js

# Cuenta maestra (administración)
docker compose exec server node js/db/reset-admin.js admin@mapfi.cl "<clave-larga>"

# Cuenta con borrado definitivo (solo si la necesitas)
docker compose exec server node js/db/crear-superadmin.js super@mapfi.cl "<clave-larga>"
```

### Paso 4 · Comprobar cómo quedó

```bash
docker compose exec -T db psql -U mapfi -d mapfi -c "SELECT rol, count(*) FROM usuario GROUP BY rol ORDER BY rol;"
curl -s http://127.0.0.1:3000/api/health
```

Debe dar **1 ADMIN, 16 APORTANTE, 1 SUPERADMIN** y la migración `015`.

---

## Las cuentas y qué puede hacer cada una

Las contraseñas de los centros siguen la convención `<carrera>2030`. **Son claves iniciales
conocidas**: cada centro debería cambiarla en su primer ingreso desde "Mi cuenta".

| Cuenta | Entidad | Contraseña inicial |
|---|---|---|
| `civil@mapfi.cl` | CEE Ingeniería Civil | `civil2030` |
| `aeroespacial@mapfi.cl` | CEE Aeroespacial | `aeroespacial2030` |
| `biomedica@mapfi.cl` | CEE Biomédica | `biomedica2030` |
| `electronica@mapfi.cl` | CEE Electrónica | `electronica2030` |
| `electrica@mapfi.cl` | CEE Eléctrica | `electrica2030` |
| `industrial@mapfi.cl` | CEE Industrial | `industrial2030` |
| `informatica@mapfi.cl` | CEE Informática | `informatica2030` |
| `materiales@mapfi.cl` | CEE Materiales | `materiales2030` |
| `mecanica@mapfi.cl` | CEE Mecánica | `mecanica2030` |
| `metalurgica@mapfi.cl` | CEE Metalúrgica | `metalurgica2030` |
| `minas@mapfi.cl` | CEE Minas | `minas2030` |
| `quimica@mapfi.cl` | CEE Química | `quimica2030` |
| `telecomunicaciones@mapfi.cl` | CEE Telecomunicaciones | `telecomunicaciones2030` |
| `plancomun@mapfi.cl` | CEE Plan Común | `plancomun2030` |
| **`vinculacion@mapfi.cl`** | **Vinculación con el Medio** | `vinculacion2030` |
| `gearbox@mapfi.cl` | Gearbox | `gearbox2030` |

| Rol | Puede | No puede |
|---|---|---|
| **APORTANTE** (centros y VcM) | Publicar, editar y eliminar **lo suyo**; importar CSV; ver su reporte | Tocar actividades de otra entidad · entrar al panel de administración |
| **ADMIN** (cuenta maestra) | Todo lo anterior sobre cualquier entidad · ratificar, retirar y restituir · crear cuentas, carreras y periodos | Borrar de forma definitiva |
| **SUPERADMIN** | Todo lo del ADMIN · **borrado definitivo** | — |

---

## Cómo comprobar que las cuentas funcionan

Verificado con estas mismas llamadas. Sustituye el servidor si no es local.

**Vinculación con el Medio** — debe publicar de inmediato y quedar acotada a su entidad:

```bash
# 1. Entrar
curl -s -c vcm.txt -H "Content-Type: application/json" \
  -d '{"email":"vinculacion@mapfi.cl","password":"vinculacion2030"}' \
  http://127.0.0.1:3000/api/auth/login

# 2. Publicar una actividad suya
curl -s -b vcm.txt -H "Content-Type: application/json" \
  -d '{"titulo":"Feria de Empleabilidad","tipo":"EVENTO","fechaInicio":"2026-09-24T15:00","fechaFin":"2026-09-24T19:00","ubicacion":"Patio central","urlInscripcion":"https://forms.gle/ejemplo","publico":[{"carreraId":6,"nivel":5}]}' \
  http://127.0.0.1:3000/api/actividades

# 3. Debe verse sin sesión, y aparecer en el filtro "para participar"
curl -s http://127.0.0.1:3000/api/actividades | grep Feria
curl -s "http://127.0.0.1:3000/api/actividades?soloParticipacion=1" | grep Feria

# 4. NO debe poder entrar al panel de administración (espera 403)
curl -s -b vcm.txt -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/api/admin/usuarios
```

**Cuenta maestra (admin)** — ratificar, retirar y restituir:

```bash
curl -s -c adm.txt -H "Content-Type: application/json" \
  -d '{"email":"admin@mapfi.cl","password":"<clave>"}' \
  http://127.0.0.1:3000/api/auth/login

curl -s -b adm.txt http://127.0.0.1:3000/api/admin/pendientes
curl -s -b adm.txt -H "Content-Type: application/json" -d '{"ids":[1],"accion":"APROBAR"}' \
  http://127.0.0.1:3000/api/admin/actividades/revisar
curl -s -b adm.txt -X POST -H "Content-Type: application/json" -d '{"motivo":"prueba"}' \
  http://127.0.0.1:3000/api/admin/actividades/1/retirar
curl -s -b adm.txt -X POST http://127.0.0.1:3000/api/admin/actividades/1/restituir
```

**Superadmin** — hereda lo del admin y además borra definitivo:

```bash
curl -s -c sup.txt -H "Content-Type: application/json" \
  -d '{"email":"super@mapfi.cl","password":"<clave>"}' \
  http://127.0.0.1:3000/api/auth/login

curl -s -b sup.txt -X DELETE -H "Content-Type: application/json" -d '{"motivo":"dato de prueba"}' \
  http://127.0.0.1:3000/api/superadmin/actividades/1
curl -s -b sup.txt http://127.0.0.1:3000/api/superadmin/borrados
```

### Resultado esperado

| Comprobación | Esperado |
|---|---|
| VcM publica | `201`, estado `PROPUESTA`, visible sin sesión |
| VcM intenta publicar para otra entidad | Se guarda igual, pero **con la entidad de VcM** |
| VcM entra al panel admin | `403` |
| Admin ratifica | La actividad pasa a `CONFIRMADA` |
| Admin intenta borrado definitivo | `403` |
| Superadmin borra definitivo | La fila desaparece, **no** sale en el aviso público, **sí** en el registro interno |

---

## Datos de ejemplo que quedan tras el reinicio

La migración 002 siembra **2 actividades de muestra** (`Certamen 1 - Cálculo I` y
`Semana del Novato`). Sirven para que el calendario no se vea vacío en una demostración.
Si prefieres arrancar sin nada:

```bash
docker compose exec -T db psql -U mapfi -d mapfi -c "TRUNCATE actividad RESTART IDENTITY CASCADE;"
```

---

# PARTE 1 · Limpieza y borrado definitivo

Tareas de mantenimiento que **no** forman parte del uso diario. Todo lo de aquí es
**irreversible**: léelo antes de ejecutar.

> **Antes de cualquiera de estos comandos, haz un respaldo:**
> ```bash
> docker compose exec -T db pg_dump -U mapfi mapfi > respaldo_$(date +%F_%H%M).sql
> ```
> Restaurar: `cat respaldo_XXXX.sql | docker compose exec -T db psql -U mapfi mapfi`

---

## 1. Vaciar los registros

Hay **dos niveles**, y la diferencia importa mucho. Elige según lo que quieras conservar.

### Opción A · Borrar solo las actividades (recomendada antes de abrir la plataforma)

Deja intactas las **cuentas** de los centros, las **carreras**, las **entidades**, los
**periodos**, los **horarios** y la **matrícula**. Solo limpia lo que cargaron los centros.

```bash
docker compose exec -T db psql -U mapfi -d mapfi -c "TRUNCATE actividad RESTART IDENTITY CASCADE; TRUNCATE borrado_definitivo RESTART IDENTITY; TRUNCATE reputacion_log RESTART IDENTITY; UPDATE entidad SET reputacion = 0, eventos_exitosos = 0, sello_coordinacion = FALSE;"
```

Qué hace cada parte:

| | |
|---|---|
| `TRUNCATE actividad … CASCADE` | Borra las actividades y, en cascada, su público objetivo |
| `RESTART IDENTITY` | Reinicia los identificadores, para que la primera actividad real sea la 1 |
| `TRUNCATE borrado_definitivo` | Limpia el registro de borrados de la etapa de pruebas |
| `TRUNCATE reputacion_log` | Limpia el historial de reputación |
| `UPDATE entidad SET …` | Pone a cero la reputación y los sellos que dejaron los datos de prueba |

> Esa última línea es fácil de olvidar: la reputación y el sello viven en `entidad`, no en
> `actividad`. Sin ella, los centros arrancarían con puntaje y sellos ganados con datos
> falsos.

### Opción B · Borrar absolutamente todo y empezar de cero

Destruye el volumen de la base. Se pierden **también las cuentas y los catálogos**, y al
levantar de nuevo se vuelven a aplicar las migraciones y las semillas.

```bash
docker compose down -v && docker compose up -d --build
```

Después hay que rehacer las cuentas:

```bash
docker compose exec server node js/db/seed-cuentas.js
docker compose exec server node js/db/reset-admin.js admin@mapfi.cl "<clave-larga>"
docker compose exec server node js/db/crear-superadmin.js super@mapfi.cl "<clave-larga>"
```

### Comprobar cómo quedó

```bash
docker compose exec -T db psql -U mapfi -d mapfi -c "SELECT 'actividades' t, count(*) FROM actividad UNION ALL SELECT 'usuarios', count(*) FROM usuario UNION ALL SELECT 'entidades', count(*) FROM entidad UNION ALL SELECT 'borrados', count(*) FROM borrado_definitivo;"
```

---

## 2. El rol SUPERADMIN y el borrado definitivo

### Para qué existe

En el uso normal, **eliminar no destruye**: la actividad pasa a estado oculto y aparece 30
días en el aviso público de cancelaciones. Eso es deliberado — le avisa al estudiante que
ya tenía la fecha anotada.

El **borrado definitivo** cubre lo que ese flujo no debe cubrir:

- limpiar datos de prueba antes de abrir la plataforma;
- retirar contenido publicado por error que no corresponde dejar visible 30 días.

### Crear la cuenta

```bash
docker compose exec server node js/db/crear-superadmin.js super@mapfi.cl "<clave-de-8-o-mas>"
```

Si el correo ya existe, lo **asciende** a SUPERADMIN. El rol es un superconjunto de ADMIN:
puede todo lo que un administrador, y además borrar de forma definitiva.

### Usarlo

```bash
# Borrar una actividad para siempre (no aparece en el aviso público)
curl -b cookies.txt -X DELETE -H "Content-Type: application/json" \
  -d '{"motivo":"dato de prueba"}' \
  http://TU-SERVIDOR/api/superadmin/actividades/123

# Ver qué se ha borrado definitivamente, por quién y por qué
curl -b cookies.txt http://TU-SERVIDOR/api/superadmin/borrados
```

### Qué queda y qué no

| | |
|---|---|
| La actividad | **Destruida**, junto con su público objetivo. No se puede restituir |
| Aviso público de cancelaciones | **No aparece** |
| Feed de calendario | **No aparece** |
| Registro interno `borrado_definitivo` | **Sí**: qué era, de qué centro, quién lo borró, cuándo y por qué |
| Log del servidor | Sí, una línea de advertencia por cada borrado |

> **Por qué queda registro interno.** Pediste que el borrado no apareciera en "borrados
> recientemente", y así es. Pero *no anunciarlo* y *no dejar rastro en ninguna parte* son
> cosas distintas: si una actividad desaparece y nadie puede averiguar qué pasó, cualquier
> reclamo se vuelve imposible de resolver. El registro es interno y solo lo ve un
> SUPERADMIN, así que cumple lo que pediste sin dejar el sistema ciego.

### Recomendaciones

- **Una sola cuenta SUPERADMIN**, y que no sea la de uso diario: para administrar
  (ratificar, retirar, restituir, crear cuentas) basta y sobra con ADMIN.
- Está en una **ruta aparte** a propósito, no como una casilla del borrado normal: así es
  imposible destruir algo por accidente creyendo que se archivaba.
- El borrado normal (`DELETE /api/actividades/:id`) **sigue siendo el flujo correcto** para
  los centros y no cambió.
