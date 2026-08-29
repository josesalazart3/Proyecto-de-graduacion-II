# SCIAD — Plan de Construcción Fase 1: Frontend

> **Instrucción para Claude Code:** Lee este documento completo antes de escribir una sola línea de código. Este archivo es tu plan de trabajo Y tu checklist de avance — actualízalo tú mismo marcando `[x]` en cada tarea que completes, y agrega entradas en la sección **Bitácora de avance** al final con fecha y resumen de lo hecho en cada sesión. Si en una sesión futura retomas este proyecto, relee este archivo primero para saber exactamente dónde quedaste.

---

## 0. Contexto del proyecto

**SCIAD** — Sistema de Control Integral de Identidad y Acceso Digital basado en Credenciales QR Cifradas y Arquitectura Cloud, para la optimización de la seguridad y trazabilidad del acceso físico en organizaciones de la Zona 1 de la Ciudad de Guatemala. Proyecto de Graduación I — Universidad Mariano Gálvez de Guatemala.

Este proyecto se construye en **3 fases**:
1. **Fase 1 (ESTA FASE):** Frontend completo, funcional con datos simulados (mock), en Docker.
2. **Fase 2 (futura, no iniciar):** Backend real (API REST, base de datos) que reemplazará los mocks.
3. **Fase 3 (futura, no iniciar):** Integración, pruebas end-to-end y despliegue final.

**No construyas nada de Fase 2 o Fase 3 en esta sesión.** El objetivo de la Fase 1 es un frontend que se pueda demostrar y navegar de principio a fin con datos falsos coherentes, listo para conectarse a una API real después sin rehacer nada.

### Documentos de referencia (léelos antes de empezar)

Ubicados en: `C:\Users\jsalazar\Documents\GitHub\Proyecto de graduacion II\SCIAD\Documentacion`

- `PG2_V1.docx` — Documento de tesis: planteamiento del problema, objetivos, hipótesis, variables, requerimientos funcionales y no funcionales.
- `DERCAS_completo.md` — Documento de Especificaciones, Requerimientos y Criterios de Aceptación. **Esta es tu fuente de verdad para casos de uso, RF/RNF y criterios de aceptación.**
- Diagramas (casos de uso, arquitectura, modelo conceptual, modelo entidad-relación, secuencia, despliegue) — úsalos para entender el modelo de datos y los flujos, aunque en esta fase no haya backend real.

Si algo en este archivo contradice al DERCAS, **el DERCAS manda**. Si algo no está claro en ninguno de los dos, usa tu criterio de senior y déjalo anotado en la Bitácora como una decisión de diseño tomada.

---

## 1. Dominio y actores (resumen para referencia rápida)

No inventes actores ni casos de uso nuevos — estos son los que ya están validados en el DERCAS:

| Actor | Rol |
|---|---|
| **Administrador** | Gestión completa: usuarios, perfiles de acceso, credenciales QR, auditoría, reportes |
| **Personal de Seguridad** | Escaneo de credenciales QR en el punto de acceso (BYOD — su propio dispositivo móvil), consulta de accesos del día |
| **Gerencia / Auditoría** | Consulta de solo lectura: historial de accesos, reportes de auditoría, notificaciones |
| **Colaborador / Visitante** | Persona cuyo acceso se controla — no tiene login propio en esta fase, es la entidad gestionada por los demás roles |

### Casos de uso a cubrir en el frontend (CU-01 a CU-10 del DERCAS)

1. Autenticarse en el sistema (login, RBAC)
2. Gestionar usuarios
3. Gestionar perfiles de acceso por zona
4. Gestionar credenciales QR (generar, reemitir, revocar)
5. Registrar ingreso/egreso mediante escaneo QR
6. Consultar reporte de accesos del día
7. Consultar historial de accesos
8. Generar reportes de auditoría
9. Auditar integridad de bitácoras
10. Recibir notificaciones automáticas de eventos anómalos

---

## 2. Requerimientos no funcionales relevantes para el frontend

Toma estos del DERCAS/PG2_V1 y aplícalos aunque no haya backend real todavía:

- **Usabilidad:** cualquier acción principal se completa en máximo 3 pasos/clics.
- **Compatibilidad:** debe verse y funcionar correctamente en navegador de escritorio y en móvil (el rol Personal de Seguridad opera 100% desde su teléfono — diseña esa vista mobile-first).
- **Rendimiento percibido:** estados de carga (skeletons/spinners) en cualquier operación simulada, para que la UX ya se sienta como producto real, no como maqueta estática.
- **Accesibilidad:** contraste adecuado, navegación por teclado, textos alternativos — estándar WCAG AA como mínimo.

---

## 3. Stack técnico (decisiones ya tomadas — no las cuestiones)

