# SCIAD — Plan de Construcción Fase 2A: Fundación del Backend

> **Instrucción para Claude Code:** Lee este documento completo antes de escribir una sola línea de código. Este archivo es tu plan de trabajo Y tu checklist de avance — actualízalo tú mismo marcando `[x]` en cada tarea que completes, y agrega entradas en la sección **Bitácora de avance** al final con fecha y resumen de lo hecho en cada sesión. Si en una sesión futura retomas este proyecto, relee este archivo primero para saber exactamente dónde quedaste.

---

## 0. Contexto del proyecto

**SCIAD** — Sistema de Control Integral de Identidad y Acceso Digital basado en Credenciales QR Cifradas y Arquitectura Cloud, para la optimización de la seguridad y trazabilidad del acceso físico en organizaciones de la Zona 1 de la Ciudad de Guatemala. Proyecto de Graduación II — Universidad Mariano Gálvez de Guatemala.

El proyecto completo se construye en **fases**. Esta es la primera del backend:

1. ~~**Fase 1:** Frontend con datos mock~~ ✅ **Completada** — Angular + Docker, navegable de principio a fin.
2. **Fase 2A (ESTA FASE):** Fundación del backend — proyecto, base de datos, autenticación, Docker.
3. **Fase 2B (futura, no iniciar):** CRUD administrativo (usuarios, personas, zonas, perfiles, credenciales QR).
4. **Fase 2C (futura, no iniciar):** Núcleo de control de acceso — endpoint de escaneo QR, validaciones, notificaciones.
5. **Fase 2D (futura, no iniciar):** Auditoría, reportes y trazabilidad.
6. **Fase 3 (futura, no iniciar):** Integración real Frontend ↔ Backend.
7. **Fase 4 (futura, no iniciar):** Seguridad, pruebas, criterios de aceptación y despliegue.

**No construyas nada de las fases futuras en esta sesión.** El objetivo de la Fase 2A es exclusivamente: proyecto backend funcionando, conectado a PostgreSQL real, con autenticación y RBAC operativos, corriendo en Docker junto al frontend — **sin ningún endpoint de negocio todavía** (nada de usuarios, credenciales, escaneo, reportes). Eso es 2B, 2C y 2D.

### Documentos de referencia (léelos antes de empezar)

Ubicados en: `C:\Users\jsalazar\Documents\GitHub\Proyecto de graduacion II\SCIAD\Documentacion`

- `PG2_V1.docx` — Tesis: planteamiento, objetivos, hipótesis, variables, RF/RNF.
- `DERCAS_completo.md` — Especificaciones, requerimientos y criterios de aceptación. **Fuente de verdad para RF/RNF y CA.**
- Diagramas (casos de uso, arquitectura, modelo conceptual, modelo entidad-relación, secuencia, despliegue).

**Además, y esto es específico de esta fase:** abre el repositorio del frontend ya construido (`sciad-frontend/`) y revisa:
- `src/app/core/models/` — los modelos TypeScript ya definidos (`Usuario`, `Credencial`, `PerfilAcceso`, `RegistroAcceso`, etc.)
- `src/app/core/data/mock-db.ts` y el interceptor mock — la forma exacta de los datos que el frontend ya espera recibir de `/api/**`
- `README.md` del frontend — rutas, roles y credenciales demo

**Tu esquema de base de datos y tus DTOs deben ser compatibles con esos modelos sin obligar a renombrar nada en el frontend.** Si encuentras un campo que no calza (nombre, tipo, formato de fecha), anótalo en la Bitácora y decide el nombre definitivo tomando como preferencia el que ya usa el frontend, salvo que tenga un error de dominio claro — en ese caso, detente y pregunta.

---

## 1. Alcance exacto de esta fase

### Sí construir en 2A:
- Estructura del proyecto backend (solución .NET, capas).
- Conexión real a PostgreSQL con migraciones (Entity Framework Core) que reflejen el modelo Entidad-Relación de referencia (`roles`, `usuarios`, `personas`, `zonas_acceso`, `perfiles_acceso`, `credenciales_qr`, `registros_acceso`, `reportes`, `auditoria`, `notificaciones`).
- Autenticación JWT real (login, emisión y validación de token).
- Middleware/políticas de autorización por rol (RBAC) para los 3 roles: Administrador, Personal de Seguridad, Gerencia/Auditoría.
- Endpoint `GET /api/health` (verificación de que la API y la base de datos responden).
- Endpoint `POST /api/auth/login` y `GET /api/auth/me` — únicamente autenticación, ningún otro dominio.
- Seed de datos: los mismos 3 usuarios demo que ya usa el frontend (`admin`, `seguridad`, `gerencia`, contraseña `sciad123`), para que el login funcione igual que con el mock en cuanto se conecten.
- Docker: descomentar y activar los servicios `backend` y `db` que ya quedaron documentados (comentados) en el `docker-compose.yml` del frontend.
- CORS configurado para aceptar el origen del frontend.
- Documentación OpenAPI/Swagger de lo que exista hasta este punto.

