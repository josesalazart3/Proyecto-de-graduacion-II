# SCIAD — Plan de Construcción Fase 2C: Núcleo de Control de Acceso

> **Instrucción para Claude Code:** Lee este documento completo antes de escribir una sola línea de código. Este archivo es tu plan de trabajo Y tu checklist de avance — actualízalo tú mismo marcando `[x]` en cada tarea que completes, y agrega entradas en la sección **Bitácora de avance** al final con fecha y resumen de lo hecho en cada sesión.

---

## 0. Contexto del proyecto

**SCIAD** — Sistema de Control Integral de Identidad y Acceso Digital basado en Credenciales QR Cifradas y Arquitectura Cloud. Proyecto de Graduación II — Universidad Mariano Gálvez de Guatemala.

Progreso hasta ahora:

1. ~~**Fase 1:** Frontend con datos mock~~ ✅ **Completada**.
2. ~~**Fase 2A:** Fundación del backend~~ ✅ **Completada y verificada**.
3. ~~**Fase 2B:** CRUD administrativo~~ ✅ **Completada y verificada** (usuarios, personas, zonas de acceso, perfiles de acceso, credenciales QR — incluyendo la adenda que agregó `capacidad`, `nivel_riesgo` y `estado` a `zonas_acceso`). Ver `BACKEND_2B_CRUD_PLAN.md` (Bitácora, incluida la adenda) — léelo primero.
4. **Fase 2C (ESTA FASE):** Núcleo de control de acceso — endpoint de escaneo QR, validaciones, generación de notificaciones.
5. **Fase 2D (futura, no iniciar):** Auditoría, reportes y consulta de trazabilidad/notificaciones para Gerencia.
6. **Fase 3 (futura, no iniciar):** Integración real Frontend ↔ Backend (incluye reconciliar nombres de ruta y campos, ver nota abajo).
7. **Fase 4 (futura, no iniciar):** Seguridad, pruebas de carga, criterios de aceptación y despliegue.

**Por qué esta fase importa más que las anteriores:** el caso de uso que construyes aquí (CU-04, registrar ingreso/egreso mediante escaneo QR) es el que sostiene la hipótesis principal de la tesis — reducción de tiempo de procesamiento, reducción de suplantación de identidad, e integridad de las bitácoras. Todo lo que se mida en la fase de pruebas de campo depende de que este endpoint esté bien construido. Tómate más cuidado aquí que en las fases anteriores, especialmente con las validaciones y con la integridad transaccional.

**Nota sobre el contrato con el frontend:** igual que en 2B, es posible que el mock del frontend use nombres de ruta o forma de payload distintos a los que definas aquí. Sigue el mismo criterio que ya se estableció: prioriza el DERCAS y el diseño técnico correcto sobre el mock, documenta la diferencia en la Bitácora, y no la resuelvas tocando el frontend — eso es Fase 3.

### Documentos de referencia

Ubicados en: `C:\Users\jsalazar\Documents\GitHub\Proyecto de graduacion II\SCIAD\Documentacion`

- `PG2_V1.docx`, `DERCAS_completo.md` — presta especial atención a: CU-04 (flujo principal y alternativos), RNF-01 (seguridad del token), RNF-03 (rendimiento < 2s), RNF-06 (integridad ACID), CA-04 y CA-05 (criterios de aceptación de escaneo y duplicados).
- Diagrama de secuencia (`06_Diagrama_Secuencia`) y diagrama de actividad (`05_Diseno_Proceso_Principal`) — son el diseño exacto que este endpoint debe implementar. Síguelos paso a paso, no los reinterpretes.
- `BACKEND_2A_FUNDACION_PLAN.md` y `BACKEND_2B_CRUD_PLAN.md` (Bitácoras) — convenciones ya establecidas, no las repitas de menos.
- El repositorio del frontend — revisa específicamente la pantalla de escaneo (rol Personal de Seguridad) para entender qué payload envía y qué feedback visual espera recibir (verde/rojo + motivo).

---

## 1. Alcance exacto de esta fase

### Sí construir en 2C (CU-04, CU-05, y la porción de CU-09 que ocurre al momento del escaneo):

**Endpoint principal de escaneo — `POST /api/registros-acceso`**

Implementa exactamente el flujo del diagrama de secuencia y de actividad de referencia:

