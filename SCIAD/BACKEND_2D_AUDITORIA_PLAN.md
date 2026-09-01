# SCIAD — Plan de Construcción Fase 2D: Auditoría, Reportes y Trazabilidad

> **Instrucción para Claude Code:** Lee este documento completo antes de escribir una sola línea de código. Este archivo es tu plan de trabajo Y tu checklist de avance — actualízalo tú mismo marcando `[x]` en cada tarea que completes, y agrega entradas en la sección **Bitácora de avance** al final con fecha y resumen de lo hecho en cada sesión.

---

## 0. Contexto del proyecto

**SCIAD** — Sistema de Control Integral de Identidad y Acceso Digital basado en Credenciales QR Cifradas y Arquitectura Cloud. Proyecto de Graduación II — Universidad Mariano Gálvez de Guatemala.

Progreso hasta ahora:

1. ~~**Fase 1:** Frontend con datos mock~~ ✅ **Completada**.
2. ~~**Fase 2A:** Fundación del backend~~ ✅ **Completada y verificada**.
3. ~~**Fase 2B:** CRUD administrativo~~ ✅ **Completada y verificada** (usuarios, personas, zonas de acceso — con adenda de `capacidad`/`nivel_riesgo`/`estado` —, perfiles de acceso, credenciales QR).
4. ~~**Fase 2C:** Núcleo de control de acceso~~ ✅ **Completada y verificada** — endpoint de escaneo QR (`POST /api/registros-acceso`), inferencia automática de ingreso/egreso, bloqueo de duplicados verificado bajo condición de carrera real, generación de notificaciones para `token_revocado` y `fuera_horario`. Ver `BACKEND_2C_ESCANEO_PLAN.md` (Bitácora) — léelo primero, ahí quedó documentada la regla de negocio exacta del escaneo y la deuda pendiente de "concentración inusual en zona" que se resuelve en esta fase.
5. **Fase 2D (ESTA FASE):** Auditoría de integridad, reportes, historial de accesos y notificaciones para Gerencia/Auditoría.
6. **Fase 3 (futura, no iniciar):** Integración real Frontend ↔ Backend — reconciliación de contrato acumulada de 2B y 2C (nombres de ruta, campos de zona, forma del payload de escaneo).
7. **Fase 4 (futura, no iniciar):** Seguridad, pruebas de carga, criterios de aceptación y despliegue.

**Con esta fase se completa el backend de negocio.** Después de 2D solo quedan Integración (Fase 3) y Cierre de calidad (Fase 4) — no más features nuevas.

### Documentos de referencia

Ubicados en: `C:\Users\jsalazar\Documents\GitHub\Proyecto de graduacion II\SCIAD\Documentacion`

- `PG2_V1.docx`, `DERCAS_completo.md` — presta especial atención a: CU-06, CU-07, CU-08, CU-09 (la porción de lectura/gestión), RF-06 a RF-09, RNF-06 (integridad, sin DELETE físico), CA-06 a CA-09.
- `BACKEND_2A_FUNDACION_PLAN.md`, `BACKEND_2B_CRUD_PLAN.md`, `BACKEND_2C_ESCANEO_PLAN.md` (Bitácoras completas) — léelas en orden, ahí están todas las convenciones y decisiones ya tomadas que no debes repetir ni cuestionar.
- El repositorio del frontend — revisa las pantallas de Gerencia/Auditoría (portal de trazabilidad, centro de notificaciones, reportes) y la vista de auditoría del Administrador para entender qué payload y qué formato de exportación ya están diseñados ahí.

---

## 1. Alcance exacto de esta fase

### Sí construir en 2D:

**Historial de accesos — `GET /api/registros-acceso`** (CU-06)
- Filtros: persona, zona, rango de fechas, tipo de movimiento (ingreso/egreso). Paginado.
- Roles: Gerencia/Auditoría (solo lectura) y Administrador.
- Este es distinto del `GET /api/registros-acceso/hoy` de la Fase 2C (que solo mira el día actual para el operador de seguridad) — aquí es historial completo multi-fecha.

**Notificaciones — lectura y gestión** (resto de CU-09, la generación ya existe desde 2C)
- `GET /api/notificaciones` — filtrable por `leida`/no leída, por el usuario autenticado (Gerencia ve las suyas).
- `PATCH /api/notificaciones/{id}/leida` — marcar como leída.
- **Disparador pendiente de 2C: "concentración inusual en una zona".** Impleméntalo aquí como parte de la verificación de auditoría (siguiente sección), no reabriendo ni modificando el endpoint de escaneo de 2C — ese código ya está verificado con la prueba de condición de carrera y no quieres arriesgar una regresión ahí. Si detectas concentración inusual, genera tanto un hallazgo de auditoría como una notificación, siguiendo el mismo patrón que ya existe para `token_revocado`/`fuera_horario`.