### NO construir todavía (va en fases posteriores):
- CRUD de usuarios, personas, zonas, perfiles de acceso, credenciales QR → **Fase 2B**
- Endpoint de escaneo QR y su lógica de validación → **Fase 2C**
- Auditoría, reportes, notificaciones, trazabilidad → **Fase 2D**
- Cambiar nada del frontend para que apunte al backend real → **Fase 3**

Si en algún momento sientes la tentación de "ya que estoy aquí, agrego el CRUD de usuarios" — no lo hagas. Cada fase se revisa y se cierra por separado a propósito.

---

## 2. Stack técnico (decisiones ya tomadas — no las cuestiones)

- **Lenguaje/Framework:** C# con ASP.NET Core Web API (LTS más reciente disponible).
- **Arquitectura:** capas claras (API / Application / Domain / Infrastructure) — nivel de separación razonable para un proyecto de graduación, sin sobre-ingeniería. No implementes CQRS ni un bus de eventos; es innecesario en este alcance.
- **ORM:** Entity Framework Core, con migraciones versionadas en el repositorio (no `EnsureCreated`, deben ser migraciones reales aplicables en producción).
- **Base de datos:** PostgreSQL 16, corriendo como servicio Docker (`db`) con volumen persistente.
- **Autenticación:** JWT (expiración razonable, ej. 8h, ver RNF del DERCAS si especifica algo distinto). Contraseñas con hash (BCrypt o el estándar de .NET, `PasswordHasher`).
- **Documentación de API:** Swagger/OpenAPI habilitado en entorno de desarrollo.
- **Docker:** el `docker-compose.yml` ya existe (creado en Fase 1) con el servicio `frontend` activo y `backend`/`db` comentados — actívalos ahí mismo, no crees un archivo paralelo.

**Antes de escribir la primera línea de código, ejecuta el skill especializado de backend:**

```bash
npx claude-code-templates@latest --skill development/senior-backend
```

Úsalo para guiar las decisiones de estructura de proyecto, manejo de errores, validación de entrada, logging y convenciones de nomenclatura — el estándar esperado es de backend senior en producción, no un CRUD de tutorial: manejo consistente de errores HTTP (problem details), logging estructurado, configuración por variables de entorno (nunca secretos hardcodeados), y separación clara de responsabilidades por capa.

---

## 3. Requerimientos no funcionales relevantes para esta fase

Del DERCAS/PG2_V1, los que aplican específicamente a la fundación (los de negocio como "escaneo < 2s" se validan en fases posteriores):

- **Seguridad:** JWT firmado con secreto fuera del código fuente (variable de entorno, fail-fast si falta — igual que ya se documentó en el README del prototipo anterior). Contraseñas nunca en texto plano ni en logs.
- **Disponibilidad:** el contenedor `backend` debe tener healthcheck real (no solo "el proceso está vivo" — que además confirme conexión a la base de datos).
- **Integridad:** las migraciones deben crear las restricciones de integridad referencial (`FOREIGN KEY`, `UNIQUE`, `NOT NULL`) tal como están en el modelo Entidad-Relación de referencia — no las dejes para después.

---

## 4. Checklist de avance

Marca cada casilla al completarla. No pases a la Fase 2B hasta que todo esto esté en `[x]` **y verificado con el comando real, no solo con validación de sintaxis** (esto se saltó parcialmente en la Fase 1 — no lo repitas).

### 4.1 Investigación previa
- [x] Leídos `DERCAS_completo.md`, `PG2_V1.docx` y diagramas de referencia
- [x] Revisado el código del frontend (`models/`, `mock-db.ts`, interceptor) y extraída la forma exacta de los datos esperados
- [x] Ejecutado el skill `development/senior-backend` y aplicadas sus recomendaciones de estructura

