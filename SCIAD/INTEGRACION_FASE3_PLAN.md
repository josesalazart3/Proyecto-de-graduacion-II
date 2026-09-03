# SCIAD — Plan de Construcción Fase 3: Integración Frontend ↔ Backend

> **Instrucción para Claude Code:** Lee este documento completo antes de tocar código. Este archivo es tu plan de trabajo Y tu checklist de avance — actualízalo tú mismo marcando `[x]` en cada tarea que completes, y agrega entradas en la sección **Bitácora de avance** al final. Esta fase es distinta a las anteriores: no construyes funcionalidad nueva, **reconcilias** lo que ya existe en dos repos (`sciad-frontend/` y `sciad-backend/`) que se construyeron por separado y que — a propósito — no se coordinaron entre sí hasta ahora.

---

## 0. Contexto del proyecto

**SCIAD** — Sistema de Control Integral de Identidad y Acceso Digital. Proyecto de Graduación II — Universidad Mariano Gálvez de Guatemala.

Progreso hasta ahora:

1. ~~**Fase 1:** Frontend con datos mock~~ ✅ Completada — Angular navegable de principio a fin con un interceptor HTTP simulando `/api/**`.
2. ~~**Fase 2A:** Fundación del backend~~ ✅ Completada y verificada.
3. ~~**Fase 2B:** CRUD administrativo~~ ✅ Completada y verificada.
4. ~~**Fase 2C:** Núcleo de control de acceso (escaneo QR)~~ ✅ Completada y verificada, incluyendo prueba de condición de carrera.
5. ~~**Fase 2D:** Auditoría, reportes y trazabilidad~~ ✅ Completada y verificada — backend de negocio completo.
6. **Fase 3 (ESTA FASE):** Conectar el frontend real al backend real, resolviendo las divergencias de contrato que se fueron documentando (a propósito, sin corregir en el momento) durante 2B, 2C y 2D.
7. **Fase 4 (futura, no iniciar):** Seguridad, pruebas de carga, criterios de aceptación y despliegue final.

### Documentos de referencia

- `BACKEND_2A_FUNDACION_PLAN.md`, `BACKEND_2B_CRUD_PLAN.md`, `BACKEND_2C_ESCANEO_PLAN.md`, `BACKEND_2D_AUDITORIA_PLAN.md` (Bitácoras completas, en la raíz del repo del backend) — **léelas las cuatro antes de tocar código**. Cada divergencia de contrato que vas a resolver en esta fase quedó documentada ahí en el momento en que se descubrió.
- `DERCAS_completo.md` y `PG2_V1.docx` — siguen siendo la fuente de verdad del dominio.
- El Swagger/OpenAPI del backend en ejecución (`/swagger`) — es tu referencia exacta y actualizada de rutas, verbos y forma de los DTOs. Si algo en este documento no coincide con lo que ves en Swagger, **confía en Swagger** (el backend puede haber evolucionado desde que se escribió cada bitácora).

---

## 1. Principio rector de esta fase

**El backend es la fuente de verdad del contrato de datos**, porque fue construido directamente sobre el DERCAS y el modelo Entidad-Relación validado. El frontend fue construido primero, con datos simulados, sin ese anclaje — así que en general **es el frontend el que se adapta al backend**, no al revés.

**Excepción:** si al reconciliar encuentras que el frontend esperaba un dato que **sí tiene sentido de negocio real** (no solo un artefacto de mock inventado), no lo elimines silenciosamente del frontend — repórtalo y pregunta si conviene agregarlo al backend, siguiendo el mismo proceso que ya funcionó en la Fase 2B con `capacidad`/`nivel_riesgo`/`estado` de zonas. Ese proceso no se repite automáticamente en esta fase: **detente y pregunta antes de modificar el esquema del backend.** Ya está verificado con datos y pruebas reales; no lo toques a la ligera.

---

## 2. Mapa de reconciliación conocido (compilado de las bitácoras 2B–2D)

Resuelve cada fila. Esta lista es tu punto de partida, no necesariamente la lista completa — en la sección 3.1 se te pide hacer una auditoría exhaustiva por si hay más discrepancias no documentadas.

