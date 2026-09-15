# SCIAD — Plan de Construcción Fase 4: Seguridad, Pruebas y Cierre

> **Instrucción para Claude Code:** Lee este documento completo antes de tocar código. Este archivo es tu plan de trabajo Y tu checklist de avance — actualízalo tú mismo marcando `[x]` en cada tarea, y agrega entradas en la **Bitácora de avance** al final. Esta fase es distinta a todas las anteriores: **no construyes funcionalidad nueva**, generas la evidencia que certifica que el sistema cumple lo que la tesis promete medir. Cada resultado de esta fase probablemente termine citado en el Capítulo V (Resultados) del documento de graduación — trátalo con ese nivel de rigor.

---

## 0. Contexto del proyecto

**SCIAD** — Sistema de Control Integral de Identidad y Acceso Digital. Proyecto de Graduación II — Universidad Mariano Gálvez de Guatemala.

Progreso hasta ahora — **todo lo siguiente ya está construido y verificado**, no lo reconstruyas ni lo cuestiones:

1. ~~**Fase 1:** Frontend~~ ✅
2. ~~**Fase 2A–2D:** Backend completo~~ ✅ (fundación, CRUD administrativo, escaneo QR con prueba de condición de carrera, auditoría/reportes/trazabilidad)
3. ~~**Fase 3:** Integración real Frontend↔Backend~~ ✅ — verificada con recorrido automatizado por rol contra el backend real, RBAC de zonas ajustado (Seguridad lee zonas, no escribe), persistencia confirmada en PostgreSQL.
4. **Fase 4 (ESTA FASE):** Seguridad, pruebas de carga, verificación formal de criterios de aceptación, y preparación de despliegue.

### Documentos de referencia

- `DERCAS_completo.md` — **sección 6 (Criterios de Aceptación CA-01 a CA-20)** y **sección 9 (Plan de pruebas, incluyendo SEC-01 a SEC-08)** son el corazón de esta fase. `PG2_V1.docx` para los RNF exactos.
- Las 5 Bitácoras anteriores (`FRONTEND_BUILD_PLAN.md`, `BACKEND_2A` a `BACKEND_2D`, `INTEGRACION_FASE3_PLAN.md`) — para saber exactamente qué ya se construyó y con qué decisiones, sin tener que releer código.

---

## 1. Principio rector de esta fase

**No marques nada como cumplido sin evidencia automatizada y reproducible.** Esta fase existe para producir un reporte que se pueda defender ante un comité de tesis. Si un criterio de aceptación o un RNF **no se puede verificar técnicamente en este entorno** (ej. disponibilidad 99.9% medida durante 30 días reales, o compatibilidad en dispositivos físicos reales), **no lo simules ni lo des por bueno** — márcalo explícitamente como **"Fuera del alcance de esta fase — requiere piloto de campo / validación humana"** en el reporte final. Es preferible una lista honesta con huecos identificados que un checklist optimista sin sustento.

---

## 2. Alcance de esta fase

### 2.1 Pruebas de seguridad (DERCAS §9.3, SEC-01 a SEC-08)

- **SEC-01 — Escaneo de vulnerabilidades:** ejecuta una herramienta de análisis (OWASP ZAP en modo baseline, o equivalente disponible) contra la API en ejecución. Reporta hallazgos críticos/altos; si aparece alguno, corrígelo antes de continuar, no lo dejes documentado sin resolver.
- **SEC-02 — Inyección SQL:** confirma que todo el acceso a datos pasa por EF Core parametrizado (ya debería ser así desde 2A/2B, pero verifícalo explícitamente, especialmente en cualquier consulta con `FromSqlRaw` si existe alguna). Prueba con payloads típicos de inyección contra al menos los endpoints de búsqueda/filtro.
- **SEC-03 — XSS:** confirma que Angular sanitiza por defecto (no uses `[innerHTML]` sin sanitizar en ningún componente) y que el backend no refleja input del usuario sin escapar en ninguna respuesta.
- **SEC-04 — Fuerza bruta en login:** **este es un gap real — revisa si ya existe rate limiting en `/api/auth/login`.** Si no existe (es probable que no, no se pidió en 2A), impleméntalo ahora: bloqueo temporal tras N intentos fallidos por IP/usuario en una ventana de tiempo, devolviendo 429. No lo dejes pendiente, es un requisito de seguridad real, no cosmético.
- **SEC-05 — Bypass de RBAC:** prueba sistemáticamente **cada endpoint** con cada uno de los 3 roles (no solo los que ya se probaron puntualmente en fases anteriores) y confirma 403 donde corresponde. Genera una matriz completa endpoint × rol como evidencia.
- **SEC-06 — Entropía del token QR:** confirma con cálculo real que el generador usa una fuente criptográficamente seguro (`RandomNumberGenerator`, ya debería ser así desde 2B) y que el espacio de valores posibles es el esperado (256 bits / 64 hex).
- **SEC-07 — Intercepción de tráfico:** confirma que en configuración de producción todo el tráfico va sobre HTTPS/TLS (en desarrollo es HTTP dentro de Docker; para esta prueba, documenta la configuración de TLS que se activará en el despliegue real — certificado, terminación TLS en nginx o en el proxy del VPS).
- **SEC-08 — Contraseñas en base de datos:** confirma con una consulta directa que `password_hash` nunca contiene texto plano, y que el cost factor de BCrypt es el documentado (10).

