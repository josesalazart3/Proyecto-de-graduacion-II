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
- [ ] Leídas las 4 Bitácoras de backend (2A–2D) completas
- [ ] Backend corriendo, Swagger revisado como referencia de contrato real y vigente

### 4.2 Auditoría de discrepancias
- [ ] Cada servicio Angular comparado contra Swagger, discrepancia por discrepancia
- [ ] Listado completo de discrepancias documentado en la Bitácora (más allá de las 7 ya conocidas, si las hay)
- [ ] Discrepancias que requieren cambio de esquema en backend identificadas y presentadas para confirmación **antes** de tocarlas

### 4.3 Resolución — por área
- [ ] Autenticación (login, `/me`, guards)
- [ ] Usuarios
- [ ] Personas (Colaboradores/Visitantes)
- [ ] Zonas de acceso
- [ ] Perfiles de acceso
- [ ] Credenciales QR
- [ ] Escaneo (payload, inferencia de tipo, mapeo de estación→zona)
- [ ] Historial de accesos
- [ ] Notificaciones
- [ ] Auditoría
- [ ] Reportes

### 4.4 Infraestructura
- [ ] Interceptor mock eliminado (o desactivado de forma explícita, no solo ignorado)
- [ ] `environment.apiUrl` apuntando al backend real
- [ ] `nginx.conf` con el proxy `/api/` activo
- [ ] CORS confirmado funcionando desde el frontend real en Docker

### 4.5 Verificación final (obligatoria, manual y real)
- [ ] `docker compose up --build` con los 3 servicios activos, todos `healthy`
- [ ] Recorrido manual completo como Administrador — cada pantalla probada, sin errores de consola
- [ ] Recorrido manual completo como Personal de Seguridad — incluyendo un escaneo real válido y uno inválido
- [ ] Recorrido manual completo como Gerencia/Auditoría
- [ ] Confirmado que los datos creados desde el frontend persisten realmente en PostgreSQL (verificar con una consulta directa al menos una vez)
- [ ] Cero referencias a datos mock/simulados quedan activas en el código de producción

---

## Bitácora de avance

*(Claude Code: agrega aquí una entrada nueva con fecha, el listado completo de discrepancias encontradas (no solo las 7 ya conocidas), cuáles resolviste directamente, cuáles presentaste para confirmación y qué se decidió, y el resultado de la verificación manual por rol.)*