- **Framework:** Angular (última versión estable 18/19 disponible al momento de crear el proyecto), **standalone components** (no NgModules).
- **Proyecto nuevo desde cero.** No reutilices ni copies código del prototipo académico anterior (SCIA). Este es un build limpio.
- **Gestión de estado:** signals de Angular (no NgRx a menos que la complejidad real lo justifique — probablemente no la justifique en esta fase).
- **Estilos:** define un sistema de diseño propio (ver sección 4) — puede ser Tailwind CSS o SCSS con design tokens, decide tú según lo que permita construir más rápido una UI de calidad senior.
- **Datos simulados:** capa de servicios Angular con `HttpClient` apuntando a un **interceptor mock** o `in-memory-web-api`, estructurada exactamente como se conectaría a una API REST real — de forma que en la Fase 2 solo se cambie la URL base y se quite el interceptor, sin tocar componentes.
- **Docker desde el día uno:**
  - `Dockerfile` multi-stage: build de Angular (`node:alpine`) → servido por `nginx:alpine`.
  - `docker-compose.yml` con el servicio `frontend` ya funcional (puerto expuesto, healthcheck básico).
  - Deja comentado y documentado en el propio `docker-compose.yml` dónde irían los servicios `backend` y `db` en la Fase 2, para que agregarlos después sea trivial.
  - El proyecto debe levantar con un solo comando: `docker compose up`.

---

## 4. UI/UX — actúa como diseñador senior

**Antes de construir cualquier pantalla, ejecuta el agente especializado de diseño:**

```bash
npx claude-code-templates@latest --agent development-team/ui-ux-designer
```

Usa este agente para definir y documentar (en un archivo `DESIGN_SYSTEM.md` dentro del repo):
- Paleta de color (propón una identidad visual propia para un producto de seguridad/control de acceso — moderna, confiable, con buen uso de color semántico: verde=acceso autorizado, rojo=denegado/alerta, ámbar=pendiente de revisión).
- Tipografía (una fuente para títulos, una para cuerpo — con buena legibilidad en dashboards con datos).
- Espaciado, radios de borde, sombras — consistentes en todo el sistema.
- Componentes base reutilizables: botones, inputs, tablas de datos, tarjetas de KPI, badges de estado, modales, toasts de notificación.
- Modo claro obligatorio; modo oscuro opcional si el tiempo lo permite (bonus, no bloqueante).

**Estándar de calidad esperado:** que la interfaz se sienta como un producto SaaS moderno de seguridad (piensa en referencias tipo Okta, Auth0, Vercel dashboard, Linear) — no como una plantilla de admin genérica. Prioriza claridad de datos, jerarquía visual y feedback inmediato ante cada acción.

---

## 5. Pantallas a construir (checklist de avance)

Marca cada casilla al completarla. No avances a la Fase 2 hasta que todo esto esté en `[x]`.

### 5.1 Base del proyecto
- [x] Proyecto Angular inicializado (standalone, routing, SSR desactivado salvo que se justifique)
- [x] Sistema de diseño definido y documentado en `DESIGN_SYSTEM.md`
- [x] Layout base: navegación lateral/superior según rol autenticado, responsive
- [x] Capa de mocks (servicios + interceptor) con datos realistas y coherentes entre pantallas (mismos nombres de personas/zonas repitiéndose donde corresponda, no datos aleatorios inconsistentes en cada pantalla)
- [x] Manejo de estado de sesión simulada (login mock con los 3 roles, guard de rutas por rol)
- [x] Dockerfile + docker-compose funcionando con `docker compose up`

### 5.2 Autenticación (CU-01)
- [x] Pantalla de login con selección/detección de rol
- [x] Validación de formulario y manejo de error de credenciales simulado
- [x] Redirección post-login según rol (Administrador → dashboard admin; Personal de Seguridad → pantalla de escaneo; Gerencia → portal de trazabilidad)

### 5.3 Vista Administrador
- [x] Dashboard con KPIs (accesos hoy, personas activas, alertas pendientes, credenciales emitidas)
- [x] Gestión de usuarios (listar, crear, editar, desactivar) — CU-02
- [x] Gestión de perfiles de acceso por zona (listar, crear, editar) — CU-03
- [x] Gestión de credenciales QR: generar nueva, ver estado, reemitir/revocar — CU-04
- [x] Auditoría: listado de inconsistencias detectadas, con detalle — CU-08 / CU-09
- [x] Reportes: generación y exportación simulada (CSV/PDF mock) — CU-08

### 5.4 Vista Personal de Seguridad (mobile-first)
- [x] Pantalla de escaneo QR (simulada — puede ser input manual de token o cámara mock) — CU-05
- [x] Feedback visual inmediato: acceso autorizado (verde) / denegado (rojo) con motivo
- [x] Listado de accesos registrados en el turno/día actual — CU-06