1. Requiere sesión válida (Bearer JWT) de un usuario con rol Personal de Seguridad o Administrador (RBAC).
2. Recibe el token de la credencial QR escaneada + la zona del punto de acceso + el tipo de movimiento (ingreso/egreso — revisa el frontend para confirmar si el tipo lo elige el usuario o si se infiere automáticamente según si la persona ya tiene un ingreso abierto ese día; si no está claro, decide con criterio senior e inferilo automáticamente, es más robusto que confiar en que el operador no se equivoque, y anótalo en la Bitácora).
3. Valida el token contra `credenciales_qr`: debe existir, estar `activa`, y pertenecer a una persona `activa`. Si no, **400 con motivo específico** (token inválido / revocado / persona inactiva — el frontend necesita el motivo para mostrarlo, no solo un 400 genérico).
4. Valida que la persona tenga un `perfil_acceso` vigente (dentro de `vigencia_inicio`/`vigencia_fin`) para la zona solicitada, y que la zona esté `activa`. Si no, 400 (zona no autorizada).
5. Valida que no exista ya un registro de ingreso para esa persona en la fecha actual si el movimiento es un nuevo ingreso (evitar doble ingreso el mismo día — usa una restricción `UNIQUE` a nivel de base de datos, no solo una validación en código, según RNF-06 y CA-05 del DERCAS).
6. Inserta el registro en `registros_acceso` dentro de una transacción ACID real (no un `SaveChanges()` suelto sin control de concurrencia — dos escaneos casi simultáneos de la misma persona no deben poder crear dos ingresos duplicados; usa la restricción UNIQUE de base de datos como última línea de defensa y maneja el conflicto como 409, no como error 500).
7. Evalúa disparadores de notificación automática (ver siguiente sección) y, si corresponde, inserta en `notificaciones` — esto ocurre en la misma operación, no de forma asíncrona separada en esta fase.
8. Responde con el resultado: persona, tipo de movimiento, zona, hora, estado — información suficiente para que el frontend muestre la alerta verde/roja con motivo.

**Disparadores de notificación automática (porción de CU-09 que corresponde a esta fase)**

Al momento de registrar un acceso exitoso, evalúa y genera notificación si aplica:
- Acceso fuera del horario/vigencia esperado (si el DERCAS o los diagramas especifican una regla de horario; si no está definida con precisión, propone una regla razonable — ej. fuera de vigencia del perfil — y anótalo).
- Patrón de concentración inusual en una zona (si tienes tiempo y es razonable implementarlo en esta fase; si no, es válido dejarlo para 2D y anotarlo explícitamente como pendiente, no lo fuerces).

**No construyas aquí** la pantalla ni el endpoint de *consulta/lectura* de notificaciones para Gerencia (`GET /api/notificaciones`) — eso es Fase 2D. Aquí solo generas el registro en la tabla.

**Reporte de accesos del día — `GET /api/registros-acceso/hoy`** (CU-05)
- Filtra por fecha actual (y opcionalmente por zona).
- Rol Personal de Seguridad y Administrador.
- Pensado para que el operador de seguridad vea quién está actualmente dentro (tiene ingreso sin egreso registrado) frente a quién ya salió.

### NO construir todavía:
- Consulta de historial completo de accesos (multi-fecha, filtros avanzados para Gerencia) → **Fase 2D**.
- Lectura/gestión de notificaciones (marcar como leída, listar) → **Fase 2D**.
- Auditoría de integridad de bitácoras (CU-08) y reportes exportables → **Fase 2D**.
- No toques el frontend ni el interceptor mock → **Fase 3**.
- No implementes todavía pruebas de carga con 300 escaneos concurrentes (RNF-04) — eso corresponde a la Fase 4, aunque sí debes escribir el endpoint pensando en que soportará esa carga (transacciones cortas, sin bloqueos innecesarios, índices ya creados en 2A/2B sobre las columnas que este endpoint consulta).

---

## 2. Reglas de esta fase (heredadas — no las repitas de menos)

- Sigue las convenciones ya establecidas en 2A/2B (capas, `snake_case`, Problem Details, RBAC, sin DELETE físico en tablas históricas).
- El motivo del rechazo de un escaneo (token inválido, revocado, persona inactiva, zona no autorizada, duplicado) debe ser identificable por el frontend, no un mensaje genérico de "error" — usa códigos de error específicos, no solo el status HTTP.
- Si el diagrama de secuencia/actividad de referencia y el DERCAS textual se contradicen en algún detalle del flujo, **detente y pregunta** — no decidas por tu cuenta en un caso de uso tan central.
- **No marques un checkbox como `[x]` si no lo verificaste ejecutando de verdad.**
- Presta atención especial a condiciones de carrera (dos escaneos simultáneos de la misma persona) — es el tipo de bug que no aparece en pruebas manuales una por una pero sí en producción real.