### 4.2 Estructura del proyecto
- [x] Solución .NET creada con separación por capas (API / Application / Domain / Infrastructure)
- [x] Convenciones de nombres y estructura de carpetas documentadas brevemente en un `README.md` del backend

### 4.3 Base de datos
- [x] Entidades del dominio modeladas en EF Core según el modelo Entidad-Relación de referencia
- [x] Migraciones generadas y aplicables (`dotnet ef database update` funciona de verdad, verificado contra un Postgres real, no solo compilado)
- [x] Restricciones de integridad referencial (FK, UNIQUE, NOT NULL) presentes en las migraciones
- [x] Seed de datos: roles base + 3 usuarios demo (mismas credenciales que el frontend)

### 4.4 Autenticación y autorización
- [x] `POST /api/auth/login` — recibe credenciales, devuelve JWT + datos del usuario
- [x] `GET /api/auth/me` — devuelve el usuario autenticado a partir del token
- [x] Middleware de autorización por rol (policies) probado con los 3 roles
- [x] Manejo de credenciales inválidas y token expirado con respuestas HTTP correctas (401/403, con cuerpo de error consistente)

### 4.5 Infraestructura y Docker
- [x] `GET /api/health` responde verificando también la conexión a la base de datos
- [x] CORS habilitado para el origen del frontend
- [x] Variables de entorno documentadas (`.env.example`) — nada de secretos hardcodeados
- [x] Servicios `backend` y `db` activados en `docker-compose.yml`, con healthchecks
- [x] Swagger/OpenAPI accesible en entorno de desarrollo

### 4.6 Verificación final (obligatoria, no te la saltes)
- [x] Ejecutado realmente `docker compose up --build` de punta a punta (frontend + backend + db) y confirmado que los 3 contenedores quedan sanos (`healthy`)
- [x] Probado `POST /api/auth/login` con los 3 usuarios demo desde fuera del contenedor (curl/Postman) y confirmado que el JWT se emite correctamente
- [x] Probado que un token inválido/ausente es rechazado por una ruta protegida de prueba
- [x] Si algo de esto no se pudo verificar en este entorno por una limitación técnica (como pasó con Docker en la Fase 1), decirlo explícitamente en la Bitácora — **no marcar el checkbox como completado si no se verificó de verdad**

---

## 5. Reglas de trabajo para Claude Code

- Actualiza este archivo marcando checkboxes conforme avances, en la misma sesión en que completes cada tarea.
- **No marques un checkbox como `[x]` si solo validaste la sintaxis o la compilación — debe estar efectivamente ejecutado y probado.** Esta regla existe porque en la Fase 1 el Docker quedó marcado como listo sin haberse corrido realmente.
- Si un campo, tipo de dato o nombre de endpoint que necesitas no está definido ni en el DERCAS ni en el frontend ya construido, decide con criterio de backend senior y anótalo en la Bitácora.
- Si encuentras una incompatibilidad real entre lo que el frontend espera y lo que el modelo de datos de referencia permite, detente y pregunta antes de decidir por tu cuenta.
- No implementes ningún endpoint de negocio (usuarios, credenciales, escaneo, reportes) — eso corresponde a fases posteriores.
- Commits pequeños y descriptivos conforme avances.

---

## Bitácora de avance

> Formato: `### AAAA-MM-DD — resumen corto`, seguido de una lista breve de lo hecho y cualquier decisión de diseño tomada.

*(Claude Code: agrega aquí una entrada nueva cada vez que trabajes en este proyecto)*

### 2026-08-30 — Fase 2A completada y verificada de punta a punta