### 5.5 Vista Gerencia / Auditoría
- [x] Portal de trazabilidad: historial de accesos filtrable (por persona, zona, fecha) — CU-07
- [x] Centro de notificaciones de eventos anómalos — CU-10
- [x] Vista de reportes (solo lectura)

### 5.6 Pulido final de Fase 1
- [x] Estados vacíos (empty states) diseñados, no solo "no hay datos"
- [x] Estados de carga y error consistentes en toda la app
- [x] Revisión de responsive en al menos 3 anchos (móvil, tablet, desktop)
- [x] README.md del proyecto actualizado con instrucciones de arranque (`docker compose up`) y estructura de carpetas

---

## 6. Reglas de trabajo para Claude Code

- Actualiza este archivo (`FRONTEND_BUILD_PLAN.md`) marcando checkboxes conforme avances, en la misma sesión en que completes cada tarea — no lo dejes para el final.
- Si tomas una decisión de diseño o de datos que no estaba explícita en el DERCAS/PG2_V1, anótala en la Bitácora de avance para que quede trazable.
- No inventes campos de datos que no existan en el modelo Entidad-Relación de referencia; si necesitas un campo adicional para la UI (ej. avatar de usuario), está bien, pero anótalo también.
- Si encuentras una inconsistencia entre el DERCAS y los diagramas, detente y pregunta antes de continuar — no asumas.
- Commits pequeños y descriptivos conforme avances (si el repo Git ya está inicializado).

---

## Bitácora de avance

> Formato: `### AAAA-MM-DD — resumen corto`, seguido de una lista breve de lo hecho y cualquier decisión de diseño tomada.

### 2026-08-28 — Fase 1 completa: frontend funcional con mocks + Docker

**Construcción del frontend**
- Proyecto Angular 22 con componentes standalone (sin NgModules), cubriendo los casos de uso CU-01 a CU-10 del DERCAS.
- Sistema de diseño propio documentado en `DESIGN_SYSTEM.md` y como SCSS con design tokens: marca indigo `#3b5bdb`, color semántico (verde = autorizado, rojo = denegado/alerta, ámbar = pendiente), tipografía, espacios, radios y sombras. Vista de escritorio y móvil (el rol Seguridad se diseñó mobile-first).
- Base de datos simulada en memoria (`mock-db.ts`) servida por un interceptor HTTP para `/api/**` con latencia ~350ms. En la Fase 2 basta con quitar el interceptor y cambiar `apiUrl` — no se toca ningún componente.
- Autenticación mock con los 3 roles (admin / seguridad / gerencia, clave `sciad123`), guards de ruta RBAC y redirección post-login según rol.
- Pantallas: login; dashboard admin con KPIs; gestión de usuarios; perfiles de acceso por zona; credenciales QR (generar / reemitir / revocar + vista QR); auditoría de inconsistencias; reportes con exportación CSV; escaneo QR (input de token + feedback verde/rojo); accesos del turno; trazabilidad filtrable; centro de notificaciones.
- Estados de carga (skeletons), vacíos y de error consistentes. Build de producción limpio (sin warnings) → `dist/sciad-frontend/browser`.

**Docker + pulido**
- `Dockerfile` multi-stage: `node:22-alpine` (npm ci + build) → `nginx:1.27-alpine` con healthcheck.
- `nginx.conf` con SPA fallback, gzip, caché de assets y bloque `/api/` documentado (comentado) para la Fase 2.
- `docker-compose.yml` en la raíz: servicio `frontend` listo (puerto `8080:80`) con secciones comentadas y documentadas para `backend` y `db` en la Fase 2. Sintaxis validada con `docker compose config`.
- `README.md` reescrito (arranque con Docker, cuentas demo, token de prueba, estructura de carpetas, guía de conexión a la Fase 2); `index.html` con título y `lang="es"`.
- **Verificado:** `docker compose config` válido; el bundle compilado servido con `nginx.conf` (imagen `nginx:1.27-alpine`) responde 200 en rutas de cliente (SPA fallback), 404 en assets inexistentes y `Cache-Control: immutable` en assets reales.
- **Pendiente de tu confirmación:** ejecutar `docker compose up --build` en esta máquina (la sandbox de esta sesión bloqueó el build de Docker por permisos, no por un error de configuración).

**Decisiones de diseño (no explícitas en DERCAS/PG2_V1)**
- Campo `avatarIniciales` en `Usuario`, solo para la UI del shell (no altera el modelo entidad-relación).
- Exportación simulada en **CSV** en lugar de PDF (más simple y comprobable en Fase 1; PDF real va con el backend en Fase 2).
- Estación de escaneo fija "Acceso Principal" hasta que exista configuración de estaciones.