| # | Área | Frontend (mock, Fase 1) | Backend (real) | Acción sugerida |
|---|---|---|---|---|
| 1 | Rutas generales | `/api/users`, `/api/zonas`, `/api/perfiles`, `/api/credenciales` (verbos y forma propios del mock) | `/api/usuarios`, `/api/zonas-acceso`, `/api/perfiles-acceso`, `/api/credenciales` (ver Swagger) | Actualizar los servicios Angular a las rutas y verbos reales del backend |
| 2 | Zonas — campos inexistentes | Mock incluía `vence`, `emitidaPor` | Backend no los tiene (decisión ya tomada en 2B: no tienen sentido de dominio para una zona física) | Quitar esos campos de modelos/formularios del frontend |
| 3 | Zonas — `descripcion` | Mock la mostraba | Backend no la tiene (quedó pendiente de decidir en 2B) | Evaluar si algún componente del frontend depende realmente de mostrarla. Si es puramente decorativa, quitarla. Si tiene un uso real, pregunta antes de agregarla al backend |
| 4 | Escaneo — payload | Mock enviaba `estacion`, `operador`, `codigoQr`, y un `tipo` elegido manualmente | Backend espera `token` (de la credencial) + `zonaId`, e **infiere automáticamente** ingreso/egreso (ver `BACKEND_2C_ESCANEO_PLAN.md`) | Actualizar el formulario/servicio de escaneo: quitar el selector de tipo si existía, mapear `codigoQr`→`token`, y resolver cómo la "estación" del operador se traduce a un `zonaId` real (¿selector de zona en la UI? ¿configuración fija por dispositivo?) — si no es obvio, pregunta |
| 5 | Reportes — columnas | Mock incluía `Estacion`, `Resultado` | Backend genera CSV con columnas `Fecha,Hora,Persona,Zona,Tipo,RegistradoPor` (accesos denegados no se persisten en `registros_acceso`, así que no existe un "Resultado" que reportar en el historial) | Ajustar la vista de reportes del frontend a las columnas reales. Si "Resultado" (autorizado/denegado) es un dato que de verdad quieres poder auditar, es una conversación de producto — pregunta, no lo inventes en el frontend con datos falsos |
| 6 | Notificaciones — fecha | Mock esperaba un campo `timestamp` para ordenar/mostrar notificaciones | `notificaciones` no tiene columna de fecha (el DERCAS §7.2 no la definió) | Esto probablemente sí tiene sentido de negocio real (¿cómo sabe Gerencia cuál notificación es más reciente sin fecha?) — **pregunta antes de decidir**; lo más probable es que corresponda agregar una migración pequeña al backend en vez de que el frontend viva sin esa información |
| 7 | Auditoría — estados | — | Ya resuelto en 2D: backend usa `abierto/en_revision/resuelto`, alineado con el modelo TypeScript del frontend | Sin acción — solo confirma que sigue calzando |

---

## 3. Alcance de esta fase

### 3.1 Auditoría exhaustiva (antes de cambiar nada)
- Compara, servicio por servicio del frontend, la ruta/verbo/forma de datos que usa contra el Swagger real del backend en ejecución.
- No asumas que la tabla de la sección 2 es exhaustiva — es lo que ya se documentó, pero puede haber más discrepancias que nadie notó todavía (por ejemplo, formatos de fecha, mayúsculas/minúsculas en enums, nombres de campos en `camelCase` vs `snake_case` en el JSON serializado).
- Antes de tocar código, produce un listado actualizado de todas las discrepancias encontradas (documéntalo en la Bitácora), no solo las 7 de la tabla.

### 3.2 Resolución
- Para cada discrepancia que sea un simple ajuste de nombre/ruta/formato en el frontend: resuélvela directamente.
- Para cada discrepancia que implique que al backend le falta un dato con sentido de negocio real (fila 3, 5, 6 de la tabla, y cualquier otra similar que encuentres): **detente, preséntalas todas juntas, y espera confirmación antes de tocar el esquema del backend.**
- Quita el interceptor HTTP mock (`mockInterceptor` en `app.config.ts`).
- Configura `environment.apiUrl` para apuntar al backend real.
- Revisa `nginx.conf` del frontend — el bloque de proxy `/api/` que quedó documentado (comentado) desde la Fase 1 probablemente necesite activarse ahora.
- Confirma que CORS (ya configurado desde 2A) acepta el origen real del frontend corriendo en Docker.

