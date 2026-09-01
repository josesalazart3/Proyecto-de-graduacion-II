# SCIAD — Plan de Construcción Fase 2B: CRUD Administrativo

> **Instrucción para Claude Code:** Lee este documento completo antes de escribir una sola línea de código. Este archivo es tu plan de trabajo Y tu checklist de avance — actualízalo tú mismo marcando `[x]` en cada tarea que completes, y agrega entradas en la sección **Bitácora de avance** al final con fecha y resumen de lo hecho en cada sesión.

---

## 0. Contexto del proyecto

**SCIAD** — Sistema de Control Integral de Identidad y Acceso Digital basado en Credenciales QR Cifradas y Arquitectura Cloud. Proyecto de Graduación II — Universidad Mariano Gálvez de Guatemala.

Progreso hasta ahora:

1. ~~**Fase 1:** Frontend con datos mock~~ ✅ **Completada**.
2. ~~**Fase 2A:** Fundación del backend~~ ✅ **Completada y verificada** — solución .NET 8 en 4 capas, PostgreSQL con migraciones reales, autenticación JWT, RBAC con 3 policies, Docker con los 3 servicios `healthy`. Ver `BACKEND_2A_FUNDACION_PLAN.md` (Bitácora) para el detalle completo de lo ya construido, incluyendo las decisiones de diseño ya tomadas (no las repitas ni las cuestiones).
3. **Fase 2B (ESTA FASE):** CRUD administrativo — usuarios, personas, zonas de acceso, perfiles de acceso, credenciales QR.
4. **Fase 2C (futura, no iniciar):** Núcleo de control de acceso — endpoint de escaneo QR, validaciones, notificaciones.
5. **Fase 2D (futura, no iniciar):** Auditoría, reportes y trazabilidad.
6. **Fase 3 (futura, no iniciar):** Integración real Frontend ↔ Backend.
7. **Fase 4 (futura, no iniciar):** Seguridad, pruebas, criterios de aceptación y despliegue.

**Decisión ya tomada y cerrada (no la reabras):** `personas.tipo` es `INTEGER` (`1 = colaborador`, `2 = visitante`), confirmado por el autor del proyecto. Úsalo así en DTOs, validaciones y en cualquier lugar donde se muestre el tipo de persona.

### Documentos de referencia

Ubicados en: `C:\Users\jsalazar\Documents\GitHub\Proyecto de graduacion II\SCIAD\Documentacion`

- `PG2_V1.docx`, `DERCAS_completo.md` (fuente de verdad para RF/RNF/CA), diagramas.
- **`BACKEND_2A_FUNDACION_PLAN.md`** (en la raíz del repo del backend) — léelo primero. Ahí están documentadas las convenciones ya establecidas (snake_case, ON DELETE RESTRICT, Problem Details, policies RBAC, estructura de capas) y los campos que ya se agregaron sobre el ER original por necesidad del frontend (`roles.codigo`, `usuarios.puesto`, `usuarios.fecha_creacion`). **Sigue esas mismas convenciones — no inventes un estilo nuevo.**
- El repositorio del frontend (`sciad-frontend/`) — sigue siendo tu referencia para la forma exacta de los DTOs. Revisa específicamente los modelos y servicios de: gestión de usuarios, gestión de personas/colaboradores, zonas, perfiles de acceso y credenciales QR.

---

## 1. Alcance exacto de esta fase

### Sí construir en 2B (CU-01, CU-02, CU-03 del DERCAS adaptado):

**Usuarios** (rol Administrador gestiona cuentas del sistema — quienes hacen login: Administrador, Personal de Seguridad, Gerencia/Auditoría)
- Listar (con paginación), crear, editar, **desactivar** (baja lógica — `estado`, nunca DELETE físico, según RNF-06/§7.4 del DERCAS).
- Validación de unicidad de correo (409 si duplicado).

**Personas** (Colaboradores / Visitantes — las personas cuyo acceso físico se controla, distintas de las usuarios del sistema)
- Listar, crear, editar, desactivar.
- Campo `tipo` (`1=colaborador`, `2=visitante`) y `dpi_codigo` único.

**Zonas de acceso**
- Listar, crear, editar. Campo `nivel_seguridad`.

**Perfiles de acceso** (qué persona puede entrar a qué zona y en qué vigencia)
- Asignar zona(s) a una persona con `vigencia_inicio` / `vigencia_fin`.
- Listar perfiles por persona y por zona.
- Validar que `vigencia_fin >= vigencia_inicio` (400 si no).
- Una persona puede tener múltiples zonas asignadas simultáneamente.