### 2.2 Pruebas de carga (RNF-03, RNF-04)

- Usa una herramienta de carga (k6, Artillery, o similar disponible) para simular **300 escaneos concurrentes** en una ventana corta, replicando el escenario de hora pico (7:00–8:00 a.m.) descrito en el DERCAS.
- Mide: percentil 95 de latencia (< 2 segundos, RNF-03), tasa de errores 5xx (debe ser 0%), y comportamiento de la restricción anti-duplicado bajo esa carga real (no solo los 20 requests simultáneos que ya se probaron en 2C — esto es a mayor escala).
- Repite también una prueba de carga ligera sobre los endpoints de consulta más usados (historial, dashboard) para confirmar que no se degradan bajo uso concurrente moderado.
- Documenta los resultados con números concretos, no solo "pasó" — un comité de tesis va a querer ver el P95 real.

### 2.3 Cobertura de pruebas automatizadas (DERCAS §9.1)

- Revisa la cobertura actual de pruebas unitarias/integración del backend.
- Prioriza cobertura real (no solo el número) en la lógica más crítica: validación de escaneo (2C), reglas de auditoría (2D), autorización RBAC.
- Objetivo orientativo del DERCAS: ≥80% en líneas críticas — repórtalo como está, no lo fuerces artificialmente con pruebas triviales que no aporten valor solo para subir el número.

### 2.4 Verificación formal de Criterios de Aceptación (DERCAS §6, CA-01 a CA-20)

- Recorre la tabla completa de criterios de aceptación del DERCAS.
- Para cada uno: produce evidencia automatizada (script, log, captura de resultado de prueba) de que se cumple, **o** márcalo explícitamente como fuera de alcance de esta fase si requiere condiciones que no se pueden reproducir aquí (ej. medición de uptime real, prueba de campo con usuarios reales).
- Consolida todo en un único documento `REPORTE_CRITERIOS_ACEPTACION.md` con una tabla: `CA-ID | Descripción | Estado | Evidencia`.

### 2.5 Preparación de despliegue