**Construido**
- Solución .NET 8 en 4 capas (`Sciad.sln` + `Domain` / `Application` / `Infrastructure` / `Api`).
- Modelo Entidad-Relación completo en EF Core: 10 tablas (roles, usuarios, personas, zonas_acceso, perfiles_acceso, credenciales_qr, registros_acceso, reportes, auditoria, notificaciones), `snake_case` vía `EFCore.NamingConventions`, 12 FK con `ON DELETE RESTRICT` (§7.4), CHECK en `registros_acceso.tipo`, índice parcial único `uq_ingreso_diario`, y un campo `credenciales_qr.token CHAR(64)`.
- Migración versionada `20260830135238_InitialCreate` (EF Core 8.0.10), aplicada y **verificada contra el Postgres real** vía `psql` (tablas, 12 FK `RESTRICT`, fila en `__EFMigrationsHistory`).
- Autenticación JWT HS256 (issuer/audience `sciad`, expiración 8h), responde con RFC 7807 Problem Details (`code` + `message` para compatir con el error `{message}` del mock). 
- RBAC con 3 policies (`RequireAdmin` / `RequireSeguridad` / `RequireGerencia`).
- Endpoints: `POST /api/auth/login`, `GET /api/auth/me`, `GET /api/auth/role-check` (prueba de política), `GET /api/health` (verifica `CanConnectAsync`).
- `docker-compose.yml` con 3 servicios, healthchecks reales en los 3; Dockerfile multi-etapa; CORS; Serilog JSON; Swagger (dev).
- Seed idempotente: 3 roles + 3 usuarios demo (`admin@sciad.gt`, `seguridad@sciad.gt`, `gerencia@sciad.gt`, pass `sciad123`, BCrypt cost 10).

**Decisiones de diseño (campo "no calzan" → sancionado en la Bitácora)**
- `personas.tipo`: el diccionario DERCAS §7.2 dice `INTEGER (1=colaborador, 2=visitante)`, pero el diagrama ER `04_Modelo_Entidad_Relacion.png` lo muestra `VARCHAR(20)`. Se tomó **INTEGER** por ser el diccionario de datos la fuente de verdad textual; la inconsistencia queda anotada.
- Sobre `roles` se agregó la columna **`codigo`** (`ADMIN`/`SEGURIDAD`/`GERENCIA`): el frontend modela el rol del usuario como esos códigos y no como un `id` ni un nombre largo.
- Sobre `usuarios` se agregaron **`puesto`** y **`fecha_creacion`**: ambos los expone el frontend (`Usuario.puesto`, `Usuario.fechaCreacion`) y no estaban en el ER de referencia.
- Login por **correo electrónico** (no por nombre de usuario) porque el formulario del frontend envía `{ email, password }` (modelo `CredencialesLogin`).
- `UsuarioDto.id` se serializa como **string** (el frontend lo trata como string); `avatarInitials` se deriva del nombre.

**Verificación real (no solo compilación)**
- `docker compose up --build` completo: **3/3 contenedores `healthy`**.
- `curl` desde el host: 19/19 checks verdes — login de los 3 usuarios (200 + JWT), `me` con token válido (200), token ausente/inválido rechazado (401), password incorrecto (401), `RequireAdmin` con admin (200) y con seguridad/gerencia (403), `health` (200, `"database":"up"`), Swagger JSON+UI (200), preflight CORS desde el origen del frontend (204) y sin `Access-Control-Allow-Origin` desde un origen ajeno.

**Bugs encontrados y corregidos durante la verificación**
1. `DbSeeder`: estallaba con `Sequence contains no elements` en el arranque — los roles recién agregados (estado `Added` en el tracker de EF) no se encontraban con `SingleAsync()` porque la consulta va contra la BD antes de que existan. **Fix:** `SaveChangesAsync()` entre el sembrado de roles y el de usuarios.
2. Healthcheck del backend fallaba: la imagen `aspnet:8.0` **no trae `curl`** por defecto. **Fix:** instalarlo en el Dockerfile (etapa runtime).
3. Healthcheck del frontend fallaba con "Connection refused" aunque nginx respondiera 200 desde el host: `localhost` resuelve a `::1` (IPv6) dentro del contenedor y nginx escucha solo en IPv4. **Fix:** usar `127.0.0.1` en los healthchecks (compose y Dockerfile).
4. `OnForbidden` devolvía 403 sin las extensiones `code`/`message` que sí traía el 401 (inconsistencia del cuerpo de error). **Fix:** alinear con `OnChallenge` y el patrón de `ApiProblem`. De paso se corrigió un `HandleResponse()` inválido en `ForbiddenContext` (ese método solo existe en el contexto del desafío), que rompía compilar.

**Entorno**
- La máquina no tiene SDK .NET local: todos los comandos `dotnet` (restore, publish, `dotnet ef`) se ejecutaron dentro de `mcr.microsoft.com/dotnet/sdk:8.0`; las migraciones se generaron con `dotnet ef migrations add` en ese contenedor.
- `PG2_V1.docx` (tesis 6MB) se extrajo con `pandoc` y se revisó (estructura/alcance del capítulo IV, RF/RNF); el DERCAS sigue siendo la fuente de verdad para el diseño.