**Auditoría de integridad de bitácoras — `POST /api/auditoria/verificar` y `GET /api/auditoria`** (CU-08)
- El endpoint de verificación (solo Administrador) ejecuta las comprobaciones que el DERCAS describe y, por cada inconsistencia encontrada, inserta un hallazgo en `auditoria` (`tipo`, `descripcion`, `persona_id` si aplica, `estado='pendiente'`, `fecha`):
  - Ingresos sin egreso correspondiente **de días anteriores** (un ingreso sin egreso del día actual todavía no es una anomalía — la persona puede seguir dentro; solo cuenta si ya pasó el día).
  - Duplicados (como red de seguridad adicional a la restricción `UNIQUE` de 2C — en teoría no deberían existir, pero el propósito de esta verificación es justamente detectar si algo se coló).
  - Campos nulos o inconsistentes en registros históricos.
  - Concentración inusual de accesos en una zona en un período corto (define un umbral razonable si el DERCAS no da uno exacto, y anótalo).
- `GET /api/auditoria` — lista los hallazgos, filtrable por `tipo` y `estado`.
- `PATCH /api/auditoria/{id}/estado` — permitir marcar un hallazgo como `en_revision` o `cerrado` (revisa si el frontend ya espera esto; si no está claro, decide con criterio senior y anótalo).

**Reportes de auditoría — `POST /api/reportes/generar` y `GET /api/reportes`** (CU-07)
- Genera un reporte para un período y filtros dados (persona, zona, tipo de evento), cuenta los registros incluidos, y guarda los metadatos en `reportes` (`periodo`, `total_registros`, `generado`, `usuario_id`).
- Exportación en **CSV** (decisión ya tomada desde la Fase 1 — revisa la Bitácora del frontend, ahí se documentó "CSV en lugar de PDF" porque es más simple y verificable en esta etapa del proyecto; mantén esa misma decisión aquí, no cambies a PDF sin que se te pida).
- `GET /api/reportes` — lista los reportes ya generados (metadatos, no el archivo completo de nuevo).
- Roles: Administrador y Gerencia/Auditoría.

### NO construir todavía:
- No toques el endpoint de escaneo de 2C salvo lo estrictamente necesario para conectar la generación de notificaciones de concentración inusual — y si lo tocas, vuelve a correr la prueba de condición de carrera de 2C para confirmar que sigue pasando.
- No implementes la prueba de carga de 300 escaneos concurrentes (RNF-04) ni las pruebas de seguridad (OWASP, rate limiting) → **Fase 4**.
- No toques el frontend ni el interceptor mock, ni intentes reconciliar los contratos divergentes ya documentados en 2B/2C → **Fase 3**.

---

## 2. Reglas de esta fase (heredadas — no las repitas de menos)

- Sigue las convenciones ya establecidas (capas, `snake_case`, Problem Details, RBAC, sin DELETE físico).
- La tabla `auditoria` y `reportes` tampoco deben tener DELETE físico — son registros de trazabilidad histórica, igual criterio que `credenciales_qr` desde 2B.
- Si vas a tocar código de 2C (por el disparador de concentración inusual), hazlo de forma quirúrgica y vuelve a correr su suite de verificación, no solo la nueva de esta fase.
- Si el DERCAS no da un umbral exacto para "concentración inusual" o un criterio exacto para qué cuenta como "ingreso sin egreso" anómalo, decide un valor razonable, documéntalo en la Bitácora, y hazlo fácil de ajustar (constante de configuración, no un número mágico enterrado en el código).
- **No marques un checkbox como `[x]` si no lo verificaste ejecutando de verdad.**

---

## 3. Checklist de avance

### 3.1 Preparación
- [x] Releídas las Bitácoras de 2A, 2B y 2C
- [x] Revisadas las pantallas de Gerencia/Auditoría y Reportes en el frontend
- [x] Confirmado el criterio de "concentración inusual" y de "ingreso sin egreso anómalo" — documentado antes de implementar

### 3.2 Historial de accesos (CU-06)
- [x] `GET /api/registros-acceso` con filtros (persona, zona, rango de fechas, tipo), paginado
- [x] Roles Gerencia/Auditoría y Administrador; 403 para Personal de Seguridad