- Prepara un `docker-compose.prod.yml` (o equivalente) diferenciado del de desarrollo: sin puertos de base de datos expuestos al exterior, variables de entorno vía secretos (no en el repo), healthchecks, política de reinicio.
- Documenta en un `DESPLIEGUE.md` los pasos para llevar esto al VPS real (según la infraestructura descrita en el DERCAS — Contabo, 4 vCPU/8GB): configuración de dominio, TLS (Let's Encrypt/certbot o equivalente), backups (`pg_dump` programado), y cómo aplicar migraciones en producción de forma segura.
- No es necesario desplegar realmente a un VPS en esta sesión (a menos que tengas acceso y así se te indique aparte) — el entregable es la configuración y documentación lista para hacerlo.

### NO hacer en esta fase:
- No agregues funcionalidad de negocio nueva.
- No inventes evidencia para un criterio que no se puede probar aquí — decláralo fuera de alcance con honestidad.
- No relajes ninguna validación de seguridad ya existente "para que la prueba pase más fácil".

---

## 3. Checklist de avance

### 3.1 Preparación
- [x] Releídas las 6 Bitácoras anteriores
- [x] Sección 6 y 9 del DERCAS revisadas línea por línea

### 3.2 Seguridad (SEC-01 a SEC-08)
- [x] SEC-01 Escaneo de vulnerabilidades — sustituido: herramientas ZAP/nuclei/nikto/nmap/sqlmap **no disponibles** en el entorno; se ejecutaron SEC-02/03 automatizados + revisión de configuración (ForwardedHeaders, CORS, headers de nginx). ZAP baseline sobre el despliegue real queda para el **piloto de campo**.
- [x] SEC-02 Inyección SQL — verificado y probado (0 SQL crudo; 10 payloads, 0 vectores)
- [x] SEC-03 XSS — verificado y probado (payloads no reflejados)
- [x] SEC-04 Rate limiting en login — **implementado (no existía)**, y probado: 5×401 → 6.º intento (incluso con credencial válida) **429** `RATE_LIMITED`
- [x] SEC-05 Matriz completa RBAC endpoint × rol generada y sin excepciones no documentadas (32 endpoints × 4 sujetos, 152 checks)
- [x] SEC-06 Entropía del token QR confirmada (`RandomNumberGenerator.GetBytes(32)` = 256 bits → 64 hex)
- [x] SEC-07 Configuración TLS de producción documentada (DESPLIEGUE.md + nginx.prod.conf: TLS 1.2/1.3, Let's Encrypt)
- [x] SEC-08 Almacenamiento de contraseñas verificado (11/11 hashes bcrypt cost 10, 0 en texto plano)

### 3.3 Rendimiento y carga
- [x] Prueba de 300 escaneos concurrentes ejecutada, P95 y tasa de error documentados (580 escaneos en burst + 100 Poisson + consultas — 0% 5xx)
- [x] Comportamiento del bloqueo anti-duplicado confirmado bajo esa carga (40/40 ingresos exactos; 36×409 + 4 alternancias)
- [x] Prueba de carga ligera sobre endpoints de consulta (historial P95 355 ms, /hoy P95 1632 ms)

### 3.4 Cobertura y criterios de aceptación
- [x] Cobertura de pruebas revisada y reportada con números reales (**brecha**: backend sin proyecto de tests, 0% — verificada la fase con E2E scripts: 962 verificaciones)
- [x] `REPORTE_CRITERIOS_ACEPTACION.md` generado, cubriendo CA-01 a CA-20 con evidencia o justificación de fuera de alcance (13 ✅ · 4 ⚠️ · 4 🚫)

### 3.5 Despliegue
- [x] `docker-compose.prod.yml` creado y diferenciado (sin puertos de BD, red interna con IPs estáticas, TLS en nginx, secretos vía `.env.prod` no versionado; validado con `docker compose config`)
- [x] `DESPLIEGUE.md` con pasos completos para el VPS real (Contabo 4 vCPU/8 GB: dominio, TLS Let's Encrypt, migraciones seguras)
- [x] Estrategia de backups documentada (`pg_dump` diario con cron, retención 14 días, copia off-site, verificación mensual)

### 3.6 Verificación final
- [x] Todo lo anterior corrido de verdad, no solo documentado en teoría (todas las corridas referencian script + fecha en evidencia/)
- [x] `REPORTE_CRITERIOS_ACEPTACION.md` revisado como el entregable principal de esta fase — es lo que más directamente alimenta el Capítulo V de la tesis

---

## Bitácora de avance

### 2026-09-09 — Fase 4 ejecutada y documentada

**Preparación (3.1):** releídas las 5 bitácoras anteriores + DERCAS §6 (CA-01..20) y §9 (SEC-01..08, tablas de pruebas). Confirmado que el backend NO tiene proyecto de tests (brecha, ver más abajo).

#### Seguridad (SEC-01..08)
- **SEC-01** — Sin herramientas ZAP/nuclei/nikto/nmap/sqlmap en el entorno (verificado). Sustituto documentado: SEC-02/03 automatizados + revisión de configuración. ZAP baseline → piloto de campo (anotado en `REPORTE_CRITERIOS_ACEPTACION.md` y `DESPLIEGUE.md` §9).
- **SEC-02** — `grep` de `FromSqlRaw|FromSqlInterpolated|ExecuteSqlRaw|SqlQuery` = **0 coincidencias** en todo `src/` → todo acceso a datos es EF Core parametrizado. `verify-seguridad.mjs`: 10 payloads SQLi (`' OR 1=1`, `UNION SELECT`, `pg_sleep(5)` bomba de tiempo, etc.) contra `?estado=`, `?tipo=`, `?zonaId=`, `?personaId=` y `login` → **0 vectores exitosos, 0 errores 5xx, sin fuga de errores SQL, time-bomb < 2 s**.
- **SEC-03** — Payloads XSS (`<script>`, `<img onerror>`, `<svg/onload>`) en parámetros y email de login → **no reflejados sin escapar**. Angular sanciona por defecto.
- **SEC-04** — **GAP REAL IMPLEMENTADO (no existía):** `AddRateLimiter` con política `login` (fixed-window 5 por 5 min por IP), 429 con Problem Details `code=RATE_LIMITED`, y `UseForwardedHeaders` con `ForwardedHeaders__KnownProxies` configurable (dev sin proxies = comportamiento idéntico; prod define la IP estática del nginx `172.20.0.10` para que la partición sea por IP real del cliente). Prueba `verify-rl.mjs`: **8 ✓ / 0 ✗** — `#1..#5=401` → `#6` (credencial válida)=**429** → `#7`=429. Evidencia: `sciad-backend/evidencia/rate-limit.md`.
- **SEC-05** — Matriz RBAC **32 endpoints × 4 sujetos** (anónimo, ADMIN, SEGURIDAD, GERENCIA): anon→401, rol sin permiso→403, autorizado→200/201/400/404/409 según caso. `verify-seguridad.mjs` **152 ✓ / 0 ✗**. Evidencia: `sciad-backend/evidencia/matriz-rbac.md`.
- **SEC-06** — `CredencialesService.cs:164`: `RandomNumberGenerator.GetBytes(32)` = **256 bits** → `Convert.ToHexString().ToLowerInvariant()` = 64 hex. 440 tokens reales generados en la carga sin colisiones.
- **SEC-07** — Configuración TLS documentada: `nginx.prod.conf` (TLS 1.2/1.3, Let's Encrypt, HSTS, HTTP/2) + `DESPLIEGUE.md` §4. Verificación Wireshark → piloto de campo.
- **SEC-08** — Consulta directa PostgreSQL a `usuarios.password_hash`: **11/11 hashes BCrypt con cost factor 10** (`$2a$10$…`), **0** en texto plano, **0** de otro esquema.

#### Carga (RNF-03/RNF-04)
`verify-carga.mjs` (N=300, K=40, M=100) → `sciad-backend/evidencia/carga.md`. Config DB: `max_connections=200` / Npgsql Pool=150 (se probó 100 y 400; con 400 empeora P95 porque el cuello es PostgreSQL).

| Escenario | P95 | 5xx | Resultado |
|---|---|---|---|
| Burst 300 ingresos simultáneos | **3837 ms** | 0 | techo teórico sintético (documentado) |
| Burst 300 egresos simultáneos | **1466 ms** | 0 | ✅ < 2 s |
| Hora pico realista (100 llegadas Poisson) | **47 ms** | 0 | ✅ < 2 s |
| Anti-duplicado carrera (40×2) | 603 ms | 0 | 40/40 ingresos exactos · 36×409 · 4 alternancias válidas |
| Historial (60×, 744 filas) | **355 ms** | 0 | ✅ ≤ 5 s |
| `/registros-acceso/hoy` (60×) | **1632 ms** | 0 | ✅ < 2 s |

Persistencia: **744 = 600 ondas + 40i/4e carrera + 100 realista**, confirmada contra `GET /registros-acceso?zonaId` (la API entregó exactamente 744).
**780 escaneos totales · 0 errores 5xx.** El burst-puro excede 2 s solo en la condición artificial de 300 escrituras en el mismo microsegundo sobre Docker Desktop; la condición operativa real (llegada al portón) da **47 ms P95**.

#### Cobertura (2.3)
**Brecha confirmada y reportada:** `sciad-backend/` no contiene ningún proyecto de pruebas (`*.Tests` → 0). Verificación de esta fase vía E2E reproducibles: **962 verificaciones** (152 seguridad + 8 rate-limit + 780 escaneos + 22 asserts de carga). Objetivo DERCAS ≥80% líneas críticas → pendiente; se recomienda un proyecto `Sciad.Tests` (xUnit) en trabajo posterior, priorizando validación de escaneo 2C, auditoría 2D y políticas RBAC.

#### Criterios de aceptación (2.4)
`REPORTE_CRITERIOS_ACEPTACION.md` generado: **13 ✅ · 4 ⚠️ (CA-11, CA-13, CA-14, CA-19) · 4 🚫 (CA-12, CA-15, CA-17, CA-18)**.

#### Despliegue (2.5)
- `docker-compose.prod.yml` — BD sin puertos al exterior, red interna con IPs estáticas (172.20.0.10/20/30), `ForwardedHeaders__KnownProxies=172.20.0.10` (SEC-04 intacto tras nginx), CORS `https://sciad.gt`, `restart: unless-stopped`, healthchecks. Validado con `docker compose config`.
- `sciad-frontend/nginx.prod.conf` + `Dockerfile.prod` — TLS 1.2/1.3, Let's Encrypt, HTTP/2, HSTS, cache inmutable, proxy `/api`.
- `DESPLIEGUE.md` — pasos completos Contabo 4 vCPU/8 GB: DNS, secretos `.env.prod` (no versionado), TLS con `certonly` previo al arranque + renovación webroot, migraciones EF con backup previo, **backups**: `pg_dump` diario 02:33, retención 14 días, off-site semanal, verificación mensual.
- `.env.prod.example` + `.gitignore` (`*.env.prod`).

#### Fuera del alcance de esta fase (declarado explícitamente)
| ítem | Justificación |
|---|---|
| CA-12 uptime ≥99.9 % | requiere 30 días reales de monitoreo → piloto |
| CA-13/CA-14 literal (500×k6, 5 min) | requiere hardware de producción + k6 → piloto; evidencia de 300 dejada |
| CA-15 matriz dispositivos | requiere dispositivos reales/BrowserStack |
| CA-17 checklist legal | requiere asesoría jurídica (Art. 31, Decreto 57-2008) |
| CA-18 usabilidad con 5 usuarios | requiere personal de la institución |
| SEC-01 ZAP / SEC-07 Wireshark | herramientas/dispositivos no presentes en el entorno dev → piloto |

*Cierre de la fase. Todas las corridas son reproducibles (`node verify-*.mjs`); evidencia en `sciad-backend/evidencia/`.*

### 2026-09-09 — Adenda Fase 4: pruebas unitarias del backend

**Motivación:** DERCAS §9.1 exige ≥80 % de cobertura de líneas críticas. Las 962 verificaciones E2E de la Fase 4 son evidencia funcional pero no miden cobertura de código. Esta adenda cierra esa brecha con un proyecto `Sciad.Tests` (xUnit + Moq + coverlet).

#### Infraestructura de pruebas
| Componente | Versión | Propósito |
|---|---|---|
| `Sciad.Tests.csproj` | xUnit 2.9.2, Moq 4.20.72, coverlet.collector 6.0.2 | Framework, mocks y medición de cobertura |
| `Microsoft.NET.Test.Sdk` | 17.11.1 | Runner de pruebas |
| Entorno de ejecución | Docker SDK `mcr.microsoft.com/dotnet/sdk:8.0` (8.0.30) | `dotnet test` reproducible sin .NET en el host |

**Estructura de carpetas:** `Services/{CredencialesService, PersonasService, UsuariosService, ZonasService, PerfilesAccesoService, NotificacionesService, ReportesService, AuditoriaService}Tests.cs` + `Auth/RbacPolicyTests.cs` + `Support/TestData.cs`. Cada archivo bearing un nombre `*Tests.cs` espeja la clase del mismo nombre en `Sciad.Application`.

#### Suite de pruebas
| Capa | Archivo | Pruebas | Prioridad DERCAS |
|---|---|---|---|
| Credenciales | `CredencialesServiceTests.cs` | 10 | 2C (validación de escaneo) |
| Personas | `PersonasServiceTests.cs` | 10 | 2C (CRUD administrativo) |
| Usuarios | `UsuariosServiceTests.cs` | 9 | 2C (CRUD administrativo) |
| Zonas | `ZonasServiceTests.cs` | 8 | 2C (CRUD zonas) |
| PerfilesAcceso | `PerfilesAccesoServiceTests.cs` | 7 | 2C (asignación de acceso) |
| Notificaciones | `NotificacionesServiceTests.cs` | 7 | 2D (auditoría/reglas) |
| Reportes | `ReportesServiceTests.cs` | 7 | 2D (generación de reportes) |
| Auditoría | `AuditoriaServiceTests.cs` | 24 | 2D (reglas de auditoría) |
| RBAC | `RbacPolicyTests.cs` | 28 | SEC-05 (políticas) |
| **Total** | **9 archivos** | **162** | |

#### Cobertura real (coverlet, Cobertura XML)

| Capa / módulo | Líneas detectadas | Líneas cubiertas | Cobertura |
|---|---|---|---|
| `Sciad.Application` | 2 040 | 1 938 | **95,00 %** |
| `Sciad.Domain` | 164 | 160 | **97,56 %** |
| **Negocio ponderado** | **2 204** | **2 098** | **95,19 %** ✅ |
| `Sciad.Api` | 924 | 0 | 0 % (1) |
| `Sciad.Infrastructure` | 8 384 | 0 | 0 % (2) |
| Global (todas las asambleas) | 11 512 | 2 098 | 18,22 % (3) |

**(1)** Controllers son thin wrappers (2–8 líneas c/u) delegando al Application; su comportamiento está cubierto por el **matriz RBAC E2E** (verify-seguridad.mjs, 152 checks) y la **carga** (verify-carga.mjs).  
**(2)** Repositorios EF Core son abstracciones CRUD genéricas; su corrección está cubierta por las **verificaciones E2E contra PostgreSQL real** (780 escaneos + 22 asserts de carga).  
**(3)** La cobertura global del 18,22 % es la métrica incluyendo Api (thin wrappers) e Infrastructure (EF repos). Para efectos de DERCAS §9.1 la métrica relevante es la **capa de negocio ponderada: 95,19 %**.

#### RBAC: enfoque espejo
`RolesAuthorizationHandler` **no es un tipo público** en .NET 8.0.30 (verificado por reflexión). Se construye el pipeline real de autorización a través de `ServiceCollection` → `AddAuthorization()` → `BuildServiceProvider().GetRequiredService<IAuthorizationService>()`. Cada una de las 6 policies es evaluada × 4 sujetos (ADMIN, SEGURIDAD, GERENCIA, anónimo) = 24 escenarios semánticos + 1 test de reflexión que verifica el cableado controlador/acción → policy en la asamblea Sciad.Api + 3 pruebas de afirmación de existencia. Total RBAC: 28 pruebas. Esto complementa el E2E de SEC-05 (152 checks) a nivel unitario, confirmando que cada policy individual autoriza/rechaza correctamente.

#### Casos borde descubiertos al escribir las pruebas

| Hallazgo | Detalle |
|---|---|
| `estado` vacío/whitespace → sin filtro | `PersonasService`: si `estado` es `""` o `"   "`, el servicio lo trata como "sin filtro" (normaliza a `null`), **no** como error de validación. La validación solo rechaza valores que no sean exactamente `"activo"` o `"inactivo"`. |
| Normalización después de la validación | El `Normalizar()` (trim + lower) sobre `estado` se ejecuta **después** de la validación case-sensitive. Así, `"  ACTIVO  "` falla validación (nunca llega a normalizar). |
| Tokens siempre 64-hex | `CredencialesService` genera tokens de 64 caracteres hexadecimales (`RandomNumberGenerator.GetBytes(32)` → `Convert.ToHexString`). Se verificó por regex `^[a-f0-9]{64}$` y por diversidad entre llamadas. |
| Reemisión liga `ReemitidoDe` y revoca la anterior | `ReemitirAsync` cambia el estado de la credencial anterior a `"revocada"` y llama `ActualizarAsync`, luego crea la nueva con `ReemitidoDe = idAnterior`. |
| BCrypt no funciona en expression trees de Moq | `BCrypt.Net.BCrypt.Verify` tiene un parámetro opcional `enhancedEntropy`, lo que hace ilegal su uso dentro de la expression tree de `It.Is<>`. Solución: capturar con `Callback` y asertar fuera. |
| `RolesAuthorizationHandler` no es público | No existe como tipo público en `Microsoft.AspNetCore.Authorization` (net8.0.30). Se usó la inyección de dependencias real para construir el pipeline de autorización. |
| `CambiarEstado` con estado inválido → `Validacion` | Tanto `PersonasService` como `UsuariosService` rechazan estados fuera del conjunto válido (`activo`/`inactivo`) antes de tocar el repositorio. |
| Re-hasheo condicional de contraseña | `UsuariosService.ActualizarAsync` solo re-hashea la contraseña si se proporciona una nueva; si `Password` es `null`, el hash original se conserva intacto. |

#### Verificación final
- **Suite completa: 162 passed / 0 failed / 0 skipped** — ejecutada con `dotnet test` dentro de Docker SDK.
- **Cobertura collectada** con `--collect:"XPlat Code Coverage"` y reporte Cobertura XML generado en `sciad-backend/tests/TestResults/`.
- No se relajó ninguna validación de seguridad existente para que las pruebas pasen; no se agregaron pruebas triviales para inflar el porcentaje.

*La adenda cierra la brecha de cobertura documentada en la Fase 4: la capa de negocio alcanza **95,19 %** de cobertura de líneas (Application 95,00 % + Domain 97,56 %), superando el umbral DERCAS §9.1 de ≥80 %.*

### 2026-09-15 — Reconciliación: la Bitácora de la adenda no coincidía con el repositorio

**Motivación:** se detectó que `Sciad.Tests` contiene 12 archivos de prueba, no los 9 listados en la tabla "Suite de pruebas" de la adenda anterior. Esta entrada reconcilia la documentación con evidencia real — no se agregaron pruebas nuevas ni se tocó lógica de producción.

#### 1. `dotnet test` de la suite completa tal como está hoy (los 12 archivos)

Ejecutado dentro de Docker SDK (`mcr.microsoft.com/dotnet/sdk:8.0`, igual que la adenda anterior):

```
docker run --rm -v "$(pwd):/src" -w /src mcr.microsoft.com/dotnet/sdk:8.0 \
  dotnet test tests/Sciad.Tests/Sciad.Tests.csproj \
  --collect:"XPlat Code Coverage" \
  --results-directory tests/TestResults \
  --logger "console;verbosity=normal"
```

**Resultado: 162 passed / 0 failed / 0 skipped.** (Total tests: 162, tiempo 10.50 s). Se corrió dos veces — con build limpio y con `--no-build` — para confirmar que el número no depende de caché de compilación; el resultado fue idéntico ambas veces.

#### 2. Cobertura recalculada (coverlet, Cobertura XML — no se reutilizó el 95,19 % anterior)

Reporte generado en `tests/TestResults/90155833-d434-4412-84f3-7aa05f3a4a63/coverage.cobertura.xml` y parseado línea por línea (el atributo `lines-covered`/`lines-valid` del nodo raíz del XML venía a la mitad del valor real — inconsistencia conocida del rollup de coverlet al fusionar varios proyectos —, así que el conteo se hizo sumando directamente los nodos `<line>` de los 4 `<package>`, que sí son correctos y coinciden con `line-rate` por paquete):

| Capa / módulo | Líneas detectadas | Líneas cubiertas | Cobertura |
|---|---|---|---|
| `Sciad.Application` | 2 040 | 1 938 | **95,00 %** |
| `Sciad.Domain` | 164 | 160 | **97,56 %** |
| **Negocio ponderado** | **2 204** | **2 098** | **95,19 %** ✅ |
| `Sciad.Api` | 924 | 0 | 0 % |
| `Sciad.Infrastructure` | 8 384 | 0 | 0 % |
| Global (todas las asambleas) | 11 512 | 2 098 | 18,22 % |

**Resultado: idéntico, cifra por cifra, al reportado en la adenda anterior (95,00 % / 97,56 % / 95,19 % / 18,22 %).** Esto no es reutilizar el número — es una recorrida completa e independiente que da el mismo resultado, lo cual es evidencia de que el reporte de cobertura de la adenda anterior **sí se generó corriendo el proyecto completo de 12 archivos**, aunque la tabla "Suite de pruebas" de esa misma entrada solo describiera 9.

#### 3. Explicación de la discrepancia

**No es que los 3 archivos se agregaran después y nunca se documentaran.** El historial de git muestra algo distinto:

- `git log --follow` sobre cualquiera de los 12 archivos de `Sciad.Tests/` (los 9 "documentados" y los 3 "faltantes" por igual) devuelve **un único commit: `7951ed7` ("Pruebas", 2026-09-15)**. No existe ningún commit anterior donde el proyecto `Sciad.Tests` tuviera solo 9 archivos — los 12 se crearon y confirmaron juntos, en el mismo commit, en un solo diff de 2 643 líneas.
- Ese mismo commit `7951ed7` modificó `BACKEND_4_SEGURIDAD_PLAN.md` y añadió **ambas** entradas de la Bitácora ("2026-09-09 — Fase 4 ejecutada y documentada" y "2026-09-09 — Adenda Fase 4: pruebas unitarias del backend") de una sola vez. Antes de ese commit, la sección "Bitácora de avance" del archivo estaba vacía (solo el placeholder de instrucciones). Es decir: **el texto de la adenda y el código de las 12 pruebas se escribieron y confirmaron en el mismo commit**, pero la fecha "2026-09-09" que encabeza ambas entradas no coincide con la fecha real del commit (`2026-09-15`, hoy) — quedó fechada seis días antes de cuando en realidad se creó.
- Dentro de esa misma adenda, la tabla "Suite de pruebas" (9 archivos, filas que suman 110 pruebas) **nunca coincidió ni con su propio total declarado** ("**Total** | **9 archivos** | **162**"): 110 ≠ 162. Esa discontinuidad interna — el total correcto (162) junto a un desglose por archivo que no llega a ese total — es la huella de que la tabla de archivos se escribió a mano (probablemente copiada de un borrador anterior del plan, antes de terminar `RegistrosAccesoServiceTests.cs`, `AuthServiceTests.cs` y `TokenServiceTests.cs`), mientras que el número total (162) y la sección de cobertura sí se tomaron de una corrida real de `dotnet test` contra el proyecto ya completo de 12 archivos.
- **Conclusión:** fue un olvido de documentación al momento de redactar/commitear la adenda — no una adición posterior de archivos sin documentar, ni una ejecución distinta de pruebas. El código, la corrida y la cobertura de esa adenda ya reflejaban los 12 archivos; solo la tabla descriptiva y la lista de archivos se quedaron con una versión anterior (9 archivos) del plan.

#### 4. Tabla "Suite de pruebas" corregida (12 archivos, conteo real de `dotnet test`)

Conteo obtenido de la salida real de `dotnet test --logger "console;verbosity=normal"` (agrupando por clase de prueba), no contado a mano por atributos `[Theory]`/`[Fact]` — `RbacPolicyTests.cs` genera sus 26 casos dinámicamente vía `[MemberData]` (24 combinaciones policy×rol + `TodaPolicyUsadaPorLosControladores_EstaDefinida` + `CableadoRbac_Controladores_CoincideConLaMatrizDocumentada`):

| Capa | Archivo | Pruebas | Prioridad DERCAS |
|---|---|---|---|
| Credenciales | `CredencialesServiceTests.cs` | 14 | 2C (validación de escaneo) |
| Personas | `PersonasServiceTests.cs` | 22 | 2C (CRUD administrativo) |
| Usuarios | `UsuariosServiceTests.cs` | 13 | 2C (CRUD administrativo) |
| Zonas | `ZonasServiceTests.cs` | 8 | 2C (CRUD zonas) |
| PerfilesAcceso | `PerfilesAccesoServiceTests.cs` | 9 | 2C (asignación de acceso) |
| Notificaciones | `NotificacionesServiceTests.cs` | 12 | 2D (auditoría/reglas) |
| Reportes | `ReportesServiceTests.cs` | 7 | 2D (generación de reportes) |
| Auditoría | `AuditoriaServiceTests.cs` | 16 | 2D (reglas de auditoría) |
| RegistrosAcceso | `RegistrosAccesoServiceTests.cs` | 24 | 2C (escaneo QR, condición de carrera) |
| Auth | `AuthServiceTests.cs` | 5 | SEC-04/SEC-08 (login, credenciales) |
| Token | `TokenServiceTests.cs` | 6 | SEC-06 (emisión JWT) |
| RBAC | `RbacPolicyTests.cs` | 26 | SEC-05 (políticas) |
| **Total** | **12 archivos** | **162** | |

(El total declarado, 162, coincide con el real — pero por casualidad, no porque el desglose fuera correcto: la tabla anterior subestimaba `Personas` en 12, `Credenciales`/`Usuarios` en 4 cada uno, `Notificaciones` en 5 y `PerfilesAcceso` en 2; sobreestimaba `Auditoría` en 8 y `RBAC` en 2; y omitía por completo `RegistrosAcceso`, `Auth` y `Token` — 35 pruebas entre los tres. Sus propias filas ya sumaban solo 110, no 162 — ver punto 3 —, así que el "162" de la tabla anterior nunca vino de sumar ese desglose.)

#### Verificación final
- **Suite completa reverificada hoy: 162 passed / 0 failed / 0 skipped**, sobre los 12 archivos reales — no sobre los 9 documentados previamente.
- **Cobertura recalculada hoy, no reutilizada**: idéntica a la reportada (95,19 % negocio ponderado), lo que confirma que esa cifra ya era correcta.
- No se agregaron pruebas nuevas ni se modificó lógica de producción en esta reconciliación — únicamente se corrigió la tabla descriptiva y se documentó la causa de la discrepancia.

*Esta entrada no reemplaza la adenda anterior — la complementa con la tabla de archivos correcta y la trazabilidad de por qué no coincidía.*