**Credenciales QR**
- Generar credencial para una persona activa: token cifrado único (64 caracteres hex — RNF-01, mismo criterio de seguridad ya usado en JWT: aleatoriedad criptográfica real, no `Guid.NewGuid()` concatenado).
- Reemitir: invalida (`revocada`) el token anterior y genera uno nuevo, guardando la referencia `reemitido_de` (trazabilidad — igual que en el ER de referencia).
- No permitir generar credencial para una persona inactiva (400).
- Nunca se elimina físicamente una credencial, solo cambia `estado`.

### NO construir todavía:
- Nada de escaneo QR ni validación de ingreso/egreso → **Fase 2C**.
- Nada de auditoría, reportes, notificaciones → **Fase 2D**.
- No toques el frontend ni cambies el interceptor mock → **Fase 3**.
- No agregues paginación avanzada, búsqueda full-text ni filtros que el frontend no esté ya pidiendo — si tienes duda de si algo hace falta, revisa el frontend antes de construir de más.

---

## 2. Reglas de esta fase (heredadas de 2A — no las repitas de menos)

- Sigue exactamente las convenciones ya establecidas en 2A (capas, `snake_case`, Problem Details RFC 7807, políticas RBAC existentes — reutilízalas, no crees nuevas a menos que un endpoint lo requiera de verdad).
- Todos los endpoints de esta fase requieren rol **Administrador** (`RequireAdmin`), salvo que el DERCAS indique explícitamente otro rol para una operación de consulta puntual.
- Si un campo que necesitas no existe ni en el DERCAS ni en el frontend, decide con criterio senior y anótalo en la Bitácora — igual que se hizo en 2A con `roles.codigo` y `usuarios.puesto`.
- Si encuentras otra inconsistencia real entre el DERCAS, los diagramas o el frontend (como la de `personas.tipo` en 2A), **detente y pregunta** — no la resuelvas tú solo.
- **No marques un checkbox como `[x]` si no lo verificaste ejecutando de verdad** (con `curl`/Postman contra el contenedor corriendo, no solo compilando). Esto ya funcionó bien en 2A — mantenlo.
- Migraciones nuevas (no modifiques la migración `InitialCreate` de 2A) — agrega una migración adicional si necesitas ajustar algo del esquema.

---

## 3. Checklist de avance

### 3.1 Preparación
- [x] Releído `BACKEND_2A_FUNDACION_PLAN.md` (Bitácora) para no romper convenciones ya establecidas
- [x] Revisados en el frontend los modelos/servicios de: usuarios, personas, zonas, perfiles de acceso, credenciales QR

### 3.2 Usuarios (CU-01)
- [x] `GET /api/usuarios` (paginado) — solo Administrador
- [x] `POST /api/usuarios` — validación de correo único (409 si duplicado)
- [x] `PUT /api/usuarios/{id}` — edición
- [x] `PATCH /api/usuarios/{id}/estado` — baja lógica (nunca DELETE físico)

### 3.3 Personas — Colaboradores/Visitantes
- [x] `GET /api/personas` (paginado, filtrable por `tipo` y `estado`)
- [x] `POST /api/personas` — validación de `dpi_codigo` único (409 si duplicado)
- [x] `PUT /api/personas/{id}`
- [x] `PATCH /api/personas/{id}/estado` — baja lógica

### 3.4 Zonas de acceso
- [x] `GET /api/zonas-acceso`
- [x] `POST /api/zonas-acceso`
- [x] `PUT /api/zonas-acceso/{id}`

### 3.5 Perfiles de acceso (CU-02)
- [x] `GET /api/perfiles-acceso?personaId=` y `?zonaId=`
- [x] `POST /api/perfiles-acceso` — asigna zona + vigencia a una persona
- [x] Validación: `vigencia_fin >= vigencia_inicio` (400 si no)
- [x] Validación: zona y persona deben existir y estar activas (404/400)
- [x] `DELETE /api/perfiles-acceso/{id}` — decisión tomada: **DELETE físico** (ver bitácora)

### 3.6 Credenciales QR (CU-03)
- [x] `POST /api/credenciales/{personaId}/generar` — token 64 hex, criptográficamente aleatorio
- [x] Bloqueo: no generar credencial para persona inactiva (400)
- [x] `POST /api/credenciales/{id}/reemitir` — revoca la anterior, crea una nueva con `reemitido_de`
- [x] `GET /api/credenciales?personaId=` — historial de credenciales de una persona (incluye revocadas, para trazabilidad)
- [x] Confirmado: ninguna operación hace DELETE físico sobre `credenciales_qr`