### 3.3 Notificaciones (resto de CU-09)
- [x] `GET /api/notificaciones` (filtrable por leída/no leída, por usuario)
- [x] `PATCH /api/notificaciones/{id}/leida`
- [x] Disparador de "concentración inusual en zona" implementado y generando tanto hallazgo de auditoría como notificación
- [x] Si se tocó código de 2C para esto: prueba de condición de carrera de 2C vuelta a correr y sigue pasando

### 3.4 Auditoría de integridad (CU-08)
- [x] `POST /api/auditoria/verificar` (solo Administrador) — ejecuta todas las comprobaciones y persiste hallazgos
- [x] Detecta: ingresos sin egreso de días anteriores, duplicados, campos nulos/inconsistentes, concentración inusual
- [x] `GET /api/auditoria` (filtrable por tipo/estado)
- [x] `PATCH /api/auditoria/{id}/estado`
- [x] Sin DELETE físico en `auditoria`

### 3.5 Reportes (CU-07)
- [x] `POST /api/reportes/generar` (filtros: período, persona, zona, tipo de evento) → CSV + metadatos guardados en `reportes`
- [x] `GET /api/reportes` (listado de reportes ya generados)
- [x] Roles Administrador y Gerencia/Auditoría

### 3.6 Verificación final (obligatoria)
- [x] `docker compose up --build` corrido de verdad, contenedores `healthy`
- [x] Cada endpoint probado con `curl`/Postman: caso exitoso, validación fallida, rol no autorizado (403)
- [x] Flujo E2E: generar datos de prueba con inconsistencias a propósito (ej. un ingreso sin egreso de "ayer", una concentración simulada) → correr `POST /api/auditoria/verificar` → confirmar que los hallazgos aparecen en `GET /api/auditoria`
- [x] Flujo E2E: generar un reporte con `POST /api/reportes/generar` → confirmar que el CSV resultante tiene los datos correctos y que aparece en `GET /api/reportes`
- [x] Confirmado que ninguna operación de esta fase hace DELETE físico sobre `auditoria`, `reportes` ni `notificaciones`
- [x] Si se modificó algo de 2C: su checklist de verificación (incluida la prueba de condición de carrera) vuelto a correr y documentado como sigue pasando
- [x] Swagger actualizado y navegable

---

## Bitácora de avance

*(Claude Code: agrega aquí una entrada nueva con fecha, resumen de lo construido, el criterio exacto que definiste para "concentración inusual" e "ingreso sin egreso anómalo", y el resultado de la verificación real — incluyendo si tocaste 2C y qué confirmaste al respecto.)*

### 2026-08-30 — Fase 2D completada y verificada de punta a punta

**Auditoría, reportes, historial y notificaciones — se completa el backend de negocio.** Verificado de verdad con `verify-2d.mjs` + psql: **46/46 checks verdes**, y la suite de 2C vuelta a correr tras tocar su controlador: **20/20 verdes (sin regresión)**.

**Construido**

- `GET /api/registros-acceso` (historial, CU-06): filtros persona/zona/rango/tipo + paginado, orden por fecha/hora desc. Roles Admin o Gerencia; Personal de Seguridad → **403**.
- `GET /api/notificaciones` + `PATCH /api/notificaciones/{id}/leida` (resto de CU-09). La Gerencia ve **solo sus notificaciones**; el Admin ve todas; solo el destinatario (o Admin) marca como leída.
- `POST /api/auditoria/verificar` (solo Admin), `GET /api/auditoria` (filtros tipo/estado), `PATCH /api/auditoria/{id}/estado` (CU-08). Inserta un hallazgo por inconsistencia y, para concentración, además una notificación a Gerencia.
- `POST /api/reportes/generar` → **CSV** (decisión Fase 1, no PDF) + metadatos en `reportes`; `GET /api/reportes` (CU-07).
- Policy nueva `RequireAdminOGerencia`; `RegistrosAccesoController` ahora autoriza **por acción** (POST + `/hoy` → SeguridadOAdmin; GET historial → AdminOGerencia). Es el único toque a código 2C.

**Criterios de negocio (documentación previa a implementar, como pide el plan 3.1):**

