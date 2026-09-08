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
- [ ] Releídas las 6 Bitácoras anteriores
- [ ] Sección 6 y 9 del DERCAS revisadas línea por línea

### 3.2 Seguridad (SEC-01 a SEC-08)
- [ ] SEC-01 Escaneo de vulnerabilidades ejecutado, hallazgos críticos/altos resueltos
- [ ] SEC-02 Inyección SQL — verificado y probado
- [ ] SEC-03 XSS — verificado y probado
- [ ] SEC-04 Rate limiting en login — **implementado si no existía**, y probado (429 tras N intentos)
- [ ] SEC-05 Matriz completa RBAC endpoint × rol generada y sin excepciones no documentadas
- [ ] SEC-06 Entropía del token QR confirmada
- [ ] SEC-07 Configuración TLS de producción documentada
- [ ] SEC-08 Almacenamiento de contraseñas verificado

### 3.3 Rendimiento y carga
- [ ] Prueba de 300 escaneos concurrentes ejecutada, P95 y tasa de error documentados
- [ ] Comportamiento del bloqueo anti-duplicado confirmado bajo esa carga
- [ ] Prueba de carga ligera sobre endpoints de consulta

### 3.4 Cobertura y criterios de aceptación
- [ ] Cobertura de pruebas revisada y reportada con números reales
- [ ] `REPORTE_CRITERIOS_ACEPTACION.md` generado, cubriendo CA-01 a CA-20 con evidencia o justificación de fuera de alcance

### 3.5 Despliegue
- [ ] `docker-compose.prod.yml` (o equivalente) creado y diferenciado de desarrollo
- [ ] `DESPLIEGUE.md` con pasos completos para el VPS real
- [ ] Estrategia de backups documentada

### 3.6 Verificación final
- [ ] Todo lo anterior corrido de verdad, no solo documentado en teoría
- [ ] `REPORTE_CRITERIOS_ACEPTACION.md` revisado como el entregable principal de esta fase — es lo que más directamente alimenta el Capítulo V de la tesis

---

## Bitácora de avance

*(Claude Code: agrega aquí una entrada nueva con fecha, resultados numéricos reales de cada prueba, cualquier vulnerabilidad encontrada y cómo se corrigió, y la lista de criterios de aceptación que quedaron fuera de alcance de esta fase con su justificación.)*