### 3.7 Verificación final (obligatoria)
- [x] `docker compose up --build` corrido de verdad, 3 contenedores `healthy`
- [x] Cada endpoint de este documento probado con `curl`/Postman con al menos: caso exitoso, caso de validación fallida, y caso de rol no autorizado (403)
- [x] Probado el flujo completo de extremo a extremo: crear persona → asignar perfil de acceso a una zona → generar credencial → reemitir credencial → confirmar que la anterior quedó `revocada`
- [x] Swagger actualizado y navegable con los nuevos endpoints

---

## Bitácora de avance

*(Claude Code: agrega aquí una entrada nueva con fecha, resumen de lo construido, decisiones de diseño tomadas, y bugs encontrados/corregidos durante la verificación real — igual de detallado que la entrada de la Fase 2A.)*

### 2026-08-30 — Fase 2B completada y verificada de punta a punta

**Contrato (decisión del autor confirmada):** el frontend de Fase 1 ya llamaba a las rutas mock (`/api/users`, `/api/zonas`, `/api/perfiles`, `/api/credenciales`) con verbos y modelos distintos a este plan. El autor decidió seguir **el contrato del plan 2B / DERCAS** (endpoints por recurso de negocio) y **no** el del mock; el frontend se adaptará en la Fase 3. Esto no tocó nada del frontend ni del interceptor.

**Construido (sin ninguna migración nueva — el esquema de 2A ya cubría todo el checklist)**
- **Usuarios (CU-01):** `GET /api/usuarios` (paginado `?pagina=&tamanoPagina=`), `POST` (correo único → 409, rol por código ADMIN/SEGURIDAD/GERENCIA, contraseña ≥ 8 con bcrypt), `PUT /{id}` (contraseña opcional: solo se re-hashea si se envía), `PATCH /{id}/estado` (baja lógica `activo|inactivo`, nunca DELETE físico).
- **Personas:** `GET /api/personas` (paginado + filtros `tipo` 1/2 y `estado`), `POST` (`dpi_codigo` único → 409, `tipo` validado 1/2), `PUT /{id}`, `PATCH /{id}/estado`.
- **Zonas:** `GET` / `POST` / `PUT /{id}` (solo `nombre` + `nivel_seguridad`, como dicta DERCAS §7.2).
- **Perfiles de acceso (CU-02):** `GET ?personaId=&zonaId=` (filtros combinables), `POST` (valida vigencia fin ≥ inicio → 400, persona/zona existen → 404, persona activa → 400), `DELETE /{id}`.
- **Credenciales QR (CU-03):** `POST /{personaId}/generar` (token 64 hex de CSPRNG `RandomNumberGenerator`, persona activa obligatoria → 400, bloqueo de duplicidad de credencial activa → 409), `POST /{id}/reemitir` (revoca la anterior → `revocada` y crea nueva con `reemitido_de`), `GET ?personaId=` (historial incl. revocadas). Sin DELETE físico en ningún caso.

**Decisiones de diseño (anotadas como pidió el plan 3.5/3.6)**
- **Baja de perfiles_acceso = `DELETE` físico.** `perfiles_acceso` es una tabla de asignación (config, no histórica): no tiene columna `estado` y DERCAS §7.4 solo exige soft-delete en `usuarios/personas/credenciales_qr`. Quitar un acceso es eliminar la asignación; nada la referencia (sin FKs entrantes), así que es seguro.
- `zonas_acceso` **no tiene `estado`** (DERCAS §7.2 la define sin él), así que la validación "zona activa" del plan se reduce a que la zona exista (404). Se anotó porque el plan la mencionaba.
- **Bloqueo de duplicidad de credencial activa (409)** al `generar`: aunque el plan no lo exigía textualmente, dos credenciales activas para una misma persona figuran como inconsistencia de auditoría en el DERCAS; la vía correcta de reemplazo es `reemitir`.
- `credenciales_qr`, `zonas_acceso` y `personas`/`usuarios` conservan exactamente las columnas del ER/diccionario DERCAS. Los campos extra que el mock de Fase 1 mostraba (`vence/emitidaPor/descripcion/capacidad/nivelRiesgo/activa` de zonas) **no** se agregaron: son artefactos de Fase 1 que Fase 3 reconciliará contra este contrato.

**Verificación real (no solo compilación)**
- `docker compose build backend` + `up -d backend` → contenedor `sciad-backend` `healthy`; los 3 contenedores sanos.
- Script `verify-2b.mjs` (Node, contra `localhost:3000`): **51/51 checks verdes** — RBAC (401 sin token, 403 seguridad/gerencia, 200 admin), paginación, 409/400 en todas las validaciones, PATCH de baja/alta lógica, y el flujo E2E completo: crear persona → asignar perfil a zona → generar credencial → reemitir → la anterior quedó `revocada` y hay 2 credenciales en el historial.
- Swagger: 17 paths (los 5 grupos nuevos presentes) y navegable.
- Cuerpo de error consistente: `{ title, status, detail, code, message }` tanto en validación de modelo (400, `code:"VALIDACION"`) como en conflicto (409, `code:"CONFLICT"`); se configuró `InvalidModelStateResponseFactory` global para que también los 400 de `[ApiController]` usen ese shape.