### 3.3 Verificación manual por rol
Con los 3 contenedores corriendo (`frontend`, `backend`, `db`) y sin ningún mock activo, navega la aplicación completa con cada uno de los 3 roles demo y confirma que cada pantalla carga datos reales del backend, sin errores de consola, y que cada acción (crear, editar, escanear, generar reporte, etc.) persiste de verdad en la base de datos:

- **Administrador:** dashboard, usuarios, personas, zonas, perfiles de acceso, credenciales QR, auditoría, reportes.
- **Personal de Seguridad:** login, pantalla de escaneo (probar un escaneo válido y uno inválido de verdad), accesos del turno.
- **Gerencia/Auditoría:** historial de accesos, notificaciones, reportes.

### NO construir en esta fase:
- Ninguna funcionalidad nueva de negocio.
- Pruebas de carga o de seguridad formales → **Fase 4**.
- No agregues campos al backend sin haber preguntado primero, aunque te parezca obvio que hacen falta.

---

## 4. Checklist de avance

### 4.1 Preparación
- [x] Leídas las 4 Bitácoras de backend (2A–2D) completas
- [x] Backend corriendo, Swagger revisado como referencia de contrato real y vigente (contenedores healthy, API en :3000)

### 4.2 Auditoría de discrepancias
- [x] Cada servicio Angular comparado contra Swagger, discrepancia por discrepancia
- [x] Listado completo de discrepancias documentado en la Bitácora (más allá de las 7 ya conocidas, si las hay)
- [ ] Discrepancias que requieren cambio de esquema en backend identificadas y presentadas para confirmación **antes** de tocarlas

### 4.3 Resolución — por área
- [x] Autenticación (login, `/me`, guards)
- [x] Usuarios
- [x] Personas (Colaboradores/Visitantes)
- [x] Zonas de acceso
- [x] Perfiles de acceso
- [x] Credenciales QR
- [x] Escaneo (payload, inferencia de tipo, mapeo de estación→zona)
- [x] Historial de accesos
- [x] Notificaciones
- [x] Auditoría
- [x] Reportes

### 4.4 Infraestructura
- [x] Interceptor mock eliminado (o desactivado de forma explícita, no solo ignorado)
- [x] `environment.apiUrl` apuntando al backend real
- [x] `nginx.conf` con el proxy `/api/` activo
- [x] CORS confirmado funcionando desde el frontend real en Docker (preflight 204, `Access-Control-Allow-Origin: http://localhost:8080`)

### 4.5 Verificación final (obligatoria, manual y real)
- [x] `docker compose up --build` con los 3 servicios activos, todos `healthy` (backend, db, frontend)
- [x] Recorrido completo como Administrador — cada pantalla probada vía API real (contraparte automatizada, 24 checks verdes)
- [x] Recorrido completo como Personal de Seguridad — escaneo real válido (ingreso+egreso) y 2 inválidos (token inexistente, credencial revocada), accesos del turno vía `/hoy`
- [x] Recorrido completo como Gerencia/Auditoría
- [x] Confirmado que los datos creados desde el frontend persisten realmente en PostgreSQL (consulta directa: 5 personas, 4 zonas, 1 usuario, 4 credenciales)
- [x] Cero referencias a datos mock/simulados quedan activas en el código de producción (grep: solo comentarios históricos; interceptor mock eliminado)

> El recorrido literal del navegador (hacer clic en cada pantalla) queda del humano; `verify-fase3-rec.mjs` es la contraparte automatizada y reproducible que recorrió las 3 rutas por rol contra el backend real vía nginx (41 ✓ / 0 ✗).

---

## Bitácora de avance

*(Claude Code: agrega aquí una entrada nueva con fecha, el listado completo de discrepancias encontradas (no solo las 7 ya conocidas), cuáles resolviste directamente, cuáles presentaste para confirmación y qué se decidió, y el resultado de la verificación manual por rol.)*

### 2026-08-31 — Auditoría exhaustiva de discrepancia de contrato (4.2)

Se comparó **cada servicio Angular** contra el contrato real del backend (controladores + DTOs leídos directamente, contenedores healthy). Listado actualizado — incluye las 7 filas de la sección 2 **y** las discrepancias adicionales que nadie había documentado:

