---
title: "Revisión de seguridad — MapFI"
tags: [mapfi, seguridad, revision, hallazgos, hardening]
date: 2026-08-04
status: correcciones-aplicadas
aliases: ["Revisión de seguridad", "Seguridad MapFI"]
---

# 🔐 Revisión de seguridad

Auditoría del código completo buscando vulnerabilidades explotables desde el navegador
(inspección con DevTools), exposición de datos, control de acceso e inyección.

**Resultado: 6 hallazgos, todos corregidos.** Ninguno era crítico. Los dos de severidad
media afectaban a producción; los cuatro restantes eran endurecimiento e inconsistencias.

> **Alcance y honestidad del método.** Todo se verificó por **análisis estático del
> código** y con pruebas automatizadas. Docker estaba caído durante esta revisión, así que
> **no se confirmó explotación en un servidor en marcha**. Los hallazgos SEG-2, SEG-5 y
> SEG-6 quedaron además cubiertos por pruebas que fallan sin su corrección; SEG-1, SEG-3 y
> SEG-4 se razonaron sobre el código y su corrección es verificable por lectura.

---

## Resumen

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| SEG-1 | Límite de intentos de login evitable falsificando la IP | **Media** | ✅ Corregido |
| SEG-2 | Código de backend y esquema de la BD descargables | **Media** | ✅ Corregido |
| SEG-3 | XSS almacenado en el selector de carreras (requiere admin) | Baja | ✅ Corregido |
| SEG-4 | XSS almacenado en la tabla de KPIs (requiere admin) | Baja | ✅ Corregido |
| SEG-5 | Sin longitud mínima de contraseña al crear cuentas | Baja | ✅ Corregido |
| SEG-6 | Dependencia `body-parser` con DoS conocido | Baja | ✅ Corregido |

Pruebas: **105** (antes 101), verdes en `npm test` y `npm run test:tz`.
`npm audit --omit=dev` → **0 vulnerabilidades**.

---

## SEG-1 · El límite de intentos de login se podía evitar falsificando la IP

**Severidad: media.** Anula la protección contra fuerza bruta sobre las contraseñas.

El servidor hacía `app.set("trust proxy", 1)` **siempre**, y el limitador de intentos usa
`req.ip`. Con esa configuración Express toma la IP de la cabecera `X-Forwarded-For`, que
el cliente controla. Si la app se expone **directamente** —que es justo el despliegue
simple documentado en `DESPLIEGUE_SERVIDOR.md` (*"La app queda en http://\<IP\>:3000"*)—
bastaba enviar un valor distinto en cada intento para estrenar contador cada vez:

```
POST /api/auth/login   X-Forwarded-For: 1.1.1.1   → intento 1 de 5
POST /api/auth/login   X-Forwarded-For: 1.1.1.2   → intento 1 de 5
...
```

**Corrección.** `trust proxy` pasa a depender de la variable `TRUST_PROXY`, **desactivada
por defecto** (opción segura).

El matiz que hacía delicado el arreglo: con `NODE_ENV=production` las cookies llevan
`secure`, y detrás de nginx eso **exige** `trust proxy` — sin él `req.secure` es `false`,
la cookie de sesión no se emite y **el login falla sin mostrar ningún error**. Por eso no
bastaba con desactivarlo: el servidor ahora **avisa al arrancar** si detecta
`NODE_ENV=production` sin `TRUST_PROXY`, explicando los dos riesgos opuestos.

- `server.js` — `TRUST_PROXY` + aviso de arranque
- `.env.example` — variable documentada con ambos casos
- `docs/DESPLIEGUE_SERVIDOR.md` — obligatorio al montar HTTPS, peligroso sin proxy

## SEG-2 · El código de backend y el esquema de la base eran descargables

**Severidad: media.**

`app.use(express.static(__dirname, { dotfiles: "deny" }))` publicaba **el árbol completo
del proyecto**. `dotfiles: "deny"` tapaba `.env` y `.git`, pero nada más:

```
GET /server.js                        → todo el código del servidor
GET /js/dao/actividadDao.js           → consultas SQL y lógica de acceso a datos
GET /db/migrations/001_schema_inicial.sql → esquema completo de la base
GET /package.json                     → dependencias y versiones
```

El repositorio es público, así que el código en sí no era un secreto; el problema real es
estructural: **cualquier archivo de configuración que se añada y no empiece por punto
queda publicado al instante**.

**Corrección.** Se bloquean las rutas que son solo de backend antes del servidor estático.
Se comprobó primero que ninguna página carga `js/dao`, `js/services` ni `js/db`, y hay una
prueba que verifica **las dos caras**: que el backend deja de servirse y que el frontend
sigue funcionando.