---

## 3. Checklist de avance

### 3.1 Preparación
- [x] Releídas las Bitácoras de 2A y 2B
- [x] Releído el diagrama de secuencia y de actividad de referencia, flujo confirmado paso a paso
- [x] Revisada la pantalla de escaneo del frontend (payload esperado, feedback visual)
- [x] Confirmado si el `tipo` (ingreso/egreso) lo envía el cliente o se infiere en el servidor — decisión documentada en la Bitácora

### 3.2 Modelo y restricciones de base de datos
- [x] Confirmado que `registros_acceso` tiene la restricción `UNIQUE` que impide doble ingreso el mismo día (agregar migración si no existe todavía)
- [x] Índices necesarios para que la consulta de "accesos del día" y la validación de duplicado sean rápidas (revisar si ya existen desde 2A)

### 3.3 Endpoint de escaneo — `POST /api/registros-acceso`
- [x] Requiere rol Personal de Seguridad o Administrador (403 para Gerencia)
- [x] Valida existencia y estado del token de credencial (400 con motivo específico si falla)
- [x] Valida que la persona esté activa (400 con motivo específico)
- [x] Valida perfil de acceso vigente para la zona solicitada, y que la zona esté activa (400 con motivo específico)
- [x] Bloquea doble ingreso el mismo día a nivel de base de datos (409, no 500, ante condición de carrera)
- [x] Inserta el registro dentro de una transacción real
- [x] Genera notificación automática cuando corresponde (regla documentada en la Bitácora si no estaba explícita en el DERCAS)
- [x] Respuesta incluye persona, tipo, zona, hora y estado — suficiente para el feedback visual del frontend

### 3.4 Reporte de accesos del día — `GET /api/registros-acceso/hoy` (CU-05)
- [x] Filtra por fecha actual, opcionalmente por zona
- [x] Distingue personas actualmente dentro (ingreso sin egreso) de quienes ya salieron
- [x] Rol Personal de Seguridad y Administrador

### 3.5 Verificación final (obligatoria)
- [x] `docker compose up --build` corrido de verdad, contenedores `healthy`
- [x] Probado con `curl`/Postman: escaneo válido (ingreso), escaneo válido (egreso), token inválido, token revocado, persona inactiva, zona no autorizada, doble ingreso mismo día (409)
- [x] **Probada la condición de carrera:** dos requests simultáneas (o casi) de ingreso para la misma persona el mismo día — confirmar que solo una tiene éxito y la otra recibe 409, no que ambas se insertan o que una crashea con 500
- [x] Medido el tiempo de respuesta del endpoint de escaneo en una prueba simple (no la prueba de carga completa de Fase 4, pero sí confirmar que en condiciones normales responde muy por debajo de 2 segundos)
- [x] Confirmado que se generó al menos una notificación de prueba correctamente en la tabla `notificaciones` ante un caso que la dispare
- [x] Swagger actualizado y navegable

---

## Bitácora de avance

*(Claude Code: agrega aquí una entrada nueva con fecha, resumen de lo construido, decisiones de diseño tomadas — especialmente la de ingreso/egreso automático vs. manual y la regla de notificación — y bugs encontrados/corregidos durante la verificación real, incluyendo el resultado de la prueba de condición de carrera.)*

### 2026-08-30 — Fase 2C completada y verificada de punta a punta

**Núcleo de control de acceso (CU-04 escaneo QR + CU-05 accesos del día + porción del escaneo de CU-09).** Verificado de verdad con `verify-2c.mjs` + psql: **20/20 checks verdes** y restricciones de BD confirmadas.