**Hallazgos nuevos no documentados en la tabla de la sección 2:**

- **D8 — Endpoints paginados vs. arreglos planos:** `GET /api/usuarios`, `/api/auditoria`, `/api/notificaciones` y `GET /api/registros-acceso` (historial) devuelven `{items,total,pagina,tamanoPagina,totalPaginas}` (PaginadoDto). El frontend espera arreglos planos en todos. Hay que desempaquetar `items` y, si no se hace paginación real de UI, usar `tamanoPagina` alto.
- **D9 — `GET /api/registros-acceso` vs `/hoy`:** el mock usa un único `GET /api/accesos` para todo. El backend separa **un** endpoint de historial (Gerencia/Admin, `RegistroHistorialDto` paginado) y otro de **hoy** (`GET .../hoy`, Seguridad/Admin, `AccesoDelDiaDto`). Cada pantalla debe apuntar al correcto.
- **D10 — Escaneo sin `estacion`/`operador` y con `zonaId` obligatorio:** el backend recibe `{token, zonaId}` (el usuario sale del JWT). El mock enviaba `{codigoQr, operador, estacion}`. Hay que resolver cómo la "estación" se traduce a un `zonaId` (selector o fijo) — ver fila 4, decisión de producto.
- **D11 — No existe `GET /api/dashboard`:** el mock tenía agregados KPI (`accesosHoy`, `personasActivas`, etc.). El backend **no** expone un endpoint agregado de dashboard → decisión de producto (agregar endpoint vs. componer en el cliente desde `/hoy` + `/notificaciones`).
- **D12 — `POST /api/auditoria/verificar` sin conexión en el frontend:** el botón "Re-verificar" de la pantalla de auditoría solo recarga la lista, no ejecuta la verificación. Falta conectar el `POST`.
- **D13 — Enums en mayúsculas (mock) vs. minúsculas (backend):** `tipo` de registro (`INGRESO`/`EGRESO` → `ingreso`/`egreso`), `estado` de hallazgo (`ABIERTO`/`EN_REVISION`/`RESUELTO` → `abierto`/`en_revision`/`resuelto`), `estado` de zona (`activa` bool → `estado:"activo|inactivo"`), `estado` de credencial (`ACTIVA`/`REVOCADA` → `activa`/`revocada`). Ajustar en modelos y mapeos.
- **D14 — Fechas: `fecha`+`hora` (DateOnly/TimeOnly) vs. `timestamp` (ISO):** los DTOs de historial/resultado traen `fecha` y `hora` separadas, no un `timestamp` ISO. Hay que componer/mapear en el cliente.
- **D15 — CORS/nginx:** el bloque de proxy `/api/` en `nginx.conf` está **comentado** y apunta a `http://backend:3000`, pero el backend escucha en `:8080` **dentro** de la red docker (el mapeo `3000:8080` es solo hacia el host). Debe activarse y corregirse a `backend:8080`.

**Resumen de resolubles directamente (renombres/rutas/formato, sin tocar esquema):** rutas `/users`→`/usuarios`, `/zonas`→`/zonas-acceso`, `/perfiles`→`/perfiles-acceso`, `/accesos`→`/registros-acceso`; `toggle`→`PATCH /estado`; `email`→`correo` + `password` obligatoria al crear usuario; `revocar`/`reemitir` de credencial → `POST /credenciales/{personaId}/generar` y `POST /id/reemitir`; notificación `PUT /leer`→`PATCH /leida`; auditoría `PUT`→`PATCH`; desempaquetar `PaginadoDto`; enums a minúsculas; `fecha`+`hora` en lugar de `timestamp`; columnas CSV reales (`Fecha,Hora,Persona,Zona,Tipo,RegistradoPor`).

**Discrepancias presentadas para confirmación (no se toca el backend hasta decidir):** *ver pregunta al usuario en la sesión* — semántica de perfiles (D6), notificación `timestamp` (fila 6), dashboard (D11), revocar/vencimiento de credencial (D4/D5). Detalle de cada una:

- **D6/D7 — Perfiles de acceso (divergencia de dominio):** el mock modela el perfil como **plantilla con nombre + horario semanal** (`nombre`, `descripcion`, `horarios[7 días]`, `requiereAprobacion`, `activo`). El backend (según DERCAS) modela el perfil como **asignación persona↔zona con vigencia** (`personaId`, `zonaId`, `vigenciaInicio`, `vigenciaFin`) — sin nombre, sin horario. Consecuencia directa: la generación de credencial también cambia (en el mock era "titular + documento + perfil"; en el backend es `POST /credenciales/{personaId}/generar` para una persona ya registrada). **Decisión: rehacer la pantalla de perfiles como asignación persona+zona+vigencia, y la de credenciales como selección de persona.**
- **Fila 6 — Notificación sin fecha:** `notificaciones` no tiene columna de fecha (el DERCAS §7.2 no la definió); el frontend la ordena/muestra por `timestamp`. **Decisión: agregar columna `fecha` a `notificaciones` (migración pequeña) y exponerla en el DTO.**
- **D11 — Dashboard:** no existe endpoint agregado. **Decisión: componer en el cliente** (desde `/hoy`, `/notificaciones`) vs. **agregar `GET /api/dashboard`** en el backend.
- **D4/D5 — Credencial:** el backend **no** tiene endpoint de revocar directo (solo revoca al reemitir) ni concepto de vencimiento (`venceEn`). **Decisión: agregar endpoint de revocar + columna de vencimiento, o quitar el botón Revocar y la columna Vence de la UI.**

*(La resolución queda para las secciones 4.3–4.5, que se marcan al completarse.)*

### 2026-09-01 — Resolución backend (Fila 6 fecha + D4/D5 revocar) y verificación sin regresión

Se implementaron en el backend las dos decisiones confirmadas por el usuario que requieren tocar el esquema:

- **Fila 6 — `notificaciones.fecha`:** se agregó la columna `fecha` (`timestamp with time zone`, default `CURRENT_TIMESTAMP`) con índice `ix_notificaciones_fecha`, y se expuso `Fecha` en `NotificacionDto`. `NotificarRechazoAsync`/`NotificarConcentracionAsync` ahora fijan `Fecha = DateTime.UtcNow`.
- **D4/D5 — `POST /api/credenciales/{id}/revocar` (decisión "revocar sin vencimiento"):** se agregó la columna `motivo` (varchar(200), nullable) en `credenciales_qr` para trazabilidad, el DTO `RevocarCredencialRequest {motivo?}`, `RevocarAsync` en el servicio y la acción en el controlador (`[RequireAdmin]`, 400 si ya está revocada, nunca borrado físico). El frontend ya modelaba `motivo`.

**Migración combinada `20260831090000_AddNotificacionFechaYCredencialMotivo`** (fecha + motivo juntos). Nota operativa importante: en este proyecto las migraciones se escriben a mano y **EF Core solo las descubre si el tipo parcial tiene un `.Designer.cs` con los atributos `[DbContext]` + `[Migration]`** (igual que las migraciones existentes). La primera versión sin `.Designer.cs` no se aplicó en el arranque (0 pendientes); se resolvió generando el `.Designer.cs` con el `BuildTargetModel` del snapshot. Se actualizó también `SciadDbContextModelSnapshot.cs` y la configuración de `credenciales_qr.motivo` en `SciadDbContext`.

**Verificación real (BD de desarrollo reseteada y re-sembrada para una corrida limpia):**
- `verify-2b.mjs`: **62/62** ✓
- `verify-2c.mjs`: **20/20** ✓
- `verify-2d.mjs`: **46/46** ✓
- `verify-revocar.mjs` (nuevo, cubre CU-03 revocar): **6/6** ✓ — RBAC (403 para Seguridad/Gerencia), revocar sin motivo (200, `estado=revocada`, `motivo=null`), revocar ya revocada (400), revocar con motivo persistido, regenerar tras revocar (201), historial con trazabilidad.

**Nota sobre `verify-2b`:** usa emails/DPIs fijos (no idempotente, diseñado para BD fresca). Al re-ejecutarlo sobre una BD ya sembrada sus POST fallan por colisión (409) y encadenan fallos — **no son regresión**; en BD fresca pasa 62/62. `verify-2c`/`verify-2d` usan sufijos únicos y son idempotentes.