Queda anotado en el código el arreglo de fondo: mover el frontend a un `public/` propio y
servir solo esa carpeta, en vez de mantener una lista de exclusiones.

## SEG-3 y SEG-4 · XSS almacenado (requiere privilegios de administrador)

**Severidad: baja** — plantarlo exige una cuenta de administrador, y lo renderizan páginas
que solo ve un administrador. Aun así son defectos reales, y sobre todo **incoherencias**:
en ambos casos un archivo hermano ya escapaba exactamente el mismo dato.

**SEG-3** — `js/views/calendario-view.js`:

```js
'<label title="' + c.nombre + '">'   // ❌ el nombre entra sin escapar en un ATRIBUTO
```

Una comilla en el nombre de una carrera se sale del atributo `title` y permite inyectar
otros (`onmouseover=`…). `js/views/dashboard-view.js` ya escapaba ese mismo dato.
También iban sin escapar `e.nombre`, `e.sigla` y `c.codigo`.

**SEG-4** — `js/kpis-view.js`: la columna "Carrera" devolvía el nombre sin escapar, aunque
el helper `tabla()` inserta el resultado de `get` como HTML crudo. La columna "Reprog." del
mismo archivo sí usaba `esc()`.

**Corrección.** `escapeHtml` (`js/sanitize.js`) en los cuatro puntos, conforme al
Principio III de la constitución.

## SEG-5 · Sin longitud mínima de contraseña al crear cuentas

`POST /api/admin/usuarios` no validaba nada: se podía crear una cuenta con la contraseña
`1`. El cambio de contraseña propia sí exigía 6 caracteres — la regla existía, pero solo en
una de las dos vías.

**Corrección.** Una sola función `errorPassword()` usada por ambas rutas, con el mínimo
subido a **8 caracteres**. No afecta a las cuentas existentes (el login no revalida), y las
sembradas por `seed-cuentas.js` ya cumplen.

## SEG-6 · Dependencia con vulnerabilidad conocida

`body-parser < 1.20.6` — denegación de servicio (GHSA-v422-hmwv-36x6), severidad baja.
Resuelto con `npm audit fix`: **0 vulnerabilidades**.

---

## Verificado como correcto

Vale la pena dejar constancia de lo que se revisó y **no** tenía problemas:

- **Sin inyección SQL.** Se revisaron las siete construcciones dinámicas de `WHERE`
  (`actividadDao`, `bloqueHorarioDao`, `kpiDao`): todas concatenan **marcadores `$N`**, con
  los valores siempre en el arreglo de parámetros. En ningún punto se interpola un valor
  del usuario dentro del SQL.
- **Control de acceso real, no cosmético.** **Todas** las rutas `/api/admin/*` exigen
  `requireRole("ADMIN")` en el servidor. Desocultar con DevTools los bloques `.admin-only`
  del HTML no da acceso a nada: es solo presentación.
- **Sin fuga de credenciales.** `password_hash` solo se selecciona en el login, para
  comparar con bcrypt; nunca viaja en una respuesta. La sesión guarda campos explícitos.
- **Sesiones.** Cookies con `httpOnly`, `sameSite=strict` y `secure` en producción;
  revalidación contra la base en cada petición autenticada.
- **Anti-CSRF.** Validación de `Origin`/`Referer` en métodos que mutan, sobre
  `sameSite=strict`. Se salta cuando no hay ninguna de las dos cabeceras (curl), lo cual es
  deliberado: CSRF requiere un navegador, y un navegador siempre las envía.
- **Aviso público de cancelaciones.** La ruta pública devuelve el **centro** responsable,
  nunca el nombre de la persona.

## Pendiente conocido

- **CSP con `script-src 'unsafe-inline'`** (hallazgo S-2 de
  [[REVISION_QA|la revisión QA]]). Quitarlo exige sacar a archivos los 10 bloques de script
  embebidos en 9 páginas. Es viable —no hay atributos `onclick=`— pero es una
  refactorización que toca todas las vistas y debe verificarse página por página en un
  navegador real.
- **Riesgo de producto, no de seguridad:** el campo **motivo** del borrado es texto libre
  **público** que puede escribir cualquier centro, y no habrá administrador moderando. Es
  inherente a la constancia pública que se pidió. Si llegara a ser un problema, la
  alternativa es sustituirlo por opciones predefinidas ("se reprogramó", "se canceló",
  "error al publicar").

---

*Revisión realizada el 2026-08-04 sobre la rama `002-auditoria-robustez`. Complementa a
[[REVISION_QA|la revisión QA]] (robustez y funcionamiento) y a
[[AUDITORIA_ROBUSTEZ|la auditoría de robustez]].*