1. **"Ingreso sin egreso" anómalo** = ingreso con `fecha < hoy` para el que NO existe egreso de la misma `persona_id` en la misma `fecha` (independiente de zona). El ingreso de **hoy** sin egreso todavía es normal (la persona puede estar dentro) y no cuenta.
2. **"Concentración inusual"** = **≥ 10 ingresos** en la misma zona dentro de una **ventana rodante de 30 minutos**. El DERCAS no da umbral exacto; se eligió 10/30 min como valor razonable y se dejó en **constantes públicas de configuración** (`AuditoriaService.UmbralConcentracion = 10`, `VentanaConcentracionMinutos = 30`) — fácil de ajustar, no un número mágico.
3. **Estados de los hallazgos: `abierto | en_revision | resuelto`** (nuevos hallazgos nacen `abierto`). El plan sugería `pendiente`/`cerrado`, pero la entidad `Auditoria` y el modelo TS `audit.model.ts` (`HallazgoEstado: ABIERTO/EN_REVISION/RESUELTO`) ya esperan este vocabulario → se decide con criterio senior alinearse a la entidad y al frontend. Se documenta como divergencia permitida por el plan.
4. **CSV**: separador coma con escape RFC 4180; columnas `Fecha,Hora,Persona,Zona,Tipo,RegistradoPor`. El CSV se genera en memoria y se sirve como descarga; en `reportes` solo se guardan metadatos (`periodo`, `total_registros`, `generado`, `usuario_id`) — sin blob, sin DELETE físico.
5. **Divergencias de contrato (para reconciliar en Fase 3):** el mock espera `Estacion`/`Resultado` en el reporte y un `timestamp` en la notificación; el backend sirve el historial real (sin `estacion`) y `notificaciones` **no tiene columna de fecha** (DERCAS §7.2 no la define). No se tocó el frontend.

**Resultados de la verificación real**

- **RBAC:** 403 para Seguridad en historial/notificaciones/auditoría/reportes; 403 para Gerencia en `verificar` y en escaneo/`hoy`; 200 para los roles correctos en cada caso.
- **Historial:** paginado correcto (`totalPaginas == total` con `tamanoPagina=1`), filtros por persona/tipo/zona, `desde>hasta` → 400 y tipo inválido → 400.
- **Notificaciones:** otro gerente no marca una ajena (400), el dueño sí (200), el admin puede marcar cualquiera (200), filtro `?leida=true`, Seguridad 403 en PATCH.
- **Auditoría E2E:** se sembró un **ingreso de "ayer" sin egreso** (persona fresca, insert directo en BD — el API no acepta fechas pasadas) y una **concentración simulada** con **12 escaneos frescos** a la misma zona. `POST /api/auditoria/verificar` → hallazgos por tipo `{acceso_sin_egreso:1, concentracion:1, registro_duplicado:3}` + **1 notificación de concentración**. El hallazgo apareció en `GET /api/auditoria?tipo=...` (filtros, estado `abierto`), PATCH a `en_revision`/`resuelto` 200 y estado inválido (`cerrado`) → 400.
- **Detalle importante sobre los `registro_duplicado: 3`:** no son un bug de 2C. Son residuo real de las pruebas de condición de carrera de 2C: la persona F recibe varias decenas de escaneos concurrentes; la UNIQUE permite **un solo ingreso**, y los perdedores que releen después lo infieren como **egreso** → quedaron 9 egresos para un solo ingreso de esa persona. Esto **demuestra que la detección de duplicados funciona** (red de seguridad adicional, como pedía el plan): detectó una anomalía genuina de integridad. La restricción de un solo ingreso por persona/día sigue intacta (verificado: 0 dobles ingresos hoy).
- **Reportes E2E:** CSV con encabezados y la fila esperada; filtrados por persona → `total_registros` coincide con las filas (`=2`); `desde>hasta` y `tipoEvento` inválido → 400; Gerencia y Admin pueden generar; `GET /api/reportes` lista los metadatos (`generadoPor`, `periodo`, `total_registros`).
- **Sin DELETE físico:** ninguno de los endpoints nuevos (auditoría/reportes/notificaciones/historial) define verbos DELETE; todas las escrituras son lectura/actualización. (El único `HttpDelete` del backend es de 2B, en perfiles — fuera del alcance de esta fase.)
- **2C re-corrida** (el plan pedía volver a correrla si se toca 2C): el controller solo cambió de authorize-de-clase a por-acción; **20/20 verdes**, incluida la condición de carrera (carrera con 20 escaneos → 1 ingreso + 1 egreso, 18 × 409, 0 × 5xx).
- **Swagger:** los 5 paths nuevos visibles y navegables (`/api/registros-acceso` GET, `/api/notificaciones` + `/leida`, `/api/auditoria` + `/verificar` + `/{id}/estado`, `/api/reportes` + `/generar`).

**Notas de entorno**

- Sin SDK .NET local: build/publish dentro del SDK container (`docker compose build backend`); migración se aplica sola al arranque. **No se necesitó migración nueva** (las tablas `auditoria`/`reportes`/`notificaciones` y sus índices existen desde 2A).
- Verificación repetible (sufijos únicos por corrida; inserciones de "ayer" y concentraciones siembran datos acumulativos inofensivos en dev).