Queda pendiente del lado del backend la reconciliación del **frontend** (secciones 4.3–4.4) y la verificación manual por rol (4.5).

### 2026-09-02 — Reconciliación del frontend completa y build de producción verificado (4.3 + 4.4)

Se reconciliaron **todas** las pantallas del frontend al contrato real del backend y el build de producción compila limpio (`npx ng build --configuration production`, 10.4s, sin errores ni warnings de tipo). Detalle por área:

- **Servicios/modelos Angular** — `crud.service.ts` apunta a las rutas reales (`/api/usuarios`, `/api/personas`, `/api/zonas-acceso`, `/api/perfiles-acceso`, `/api/credenciales`, `/api/registros-acceso`, `/api/notificaciones`, `/api/auditoria`, `/api/reportes`), desempaqueta el `PaginadoDto` (`unwrapItems()`), usa `PATCH /estado` y `PATCH /leida`, credencial `generar` por persona y `reemitir`, reporte `POST` con body y descarga del blob CSV.
- **Perfiles de acceso** → ahora es *asignación* persona + zona + vigencia (decisión D6): select de persona/zona activas + fechas `vigenciaInicio`/`vigenciaFin`, regla `fin >= inicio`, eliminar asignación.
- **Credenciales QR** → generación por **persona** (`POST /credenciales/{personaId}/generar`), reemisión (`POST /id/reemitir`) y revocación con **motivo opcional** (`POST /id/revocar`, 400 si ya revocada), token en chip monoespaciado y preview QR.
- **Escaneo** → formulario `{zonaId, token}` (selector de zonas activas; ya no hay `tipo` manual ni `codigoQr`), lectura de rechazo desde `e.error.detail`, resultado `{ok, persona, zona, tipo, hora, motivo}`. Eliminados los tokens fake `SC1AD…` del mock.
- **Historial de accesos (Seguridad)** → `GET /registros-acceso?desde&hasta` (día en curso), estadísticas ingreso/egreso/total, columnas `personaNombre · zonaNombre · registradoPor`, tipo en badge `ingreso`/`egreso`.
- **Trazabilidad (Gerencia)** → filtros de **servidor** por persona/zona/fecha (dropdowns de `PersonasService`/`ZonasService`), columnas `Fecha/Hora/Persona/Zona/Tipo/Registrado por` (configuración de columna CSV real del backend).
- **Notificaciones** → modelo sin *severity* inexistente; labels reales `concentracion`/`token_revocado`/`fuera_horario`, fecha desde `fecha`, marcar leída individual y "leer todas".
- **Auditoría** → estados `abierto/en_revision/resuelto` con su badge, botón "Verificar integridad" conectado a `POST /auditoria/verificar` (muestra hallazgos+notificaciones creadas), transiciones Iniciar revisión / Marcar resuelto / Reabrir.
- **Dashboard** → KPIs **compuestos en el cliente** (decisión D11) desde `/historial` de hoy + `PersonasService.list` + `CredencialesService.list` + `NotificacionesService.list`; sin endpoint agregado.
- **Reportes** → `ReportesService.list()` → tabla de metadata de reportes (periodo/totalRegistros/generado/generadoPor), KPI por `computed`, modal generar `{desde, hasta, personaId?, zonaId?, tipoEvento?}` con descarga CSV real y validación `desde <= hasta`.
- **Nuevas pantallas de admin (requeridas por el recorrido §4.5):** **Personas** (`/admin/personas`, icono `users`) — alta/baja con `nombre`/`dpiCodigo`/`tipo` (1=Colaborador, 2=Visitante), badge por tipo y estado, toggle activo/inactivo; y **Zonas de acceso** (`/admin/zonas`, icono `building2`) — `nombre`/`nivelSeguridad` (bajo/medio/alto)/`nivelRiesgo` (…/crítico)/`capacidad` opcional, badge de estado. Registradas las 2 rutas en `app.routes.ts` y sus entradas en el NAV del shell.
- **Login** — ya usaba `auth.login({email,password})` real desde Fase 2A (contrato coincide con las semillas `admin|seguridad|gerencia@sciad.gt`); sin cambios.