**Notas de entorno**
- Sin SDK .NET local: build dentro de `mcr.microsoft.com/dotnet/sdk:8.0`; la máquina no tiene `jq`, así que la verificación se hizo con `node fetch`.
- Quedan datos de prueba en la BD dev del contenedor (usuario `admin2b@sciad.gt`, 2 personas, 1 zona, perfiles y credenciales) creados por la verificación — inofensivos en el volumen de desarrollo; los credenciales se dejan intencionalmente (históricas, no se borran).

### 2026-08-30 — Adenda a la Fase 2B (corrección post-verificación, NO parte del checklist original)

Entrada nueva que documenta, como corrección posterior a la verificación de 2B, la ampliación del contrato de `zonas_acceso`. La entrada anterior describía `zonas_acceso` sin `estado` y con solo `nombre + nivel_seguridad`; esta adenda la extiende según decisión confirmada del autor, y **no reescribe** el checklist original ni invalida la verificación 62/62: es un cambio de contrato acordado después.

**Decisión del autor:** «Agrega `capacidad` (INTEGER, aforo máximo simultáneo), `nivel_riesgo` (mismo criterio de `nivel_seguridad`, para cruzar con los reportes de auditoría de 2D y sustentar RNF-04) y `estado` (baja lógica, mismo patrón de usuarios/personas). No agregues `vence` (una zona física no vence; la vigencia ya vive en `perfiles_acceso.vigencia_inicio/fin`), ni `emitida_por` (no aplica a una zona; el mock lo copió del contexto de credenciales), ni `descripcion` (solo si aporta valor real a reportes/auditoría).»

**Decisión sobre `descripcion`:** no se agrega. `nombre` + `nivel_riesgo` + `capacidad` cubren la identificación y el aforo que un reporte de auditoría de 2D necesita; no hay un consumidor concreto que exija un texto libre, y no se agrega un campo solo porque estaba en el mock de Fase 1 (mismo criterio que la entrada anterior). Se puede incorporar en Fase 3 si un caso de uso real lo pide.

**Migración nueva `20260830203056_AddZonasAccesoCapacidadRiesgoEstado`** (no se tocó `InitialCreate`):
- `capacidad` int NULL (aforo máximo simultáneo; opcional).
- `nivel_riesgo` varchar(20) NOT NULL default `'MEDIO'`.
- `estado` varchar(20) NOT NULL default `'activo'` + índice `ix_zonas_acceso_estado`.

**Cambios en código**
- `ZonaAcceso.cs`: propiedades `Capacidad`, `NivelRiesgo="MEDIO"`, `Estado="activo"`.
- `SciadDbContext.cs`: configuración EF (longitud, defaults, índice de `estado`).
- DTOs: `ZonaDto` (Id/Nombre/NivelSeguridad/Capacidad/NivelRiesgo/Estado), `CrearZonaRequest` y `ActualizarZonaRequest` con `Capacidad` `[Range(0,1_000_000)]` y `NivelRiesgo` `[Required][StringLength(20)]`.
- `ZonasService`: mapea los 3 campos en `Crear`/`Actualizar`; nuevo `CambiarEstadoAsync` (baja/alta lógica `activo|inactivo`, 400 si el valor es inválido, 404 si la zona no existe).
- `ZonasAccesoController`: nuevo `PATCH /api/zonas-acceso/{id}/estado` (mismo patrón que usuarios/personas).
- `PerfilesAccesoService`: **completada la validación del plan §3.5 "zona activa"** que en 2B quedó reducida a "la zona existe" porque `zonas_acceso` no tenía `estado`. Ahora `POST /api/perfiles-acceso` rechaza (400) asignar una zona inactiva, igual que ya hacía con una persona inactiva.

**Verificación real:** extendido `verify-2b.mjs` con los checks de los campos nuevos (nivelRiesgo/capacidad/estado en POST y PUT, capacidad inválida → 400, PATCH baja/alta, zona inactiva → 400 al crear perfil) y **62/62 verdes** sobre una BD dev recién restablecida (`docker compose down -v` + `up -d --build`, autorizado por el autor) — el script usa emails/DPIs fijos, así que una verificación completa requiere BD limpia; en una BD con datos previos los 409 de duplicidad arruinan la corrida.

**Alcance respetado:** no se tocaron los nombres de ruta (`/usuarios` vs `/users`) ni ningún otro campo de otras entidades — eso sigue siendo trabajo de Fase 3.