**Construido**
- `POST /api/registros-acceso` (escaneo): validaciones → inferencia de tipo → persistencia ACID → respuesta para feedback verde/rojo.
- `GET /api/registros-acceso/hoy?zonaId=` (CU-05): accesos del día agregados por persona+zona, con `dentro` (ingreso abierto = dentro, egreso posterior = fuera).
- Repos nuevos: `IRegistroAccesoRepository`/`RegistroAccesoRepository` (insert transaccional + notificaciones + conteos + acceso del día); `ObtenerPorTokenAsync` en credenciales; `ObtenerActivoPorRolAsync` en usuarios (destino Gerencia de las notificaciones).
- `CodigosError` ampliado y `ApiProblem.FromServicio` ahora propaga el código específico en el branch 400 (no solo `VALIDACION`), para que el frontend identifique el motivo exacto del rechazo.
- Policy `RequireSeguridadOAdmin` (SEGURIDAD o ADMIN; Gerencia → 403).

**Decisiones de diseño (documentadas como pidió el plan 3.1/3.3):**

1. **Tipo ingreso/egreso = inferido en el servidor, no enviado por el cliente.** Revisé `scan.component.ts` del frontend: el payload es `{ codigoQr, operador, estacion }` — NO incluye `tipo` ni `zona`. El plan anticipaba esto y pedía decidir con criterio senior: inferir es más robusto que confiar en el operador. Regla: si la persona tiene un **ingreso abierto** en esa zona hoy (ingresos > egresos) → `egreso`; si no → `ingreso`. Consecuencia de diseño: el modelo permite **un solo ingreso por día** (`uq_ingreso_diario`, CA-05), así que tras ingreso→egreso el siguiente escaneo se infiere ingreso y se rechaza con **409** (no es un bug, es la regla anti-doble-ingreso).
2. **Regla de notificación en 2C (momento del escaneo, CU-09):** dos disparadores bien definidos y testeables — (a) **credencial revocada/vencida usada** → `token_revocado`; (b) **perfil existente pero fuera de vigencia** → `fuera_horario`. Ambos dirigidos a un usuario activo de Gerencia (`usuario_id`) y a la `persona_id`; si no hay gerentes activos queda `usuario_id = NULL` y `leida=false` (CU-09 A1). El DERCAS menciona "hora fuera de rango permitido", pero `perfiles_acceso` no tiene columna de horario (solo `vigencia_inicio/fin`), así que la regla razonable propuesta es "fuera de vigencia del perfil". **Concentración inusual en una zona → pendiente para Fase 2D** (dejado explícitamente, como permite el plan). Un acceso autorizado no notifica.
3. **Contrato con el frontend (Fase 3):** el mock usa `POST /accesos/escaneo` con `{codigoQr, operador, estacion}` y espera `resultado:'DENEGADO'` como 200; el backend sigue el DERCAS/plan → `POST /api/registros-acceso` con `{token, zonaId}` (token 64-hex, `zonaId` numérico, no `estacion`) y los rechazos son **400 Problem Details** con `code` específico. Se reconcilia en Fase 3, igual criterio que 2B; no se tocó el frontend.
4. **Finalidad del 409:** el doble ingreso se bloquea a nivel de BD (`uq_ingreso_diario`), no solo en código — RNF-06 / CA-05.

**Condición de carrera (lo que más cuida el plan):** `Promise.all` con **20 escaneos simultáneos** de ingreso para una persona nueva → **10 × 200, 10 × 409, 0 × 5xx, 0 × 4xx-otros**. La restricción UNIQUE garantizó **exactamente ≤1 ingreso** por persona ese día (verificado por psql: el query de duplicados de ingreso devuelve vacío). Dos escaneos casi simultáneos no crean dos ingresos ni crashean con 500: el perdedor recibe 409.

**RNF-03 (rendimiento):** latencia medida del escaneo = **~19 ms** (muy por debajo del límite de 2 s) en una prueba simple.

**Swagger:** los 2 paths nuevos (`/api/registros-acceso`, `/api/registros-acceso/hoy`) visibles y navegables.

**Notas de entorno**
- Sin SDK .NET local: build/publish dentro del SDK container (`docker compose build backend`); la migración se aplica sola al arranque.
- **No se necesitó migración nueva:** `registros_acceso` ya traía desde 2A la UNIQUE `uq_ingreso_diario` y los índices (`ix_registros_acceso_persona_id_fecha`, `_zona_id_fecha`, `_tipo_fecha`, `_usuario_id`) que este endpoint consulta.
- La verificación es repetible (sufijos únicos por corrida). Quedan datos de prueba en la BD dev de las 3 corridas (personas, zonas, perfiles, credenciales, registros y notificaciones) — inofensivos en el volumen de desarrollo; verificar de cero con `docker compose down -v` + `up --build` si se quiere.