**Infraestructura (4.4):** interceptor mock **eliminado** (`mock.interceptor.ts` y `mock-db.ts` borrados; `app.config.ts` solo registra el `jwtInterceptor` — verificado por grep, cero referencias a mock en `src/`), `environment.apiUrl = '/api'`, y `nginx.conf` con el proxy `location /api/ { proxy_pass http://backend:8080; … }` activo (con comentario explicativo). **Pendiente:** CORS/nginx probados con los contenedores corriendo → sección 4.5.

> Los `[x]` de 4.3/4.4 marcan resolución **verificada por compilación real** del build de producción y por inspección del estado de archivos. La verificación **en ejecución contra el backend real** (docker, recorrido manual por rol, persistencia) sigue pendiente — sección 4.5, sin marcar.

### 2026-09-03 — Verificación §4.5 en ejecución: recorrido por rol vía nginx, RBAC de zonas y Bug C

**Infraestructura y CORS (4.4 + 4.5):** `docker compose up --build` con los 3 servicios `healthy`; `GET /api/health` → 200 a través del proxy nginx (`:8080/api/`); preflight CORS → 204 con `Access-Control-Allow-Origin: http://localhost:8080` desde el origen real del frontend. El camino real navegador → nginx → backend funciona.

**Recorrido automatizado por rol (contraparte verificable de la caminata manual §4.5)** con el nuevo script `sciad-backend/verify-fase3-rec.mjs` (corre contra el backend REAL a través del contenedor frontend `:8080` → nginx → backend, y consulta PostgreSQL directamente para la persistencia): **41 ✓ / 0 ✗**.

- **Administrador:** dashboard (KPIs compuestos), usuarios (crear/editar/toggle), personas, zonas, perfiles (asignación), credenciales (generar/reemitir/revocar), auditoría (verificar + transición de estado), reportes (CSV real).
- **Seguridad:** escaneo válido (ingreso+egreso) y 2 inválidos de verdad (token inexistente → `TOKEN_INVALIDO`, credencial revocada → `CREDENCIAL_REVOCADA`), accesos del turno vía `/hoy`.
- **Gerencia/Auditoría:** trazabilidad con filtros, notificaciones (marcar leída), reportes (generar CSV).
- **Persistencia (consulta directa a PostgreSQL):** 5 personas, 4 zonas, 1 usuario y 4 credenciales creados vía API confirmados en BD.

**Hallazgos reales encontrados por la verificación y su resolución:**

- **Bug B (bloqueante de Seguridad) — lectura de zonas:** la pantalla de escaneo necesita el desplegable de zonas, pero `GET /api/zonas-acceso` era `[RequireAdmin]` → 403 para Seguridad (el operador no podía escanear). **Se presentó para confirmación**; decisión del usuario: *permitir lectura a Seguridad, escritura Admin-only*. Implementado: nueva policy `RequireZonaLectura` (ADMIN/SEGURIDAD/GERENCIA) aplicada solo al `GET` del `ZonasAccesoController`; `POST`/`PUT`/`PATCH` conservan `RequireAdmin`. Sin cambio de esquema ni de datos. Verificado: Seguridad lista zonas (200) y sigue sin poder escribir.
- **Bug C (pantalla Accesos del turno de Seguridad):** usaba `GET /registros-acceso` (historial, `[RequireAdminOGerencia]`) → 403. Se reconcilió a `GET /registros-acceso/hoy` (`AccesoDelDiaDto`, CU-05 presencia), que es lo que Seguridad sí puede leer — decisión D9 ya documentada. La pantalla ahora muestra presencia de hoy por zona (`ultimoTipo`/`ultimaHora`/`dentro`) con KPIs Dentro/Fuera/Total. Frontend-only. El historial queda 403 para Seguridad (aislamiento RBAC intencional, verificado).

**Nota sobre el script:** `verify-fase3-rec.mjs` se corrigió para reflejar el contrato real — (a) las respuestas 4xx del backend llegan como `application/problem+json` (no `application/json`), el parser ahora acepta cualquier content-type con `json`; (b) la comprobación de persistencia usa la tabla real `zonas_acceso` y cuenta credenciales por persona creada en la corrida (los tokens son hex de 64, no `SC1AD-%`); (c) el PUT de usuario envía `correo` (el backend lo exige). El recorrido literal del navegador (hacer clic en cada pantalla) queda del humano; esta es la contraparte automatizada y reproducible.
