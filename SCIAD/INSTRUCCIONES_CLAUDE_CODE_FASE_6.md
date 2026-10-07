# INSTRUCCIONES PARA CLAUDE CODE — SCIAD · Fase 6
## Cierre diario de auditoría (opción A) + alinear con el documento PG2_V2.docx

> **Para quién es este archivo:** Claude Code, en la computadora del usuario. Es **autocontenido** y se aplica **después** de las Fases 1-5
> (`INSTRUCCIONES_CLAUDE_CODE_FASES_1_2.md` y `..._FASES_3_4_5.md`), que ya están aplicadas y funcionando.
>
> ⚠ Léelo **completo** (~850 líneas) antes de modificar nada.

## 0. REGLAS (obligatorias)

1. **Todo es LOCAL.** Prohibido: `git commit`, `push`, ramas, `stash`, `reset`. El commit lo hace el usuario cuando lo confirme. (`git apply` sin `--index` sí.)
2. **Docker está autorizado** (`docker compose up/ps/logs/exec`, `docker run` del SDK de .NET). **No** borres volúmenes (`down -v`) sin pedir confirmación.
3. **Aplica el código tal cual.** Si un bloque no encaja (archivo distinto, un `diff` no aplica): detente, muestra la diferencia y pregunta.
4. **Cambios fuera de este documento** solo para corregir un **fallo real** descubierto por las pruebas, pequeño y claro; explica causa y cambio. **No toques** el esquema de BD/migraciones.
5. **Restricción del usuario: el documento PG2_V2.docx NO se va a modificar** y será la base de la validación. Por eso esta fase (a) **revierte** tres cambios de las Fases 3-5 que contradicen lo que dice el
   documento y (b) agrega el cierre nocturno **sin cambiar** los criterios, endpoints ni alertas que el documento describe. **No cambies nada que el documento afirme** (ver Anexo A).
6. Al terminar: informe (Paso 8) y **espera** la confirmación del usuario para el commit.

## 1. Contexto: qué pidió el asesor y qué dice el documento

El asesor pidió: *si una persona se va sin marcar salida, a medianoche el sistema debe «reiniciar» y **marcar esa inconsistencia**.*

- **El «reinicio» de medianoche ya ocurre solo:** desde la Fase 4 el día de negocio es la fecha de Guatemala; a las 00:00 el primer escaneo del día nuevo es un ingreso.
- **El «marcar» ya existe pero es manual:** la verificación de integridad (CU-08, `POST /api/auditoria/verificar`, solo Admin) crea un hallazgo `acceso_sin_egreso` por cada ingreso de un día **anterior**
  sin egreso (PG2 Tabla 16). Falta que corra **sola** cada noche. El propio documento habla de «la verificación automática de su integridad».
- **Opción A (elegida):** solo **marcar** (hallazgo «abierto»). **No** se inserta ningún egreso inventado, **no** se cambian los criterios de la Tabla 16, **no** se agregan notificaciones nuevas
  (el documento dice que solo la *concentración inusual* notifica; las demás «quedan registradas para revisión posterior»), y el endpoint sigue siendo exclusivo del Administrador.

### Qué cambia en esta fase
| # | Cambio | Motivo |
|---|---|---|
| 1 | **Revertir** «Gerencia lee personas» (`PersonasController`, test RBAC, `verify-seguridad.mjs`) | El documento dice que **todos** los endpoints del módulo de gestión (incluido `/api/personas`) piden `RequireAdmin`, menos zonas; la evidencia habla de una matriz RBAC de 32 endpoints sin excepciones no documentadas. Trazabilidad y Reportes ya no piden personas si el rol no es Admin (sin errores 403 visibles). |
| 2 | **Quitar** los 4 tests de `GuatemalaTimeTests` | El documento reporta **162/162** pruebas unitarias (Tabla 23 y Figura 18). `dotnet test` debe volver a dar **162**. La hora de Guatemala sigue probada por el arnés `Sciad.TimeHarness`. |
| 3 | **Revertir** el límite de login ampliado en `docker-compose.yml` | El documento afirma limitación de intentos con «bloqueo en el 6.º intento». |
| 4 | **Cierre diario 00:05 (Guatemala)** + **sin duplicados** + `verify-cierre.mjs` | Pedido del asesor (opción A). |

Rutas relativas a `SCIAD/`. Los `git apply` se ejecutan **desde la raíz del repo** con `--directory=SCIAD`.

---

## 2. PASO 0 — Comprobaciones previas
1. `git status --short` y `git log --oneline -3`. Debe verse el trabajo de las Fases 3-5 (commiteado o no). Si hay cambios sin commit en archivos que toca este documento, **pregunta**.
2. Existen `sciad-backend/src/Sciad.Domain/Time/GuatemalaTime.cs`, `sciad-backend/seed-demo.mjs` y `sciad-frontend/tests-fase5/`.
3. El stack Docker puede estar arriba; no hace falta bajarlo.

---

## 3. PASO 1 — Revertir lo que contradice el documento

### 3.1 Gerencia vuelve a NO listar personas (backend)
#### 🔧 EDITAR (diff) — `sciad-backend/src/Sciad.Api/Controllers/PersonasController.cs`
Vuelve a `[Authorize(Policy = "RequireAdmin")]` a nivel de clase.
````diff
diff --git a/sciad-backend/src/Sciad.Api/Controllers/PersonasController.cs b/sciad-backend/src/Sciad.Api/Controllers/PersonasController.cs
index a91d856..0428a75 100644
--- a/sciad-backend/src/Sciad.Api/Controllers/PersonasController.cs
+++ b/sciad-backend/src/Sciad.Api/Controllers/PersonasController.cs
@@ -7,12 +7,9 @@ using Sciad.Application.Interfaces;
 
 namespace Sciad.Api.Controllers;
 
-/// <summary>
-/// Personas (Colaboradores/Visitantes). <b>Lectura</b> (listado): Administrador o Gerencia/Auditoría — necesaria para
-/// filtrar historial y reportes por colaborador (CU-06/CU-07). <b>Escritura</b> (crear/actualizar/baja lógica): solo Administrador.
-/// </summary>
+/// <summary>CRUD administrativo de personas (Colaboradores/Visitantes). Solo rol Administrador.</summary>
 [ApiController]
-[Authorize]
+[Authorize(Policy = "RequireAdmin")]
 [Route("api/personas")]
 public sealed class PersonasController : ControllerBase
 {
@@ -28,7 +25,6 @@ public sealed class PersonasController : ControllerBase
     /// y por <c>estado</c> (activo/inactivo).
     /// </summary>
     [HttpGet]
-    [Authorize(Policy = "RequireAdminOGerencia")]
     [ProducesResponseType(typeof(PaginadoDto<PersonaDto>), StatusCodes.Status200OK)]
     [ProducesResponseType(StatusCodes.Status400BadRequest)]
     public async Task<IActionResult> Listar(
@@ -44,7 +40,6 @@ public sealed class PersonasController : ControllerBase
 
     /// <summary>Crea una persona. 409 si el DPI ya existe.</summary>
     [HttpPost]
-    [Authorize(Policy = "RequireAdmin")]
     [ProducesResponseType(typeof(PersonaDto), StatusCodes.Status201Created)]
     [ProducesResponseType(StatusCodes.Status400BadRequest)]
     [ProducesResponseType(StatusCodes.Status409Conflict)]
@@ -57,7 +52,6 @@ public sealed class PersonasController : ControllerBase
     }
 
     [HttpPut("{id:int}")]
-    [Authorize(Policy = "RequireAdmin")]
     [ProducesResponseType(typeof(PersonaDto), StatusCodes.Status200OK)]
     [ProducesResponseType(StatusCodes.Status400BadRequest)]
     [ProducesResponseType(StatusCodes.Status404NotFound)]
@@ -70,7 +64,6 @@ public sealed class PersonasController : ControllerBase
 
     /// <summary>Alta/baja lógica: <c>{"estado":"activo|inactivo"}</c>. Nunca borrado físico.</summary>
     [HttpPatch("{id:int}/estado")]
-    [Authorize(Policy = "RequireAdmin")]
     [ProducesResponseType(typeof(PersonaDto), StatusCodes.Status200OK)]
     [ProducesResponseType(StatusCodes.Status400BadRequest)]
     [ProducesResponseType(StatusCodes.Status404NotFound)]
````

#### 🔧 EDITAR (diff) — `sciad-backend/tests/Sciad.Tests/Auth/RbacPolicyTests.cs`
Vuelve la matriz documentada: Personas → solo `RequireAdmin`.
````diff
diff --git a/sciad-backend/tests/Sciad.Tests/Auth/RbacPolicyTests.cs b/sciad-backend/tests/Sciad.Tests/Auth/RbacPolicyTests.cs
index 2f8ccbd..1c93097 100644
--- a/sciad-backend/tests/Sciad.Tests/Auth/RbacPolicyTests.cs
+++ b/sciad-backend/tests/Sciad.Tests/Auth/RbacPolicyTests.cs
@@ -89,7 +89,7 @@ public sealed class RbacPolicyTests
         foreach (var (c, acciones) in new[]
                  {
                      ("UsuariosController", new[] { "Listar", "Crear", "Actualizar", "CambiarEstado" }),
-                     ("PersonasController", new[] { "Crear", "Actualizar", "CambiarEstado" }),
+                     ("PersonasController", new[] { "Listar", "Crear", "Actualizar", "CambiarEstado" }),
                      ("PerfilesAccesoController", new[] { "Listar", "Crear", "Eliminar" }),
                      ("CredencialesController", new[] { "Listar", "Generar", "Reemitir", "Revocar" }),
                  })
@@ -100,9 +100,6 @@ public sealed class RbacPolicyTests
             }
         }
 
-        // --- Personas: lectura (Listar) Admin o Gerencia (filtros de historial/reportes por colaborador, CU-06/07); escritura solo Admin ---
-        Espera("PersonasController", "Listar", "RequireAdminOGerencia");
-
         // --- Zonas: lectura a cualquier rol autenticado, escritura solo Admin ---
         Espera("ZonasAccesoController", "Listar", "RequireZonaLectura");
         Espera("ZonasAccesoController", "Crear", "RequireAdmin");
````

#### 🔧 EDITAR (diff) — `sciad-backend/verify-seguridad.mjs`
`GET /api/personas` solo ADMIN (los 152 checks originales).
````diff
diff --git a/sciad-backend/verify-seguridad.mjs b/sciad-backend/verify-seguridad.mjs
index 5d04012..5d721a4 100644
--- a/sciad-backend/verify-seguridad.mjs
+++ b/sciad-backend/verify-seguridad.mjs
@@ -65,7 +65,7 @@ const MATRIZ = [
   ['POST',   '/api/zonas-acceso',                   {},   ['ADMIN'], false],
   ['PUT',    '/api/zonas-acceso/999999999',         { nombre: 'X', nivelSeguridad: 'ALTO' }, ['ADMIN'], false],
   ['PATCH',  '/api/zonas-acceso/999999999/estado',  { estado: 'inactivo' }, ['ADMIN'], false],
-  ['GET',    '/api/personas',                       null, ['ADMIN', 'GERENCIA'], false],
+  ['GET',    '/api/personas',                       null, ['ADMIN'], false],
   ['POST',   '/api/personas',                       {},   ['ADMIN'], false],
   ['PUT',    '/api/personas/999999999',             {},   ['ADMIN'], false],
   ['PATCH',  '/api/personas/999999999/estado',      {},   ['ADMIN'], false],
````

### 3.2 Frontend: solo el Administrador pide la lista de personas
#### 🔧 EDITAR (diff) — `sciad-frontend/src/app/features/management/traceability.component.ts`
Gerencia arma su filtro con los registros del historial (sin llamar a `/api/personas`).
````diff
diff --git a/sciad-frontend/src/app/features/management/traceability.component.ts b/sciad-frontend/src/app/features/management/traceability.component.ts
index 59f2740..17803d0 100644
--- a/sciad-frontend/src/app/features/management/traceability.component.ts
+++ b/sciad-frontend/src/app/features/management/traceability.component.ts
@@ -2,6 +2,7 @@
 // con filtros de servidor (personaId, zonaId, desde, hasta, tipo). Tipo real: ingreso/egreso.
 import { Component, computed, inject, OnInit, signal } from '@angular/core';
 import { AccessLogService, PersonasService, ZonasService } from '../../core/services/crud.service';
+import { AuthService } from '../../core/services/auth.service';
 import { RegistroHistorial } from '../../core/models/access-log.model';
 import { Zona } from '../../core/models/access.model';
 import { Card } from '../../shared/ui/card.component';
@@ -100,6 +101,7 @@ function badgeTipo(tipo: string): StatusKey {
 export class TraceabilityComponent implements OnInit {
   private readonly service = inject(AccessLogService);
   private readonly personasSvc = inject(PersonasService);
+  private readonly auth = inject(AuthService);
   private readonly zonasSvc = inject(ZonasService);
 
   protected readonly badgeTipo = badgeTipo;
@@ -109,8 +111,8 @@ export class TraceabilityComponent implements OnInit {
   protected horaDe(r: RegistroHistorial): string { return horaLocal(r.fecha, r.hora); }
   protected readonly loading = signal(true);
   protected readonly rows = signal<RegistroHistorial[]>([]);
-  // Opciones del filtro "persona": se usa el listado del backend (GET /api/personas permite lectura a Gerencia, CU-06).
-  // Si el backend lo negara (403), no se rompe la pantalla: se derivan de los registros ya cargados.
+  // Opciones del filtro "persona": el Administrador usa el listado completo del backend; Gerencia/Auditoría (que no tiene
+  // permiso sobre /api/personas) usa las personas que aparecen en los registros ya cargados.
   private readonly personasApi = signal<{ id: string; nombre: string }[]>([]);
   private readonly personasVistas = signal<{ id: string; nombre: string }[]>([]);
   protected readonly personas = computed(() => (this.personasApi().length ? this.personasApi() : this.personasVistas()));
@@ -125,10 +127,14 @@ export class TraceabilityComponent implements OnInit {
 
   ngOnInit(): void {
     this.load();
-    this.personasSvc.list().subscribe({
-      next: (ps) => this.personasApi.set(ps.map((p) => ({ id: String(p.id), nombre: p.nombre }))),
-      error: () => undefined, // sin permiso: se usan las personas vistas en los registros
-    });
+    // GET /api/personas es solo del Administrador (RequireAdmin, PG2 §4.3.2). Gerencia/Auditoría no lo pide: su filtro
+    // de personas se arma con los registros que ya consulta (historial).
+    if (this.auth.role() === 'ADMIN') {
+      this.personasSvc.list().subscribe({
+        next: (ps) => this.personasApi.set(ps.map((p) => ({ id: String(p.id), nombre: p.nombre }))),
+        error: () => undefined,
+      });
+    }
     this.zonasSvc.list().subscribe((zs) => this.zonas.set(zs));
   }
 
````

#### 🔧 EDITAR (diff) — `sciad-frontend/src/app/features/reports/reports.component.ts`
Para Gerencia el filtro de persona queda en «Todas».
````diff
diff --git a/sciad-frontend/src/app/features/reports/reports.component.ts b/sciad-frontend/src/app/features/reports/reports.component.ts
index 2e15f71..d47a651 100644
--- a/sciad-frontend/src/app/features/reports/reports.component.ts
+++ b/sciad-frontend/src/app/features/reports/reports.component.ts
@@ -4,6 +4,7 @@
 import { Component, computed, inject, OnInit, signal } from '@angular/core';
 import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
 import { ReportsService, PersonasService, ZonasService } from '../../core/services/crud.service';
+import { AuthService } from '../../core/services/auth.service';
 import { Reporte } from '../../core/models/reporte.model';
 import { Persona } from '../../core/models/persona.model';
 import { Zona } from '../../core/models/access.model';
@@ -105,6 +106,7 @@ import { ToastService } from '../../shared/ui/toast.service';
 export class ReportsComponent implements OnInit {
   private readonly service = inject(ReportsService);
   private readonly personasSvc = inject(PersonasService);
+  private readonly auth = inject(AuthService);
   private readonly zonasSvc = inject(ZonasService);
   private readonly fb = inject(FormBuilder);
   private readonly toast = inject(ToastService);
@@ -148,7 +150,10 @@ export class ReportsComponent implements OnInit {
 
   ngOnInit(): void {
     this.load();
-    this.personasSvc.list().subscribe({ next: (ps) => this.personas.set(ps), error: () => undefined }); // sin permiso: lista vacía, sin romper
+    // Solo el Administrador tiene permiso sobre /api/personas (PG2 §4.3.2); para Gerencia el filtro de persona queda en "Todas".
+    if (this.auth.role() === 'ADMIN') {
+      this.personasSvc.list().subscribe({ next: (ps) => this.personas.set(ps), error: () => undefined });
+    }
     this.zonasSvc.list().subscribe((zs) => this.zonas.set(zs));
   }
 
````

#### 🔧 EDITAR (diff) — `sciad-frontend/tests-fase5/mock-backend.mjs`
El backend simulado vuelve a la regla del documento.
````diff
diff --git a/sciad-frontend/tests-fase5/mock-backend.mjs b/sciad-frontend/tests-fase5/mock-backend.mjs
index 475c7c7..02de071 100644
--- a/sciad-frontend/tests-fase5/mock-backend.mjs
+++ b/sciad-frontend/tests-fase5/mock-backend.mjs
@@ -51,7 +51,8 @@ export function createBackend() {
 
     if (p === '/api/zonas-acceso' && m === 'GET') return json(res, S.zonas.map(zonaDto));
     if (p === '/api/zonas-acceso' && m === 'POST') { if (!only('ADMIN')) return; const b = await body(req); const z = { id: id(), estado: 'activo', capacidad: null, ...b }; S.zonas.push(z); return json(res, zonaDto(z), 201); }
-    if (p === '/api/personas' && m === 'GET') { if (!only('ADMIN', 'GERENCIA')) return; return json(res, { items: S.personas, total: S.personas.length, pagina: 1, tamanoPagina: 500, totalPaginas: 1 }); }   // sin tope (como el backend)
+    if (p === '/api/personas' && m === 'GET') { if (!only('ADMIN')) return;   // PG2 §4.3.2: todo el módulo de gestión es RequireAdmin
+    return json(res, { items: S.personas, total: S.personas.length, pagina: 1, tamanoPagina: 500, totalPaginas: 1 }); }   // sin tope (como el backend)
     if (p === '/api/personas' && m === 'POST') { if (!only('ADMIN')) return; const b = await body(req); if (S.personas.some((x) => x.dpiCodigo === b.dpiCodigo)) return problem(res, 409, 'CONFLICT', 'El DPI ya existe.'); const x = { id: id(), estado: 'activo', ...b }; S.personas.push(x); return json(res, x, 201); }
     let mm;
     if ((mm = p.match(/^\/api\/personas\/(\d+)\/estado$/)) && m === 'PATCH') { const x = S.personas.find((q) => q.id === mm[1]); x.estado = (await body(req)).estado; return json(res, x); }
````

### 3.3 Volver a 162 pruebas unitarias
**Borra** el archivo `sciad-backend/tests/Sciad.Tests/Services/GuatemalaTimeTests.cs` (sus 4 comprobaciones ya las cubre `Sciad.TimeHarness`, que NO forma parte de `dotnet test Sciad.Tests`).
**Conserva** el `using` global `Sciad.Domain.Time` en `Sciad.Tests.csproj` y los reemplazos `GuatemalaTime.Now` de los otros 5 archivos de test (siguen siendo necesarios).

### 3.4 `docker-compose.yml`: quitar el límite de login ampliado y exponer la hora del cierre (solo para pruebas)
#### 🔧 EDITAR (diff) — `docker-compose.yml`
Se eliminan `RateLimit__LoginPermitLimit/WindowSeconds` (vuelve el límite estricto del documento) y se añade `Auditoria__CierreDiario__Hora` (por defecto 00:05).
````diff
diff --git a/docker-compose.yml b/docker-compose.yml
index 2e0f2cb..210cf4a 100644
--- a/docker-compose.yml
+++ b/docker-compose.yml
@@ -40,11 +40,8 @@ services:
       - ConnectionStrings__Postgres=Host=db;Port=5432;Database=${POSTGRES_DB};Username=${POSTGRES_USER};Password=${POSTGRES_PASSWORD};Maximum Pool Size=${POSTGRES_MAX_POOL:-400}
       - Jwt__Secreto=${SCIAD_JWT_SECRET}
       - Cors__Origins=${SCIAD_CORS_ORIGINS}
-      # Tras el nginx del frontend todos los clientes llegan con la IP del proxy: el límite de login (5 por 5 min,
-      # SEC-04) se compartiría entre TODOS los usuarios. En desarrollo se amplía; en producción se usa
-      # KnownProxies (docker-compose.prod.yml) y el límite estricto.
-      - RateLimit__LoginPermitLimit=${RATE_LIMIT_LOGIN_PERMIT:-30}
-      - RateLimit__LoginWindowSeconds=${RATE_LIMIT_LOGIN_WINDOW:-300}
+      # Hora (Guatemala) del cierre diario de auditoría. Por defecto 00:05; se cambia solo para probarlo (verify-cierre.mjs).
+      - Auditoria__CierreDiario__Hora=${AUDITORIA_CIERRE_HORA:-00:05}
     depends_on:
       db:
         condition: service_healthy
````

> El overlay `docker-compose.tunnel.yml` conserva su `RateLimit__LoginPermitLimit=30` a propósito: solo se usa para pruebas con el túnel, no para el stack normal.

---

## 4. PASO 2 — Cierre diario de auditoría (opción A)

### 4.1 `GuatemalaTime`: tiempo hasta la próxima hora fija
#### 🔧 EDITAR (diff) — `sciad-backend/src/Sciad.Domain/Time/GuatemalaTime.cs`

````diff
diff --git a/sciad-backend/src/Sciad.Domain/Time/GuatemalaTime.cs b/sciad-backend/src/Sciad.Domain/Time/GuatemalaTime.cs
index 92aa38d..ea83ea3 100644
--- a/sciad-backend/src/Sciad.Domain/Time/GuatemalaTime.cs
+++ b/sciad-backend/src/Sciad.Domain/Time/GuatemalaTime.cs
@@ -34,6 +34,22 @@ public static class GuatemalaTime
     public static DateTime FromUtc(DateTime utc) =>
         DateTime.SpecifyKind(utc + Offset, DateTimeKind.Unspecified);
 
+    /// <summary>
+    /// Tiempo que falta (siempre > 0 y ≤ 24 h) hasta la próxima vez que el reloj de Guatemala marque <paramref name="hora"/>.
+    /// Si ya es exactamente esa hora, la próxima ocurrencia es la de mañana. Lo usa el cierre diario de auditoría.
+    /// </summary>
+    public static TimeSpan HastaProximaHora(TimeOnly hora)
+    {
+        var ahora = Now;
+        var objetivo = ahora.Date + hora.ToTimeSpan();
+        if (objetivo <= ahora)
+        {
+            objetivo = objetivo.AddDays(1);
+        }
+
+        return objetivo - ahora;
+    }
+
     /// <summary>Convierte fecha+hora de Guatemala al instante UTC equivalente (Kind = Utc).</summary>
     public static DateTime ToUtc(DateOnly fecha, TimeOnly hora)
     {
````

### 4.2 Hallazgos sin duplicados (regla pura, probada en el arnés)
La verificación revisa **todos** los días anteriores; sin esta regla, ejecutarla cada noche volvería a crear el mismo hallazgo cada vez.
#### 📄 NUEVO — `sciad-backend/src/Sciad.Application/Services/HallazgosUnicos.cs`

````csharp
using Sciad.Domain.Entities;

namespace Sciad.Application.Services;

/// <summary>
/// Evita registrar dos veces el mismo hallazgo de auditoría. La verificación de integridad ahora se ejecuta también cada
/// noche (cierre diario) y la comprobación «ingreso sin egreso» revisa TODOS los días anteriores (PG2 Tabla 16), por lo que
/// sin esta regla el mismo caso se volvería a crear cada noche. La identidad de un hallazgo es (tipo, persona, descripción):
/// la descripción incluye la fecha del ingreso (o el id del registro), así que es estable entre ejecuciones.
/// La «concentración inusual» NO se deduplica: es un evento puntual y su texto puede repetirse legítimamente en otro momento.
/// </summary>
public static class HallazgosUnicos
{
    /// <summary>¿Este tipo de hallazgo se registra una sola vez por caso?</summary>
    public static bool EsDeduplicable(string tipo) =>
        tipo is "acceso_sin_egreso" or "registro_duplicado" or "campo_inconsistente";

    /// <summary>Devuelve solo los hallazgos que aún no existen (y quita repetidos dentro del propio lote).</summary>
    public static List<Auditoria> Filtrar(
        IEnumerable<Auditoria> candidatos,
        IEnumerable<(string Tipo, int? PersonaId, string Descripcion)> existentes)
    {
        var vistos = new HashSet<(string, int?, string)>(existentes);
        var nuevos = new List<Auditoria>();
        foreach (var h in candidatos)
        {
            if (!EsDeduplicable(h.Tipo))
            {
                nuevos.Add(h);
                continue;
            }

            if (vistos.Add((h.Tipo, h.PersonaId, h.Descripcion)))
            {
                nuevos.Add(h);
            }
        }

        return nuevos;
    }
}
````

El repositorio aplica la regla antes de insertar (la lógica de `AuditoriaService` y sus tests **no cambian**):
#### 🔧 EDITAR (diff) — `sciad-backend/src/Sciad.Infrastructure/Repositories/AuditoriaRepository.cs`

````diff
diff --git a/sciad-backend/src/Sciad.Infrastructure/Repositories/AuditoriaRepository.cs b/sciad-backend/src/Sciad.Infrastructure/Repositories/AuditoriaRepository.cs
index 7d007c1..6f6642a 100644
--- a/sciad-backend/src/Sciad.Infrastructure/Repositories/AuditoriaRepository.cs
+++ b/sciad-backend/src/Sciad.Infrastructure/Repositories/AuditoriaRepository.cs
@@ -1,5 +1,6 @@
 using Microsoft.EntityFrameworkCore;
 using Sciad.Application.Interfaces;
+using Sciad.Application.Services;
 using Sciad.Domain.Entities;
 using Sciad.Infrastructure.Persistence;
 
@@ -38,9 +39,27 @@ public sealed class AuditoriaRepository : IAuditoriaRepository
 
     public async Task<List<Auditoria>> AgregarHallazgosAsync(List<Auditoria> hallazgos, CancellationToken ct = default)
     {
-        _db.Auditorias.AddRange(hallazgos);
+        // Descarta los que ya existen (la verificación corre también cada noche y revisa todos los días anteriores).
+        var descripciones = hallazgos
+            .Where(h => HallazgosUnicos.EsDeduplicable(h.Tipo))
+            .Select(h => h.Descripcion)
+            .Distinct()
+            .ToList();
+
+        var existentes = new List<(string Tipo, int? PersonaId, string Descripcion)>();
+        if (descripciones.Count > 0)
+        {
+            var filas = await _db.Auditorias.AsNoTracking()
+                .Where(a => descripciones.Contains(a.Descripcion))
+                .Select(a => new { a.Tipo, a.PersonaId, a.Descripcion })
+                .ToListAsync(ct);
+            existentes.AddRange(filas.Select(f => (f.Tipo, f.PersonaId, f.Descripcion)));
+        }
+
+        var nuevos = HallazgosUnicos.Filtrar(hallazgos, existentes);
+        _db.Auditorias.AddRange(nuevos);
         await _db.SaveChangesAsync(ct);
-        return hallazgos;
+        return nuevos;
     }
 
     public async Task<Auditoria> ActualizarAsync(Auditoria hallazgo, CancellationToken ct = default)
````

### 4.3 Servicio en segundo plano (00:05 hora de Guatemala)
#### 📄 NUEVO — `sciad-backend/src/Sciad.Api/Background/CierreDiarioHostedService.cs`
Ejecuta `IAuditoriaService.VerificarAsync` (la misma verificación del endpoint). Configurable con `Auditoria:CierreDiario:Habilitado` y `:Hora`.
````csharp
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Sciad.Application.Interfaces;
using Sciad.Domain.Time;

namespace Sciad.Api.Background;

/// <summary>
/// Cierre diario de auditoría (opción A): cada noche, a las 00:05 hora de Guatemala, ejecuta la MISMA verificación de
/// integridad que el endpoint POST /api/auditoria/verificar (PG2 Tabla 16). El «reinicio» de la medianoche ya ocurre solo
/// (el día de negocio es la fecha de Guatemala): el primer escaneo del nuevo día es un ingreso. Lo que esta tarea añade es
/// que los ingresos del día anterior sin egreso quedan <b>marcados</b> como hallazgos «acceso_sin_egreso» (estado abierto)
/// sin que el Administrador tenga que pulsar «Verificar integridad». No inserta registros de egreso ni envía alertas
/// adicionales: solo registra los hallazgos, igual que la verificación manual.
///
/// Configuración (opcional): <c>Auditoria:CierreDiario:Habilitado</c> (true) y <c>Auditoria:CierreDiario:Hora</c> ("00:05").
/// </summary>
public sealed class CierreDiarioHostedService : BackgroundService
{
    public const string Seccion = "Auditoria:CierreDiario";
    public static readonly TimeOnly HoraPorDefecto = new(0, 5);

    private readonly IServiceScopeFactory _scopes;
    private readonly IConfiguration _config;
    private readonly ILogger<CierreDiarioHostedService> _logger;

    public CierreDiarioHostedService(
        IServiceScopeFactory scopes, IConfiguration config, ILogger<CierreDiarioHostedService> logger)
    {
        _scopes = scopes;
        _config = config;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_config.GetValue($"{Seccion}:Habilitado", true))
        {
            _logger.LogInformation("Cierre diario de auditoría deshabilitado por configuración.");
            return;
        }

        var texto = _config[$"{Seccion}:Hora"];
        var hora = HoraPorDefecto;
        if (!string.IsNullOrWhiteSpace(texto) && !TimeOnly.TryParse(texto, out hora))
        {
            _logger.LogWarning("Hora de cierre diario inválida ('{Hora}'); se usa 00:05.", texto);
            hora = HoraPorDefecto;
        }

        _logger.LogInformation("Cierre diario de auditoría programado a las {Hora} (hora de Guatemala).", hora);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(GuatemalaTime.HastaProximaHora(hora), stoppingToken);
                await EjecutarAsync(stoppingToken);
                // Margen para no volver a disparar en el mismo instante si el reloj se ajusta.
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    /// <summary>Ejecuta la verificación de integridad una vez. Nunca lanza: un fallo se registra y se reintenta mañana.</summary>
    public async Task EjecutarAsync(CancellationToken ct)
    {
        try
        {
            using var scope = _scopes.CreateScope();
            var auditoria = scope.ServiceProvider.GetRequiredService<IAuditoriaService>();
            var resultado = await auditoria.VerificarAsync(ct);
            if (resultado.Exitoso)
            {
                _logger.LogInformation(
                    "Cierre diario de auditoría: {Hallazgos} hallazgo(s) nuevo(s) ({Detalle}).",
                    resultado.Dato!.HallazgosCreados,
                    string.Join(", ", resultado.Dato.PorTipo.Select(kv => $"{kv.Key}={kv.Value}")));
            }
            else
            {
                _logger.LogWarning("Cierre diario de auditoría no pudo completarse: {Mensaje}", resultado.Mensaje);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Falló el cierre diario de auditoría; se reintentará mañana.");
        }
    }
}
````

#### 🔧 EDITAR (diff) — `sciad-backend/src/Sciad.Api/Program.cs`
Registro del servicio (una línea).
````diff
diff --git a/sciad-backend/src/Sciad.Api/Program.cs b/sciad-backend/src/Sciad.Api/Program.cs
index 47ef572..65aba29 100644
--- a/sciad-backend/src/Sciad.Api/Program.cs
+++ b/sciad-backend/src/Sciad.Api/Program.cs
@@ -33,6 +33,9 @@ builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptio
 builder.Services.AddApplication();
 builder.Services.AddInfrastructure(builder.Configuration);
 
+// Cierre diario de auditoría (00:05 hora de Guatemala): marca los ingresos sin egreso del día anterior.
+builder.Services.AddHostedService<Sciad.Api.Background.CierreDiarioHostedService>();
+
 // Respuesta 400 de validación de modelo también con Problem Details consistente (code + message).
 builder.Services.AddControllers()
     .ConfigureApiBehaviorOptions(o => o.InvalidModelStateResponseFactory = context =>
````

### 4.4 Arnés de regresión ampliado (escenario de medianoche con el código real)
#### 🔧 EDITAR (diff) — `sciad-backend/tests/Sciad.TimeHarness/Sciad.TimeHarness.csproj`
Ahora referencia `Sciad.Api` (para probar el servicio en segundo plano).
````diff
diff --git a/sciad-backend/tests/Sciad.TimeHarness/Sciad.TimeHarness.csproj b/sciad-backend/tests/Sciad.TimeHarness/Sciad.TimeHarness.csproj
index d3f07b9..8a98f55 100644
--- a/sciad-backend/tests/Sciad.TimeHarness/Sciad.TimeHarness.csproj
+++ b/sciad-backend/tests/Sciad.TimeHarness/Sciad.TimeHarness.csproj
@@ -9,9 +9,14 @@
     <IsPackable>false</IsPackable>
   </PropertyGroup>
 
+  <ItemGroup>
+    <FrameworkReference Include="Microsoft.AspNetCore.App" />
+  </ItemGroup>
+
   <ItemGroup>
     <ProjectReference Include="..\..\src\Sciad.Domain\Sciad.Domain.csproj" />
     <ProjectReference Include="..\..\src\Sciad.Application\Sciad.Application.csproj" />
+    <ProjectReference Include="..\..\src\Sciad.Api\Sciad.Api.csproj" />
   </ItemGroup>
 
 </Project>
````

#### 🔧 EDITAR (diff) — `sciad-backend/tests/Sciad.TimeHarness/Program.cs`
Secciones [4] a [6]: hora del cierre, persona que no marca salida, sin duplicados, servicio resistente a fallos.
````diff
diff --git a/sciad-backend/tests/Sciad.TimeHarness/Program.cs b/sciad-backend/tests/Sciad.TimeHarness/Program.cs
index f2a1b91..cf43231 100644
--- a/sciad-backend/tests/Sciad.TimeHarness/Program.cs
+++ b/sciad-backend/tests/Sciad.TimeHarness/Program.cs
@@ -1,8 +1,11 @@
 // Arnés de regresión de la Fase 4 (zona horaria de Guatemala). Ejecutar: dotnet run --project tests/Sciad.TimeHarness
-// Usa el código REAL de RegistrosAccesoService/AuditoriaService con repositorios en memoria y un reloj simulado.
+// Usa el código REAL de RegistrosAccesoService/AuditoriaService/CierreDiario con repositorios en memoria y un reloj simulado.
 // Devuelve código de salida 0 si todo pasa. No requiere base de datos.
 using System.Reflection;
+using Microsoft.Extensions.Configuration;
+using Microsoft.Extensions.DependencyInjection;
 using Microsoft.Extensions.Logging.Abstractions;
+using Sciad.Api.Background;
 using Sciad.Application.Interfaces;
 using Sciad.Application.Services;
 using Sciad.Domain.Entities;
@@ -105,6 +108,81 @@ public static class Harness
         Check("hallazgo con fecha de Guatemala (21)", hallazgos.All(h => h.Fecha == new DateOnly(2026, 8, 21)));
         Check("genera 1 notificación de concentración", nots.Count == 1 && nots[0].Tipo == "concentracion");
 
+        // ───────────────────────── Cierre diario de medianoche (opción A) ─────────────────────────
+        Console.WriteLine("[4] Cierre diario: ¿cuánto falta para las 00:05 de Guatemala?");
+        var hora0005 = new TimeOnly(0, 5);
+        clock.Now = Z("2026-08-22T05:00:00"); Check("23:00 GT → faltan 1 h 05 min", GuatemalaTime.HastaProximaHora(hora0005) == TimeSpan.FromMinutes(65), GuatemalaTime.HastaProximaHora(hora0005).ToString());
+        clock.Now = Z("2026-08-22T06:10:00"); Check("00:10 GT → faltan 23 h 55 min (mañana)", GuatemalaTime.HastaProximaHora(hora0005) == new TimeSpan(23, 55, 0));
+        clock.Now = Z("2026-08-22T06:04:59"); Check("00:04:59 GT → falta 1 segundo", GuatemalaTime.HastaProximaHora(hora0005) == TimeSpan.FromSeconds(1));
+        clock.Now = Z("2026-08-22T06:05:00"); Check("00:05:00 GT exactas → la próxima es mañana (24 h)", GuatemalaTime.HastaProximaHora(hora0005) == TimeSpan.FromHours(24));
+
+        Console.WriteLine("[5] Persona que se va sin marcar salida: se marca a la medianoche");
+        var juan = new Persona { Id = 7, Nombre = "Juan Pérez López", DpiCodigo = "D1", Tipo = 1, Estado = "activo" };
+        var ana = new Persona { Id = 8, Nombre = "Ana Lucía Castillo", DpiCodigo = "D2", Tipo = 1, Estado = "activo" };
+        var z1 = new ZonaAcceso { Id = 1, Nombre = "Entrada Principal", NivelSeguridad = "MEDIO", Estado = "activo" };
+        var dia = new DateOnly(2026, 8, 21);
+        var regs = new List<RegistroAcceso>
+        {
+            new() { Id = 1, PersonaId = 7, Persona = juan, ZonaId = 1, Zona = z1, Fecha = dia, Hora = new TimeOnly(7, 15), Tipo = "ingreso" },            // Juan: SIN egreso
+            new() { Id = 2, PersonaId = 8, Persona = ana,  ZonaId = 1, Zona = z1, Fecha = dia, Hora = new TimeOnly(8, 0),  Tipo = "ingreso" },
+            new() { Id = 3, PersonaId = 8, Persona = ana,  ZonaId = 1, Zona = z1, Fecha = dia, Hora = new TimeOnly(17, 30), Tipo = "egreso" },            // Ana: completo
+        };
+        var guardados = new List<Auditoria>();
+        var nots2 = new List<Notificacion>();
+        var audN = new AuditoriaService(
+            Fake.Make<IRegistroAccesoRepository>(new()
+            {
+                // misma lógica que RegistroAccesoRepository.IngresosSinEgresoAsync
+                ["IngresosSinEgresoAsync"] = a => { var corte = (DateOnly)a[0]!; return regs.Where(r => r.Tipo == "ingreso" && r.Fecha < corte && !regs.Any(e => e.PersonaId == r.PersonaId && e.Fecha == r.Fecha && e.Tipo == "egreso")).GroupBy(r => (r.PersonaId, r.Fecha)).Select(g => g.First()).ToList(); },
+                ["RegistrosDuplicadosAsync"] = a => new List<RegistroAcceso>(), ["RegistrosInconsistentesAsync"] = a => new List<RegistroAcceso>(),
+                ["ListarIngresosDelDiaAsync"] = a => new List<RegistroAcceso>(),
+            }),
+            Fake.Make<IAuditoriaRepository>(new() { ["AgregarHallazgosAsync"] = a => { var l = (List<Auditoria>)a[0]!; guardados.AddRange(l); return l; } }),
+            Fake.Make<INotificacionRepository>(new() { ["AgregarAsync"] = a => { nots2.Add((Notificacion)a[0]!); return a[0]; } }),
+            Fake.Make<IUsuarioRepository>(new() { ["ObtenerActivoPorRolAsync"] = a => null }),
+            NullLogger<AuditoriaService>.Instance);
+
+        clock.Now = Z("2026-08-22T05:59:00");   // 23:59 del mismo día 21 en Guatemala
+        guardados.Clear(); audN.VerificarAsync().Wait();
+        Check("23:59 del mismo día: el ingreso del día en curso NO es anomalía (PG2 Tabla 16)", guardados.Count == 0, $"hallazgos={guardados.Count}");
+
+        clock.Now = Z("2026-08-22T06:05:00");   // 00:05 del día 22 en Guatemala = cierre diario
+        guardados.Clear(); audN.VerificarAsync().Wait();
+        var sinEgreso = guardados.Where(h => h.Tipo == "acceso_sin_egreso").ToList();
+        Check("00:05: se marca UN hallazgo «acceso_sin_egreso» (solo Juan, no Ana)", sinEgreso.Count == 1 && sinEgreso[0].PersonaId == 7, string.Join(" | ", sinEgreso.Select(h => h.Descripcion)));
+        Check("el hallazgo nace «abierto», con fecha de Guatemala y menciona el día del ingreso", sinEgreso.Count == 1 && sinEgreso[0].Estado == "abierto" && sinEgreso[0].Fecha == new DateOnly(2026, 8, 22) && sinEgreso[0].Descripcion.Contains("2026-08-21"));
+        Check("no se envía alerta/notificación por «sin egreso» (solo la concentración notifica, PG2 §4.3.4)", nots2.Count == 0);
+        Check("no se inserta ningún registro de egreso automático (la bitácora no se altera)", regs.Count == 3);
+
+        var existentes = guardados.Select(h => (h.Tipo, h.PersonaId, h.Descripcion)).ToList();
+        guardados.Clear(); audN.VerificarAsync().Wait();            // la noche siguiente: el mismo caso vuelve a detectarse…
+        var nuevosNoche2 = HallazgosUnicos.Filtrar(guardados, existentes);
+        Check("la noche siguiente el MISMO caso no se vuelve a crear (sin duplicados)", nuevosNoche2.Count == 0, $"nuevos={nuevosNoche2.Count}");
+
+        regs.Add(new RegistroAcceso { Id = 4, PersonaId = 8, Persona = ana, ZonaId = 1, Zona = z1, Fecha = new DateOnly(2026, 8, 22), Hora = new TimeOnly(9, 0), Tipo = "ingreso" });   // Ana olvida salir el día 22
+        clock.Now = Z("2026-08-23T06:05:00");
+        guardados.Clear(); audN.VerificarAsync().Wait();
+        var nuevosNoche3 = HallazgosUnicos.Filtrar(guardados, existentes);
+        Check("un caso NUEVO (Ana el día 22) sí se marca; el de Juan no se repite", nuevosNoche3.Count == 1 && nuevosNoche3[0].PersonaId == 8, string.Join(" | ", nuevosNoche3.Select(h => h.PersonaId + ":" + h.Descripcion.Length)));
+        var conc = new Auditoria { Tipo = "concentracion", Descripcion = "Concentración X", Estado = "abierto", Fecha = dia };
+        Check("«concentración» no se deduplica (es un evento puntual)", HallazgosUnicos.Filtrar(new[] { conc }, new[] { ("concentracion", (int?)null, "Concentración X") }).Count == 1);
+
+        Console.WriteLine("[6] Servicio en segundo plano");
+        var llamadas = 0; var lanzar = false;
+        var servicios = new ServiceCollection();
+        servicios.AddScoped(_ => Fake.Make<IAuditoriaService>(new() { ["VerificarAsync"] = a => { llamadas++; if (lanzar) throw new InvalidOperationException("BD caída"); return new Sciad.Application.Services.ServicioResultado<Sciad.Application.Dtos.Auditoria.VerificacionAuditoriaResultadoDto>(true, new Sciad.Application.Dtos.Auditoria.VerificacionAuditoriaResultadoDto(1, 0, new Dictionary<string, int> { ["acceso_sin_egreso"] = 1 })); } }));
+        var proveedor = servicios.BuildServiceProvider();
+        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Auditoria:CierreDiario:Hora"] = "00:05" }).Build();
+        var cierre = new CierreDiarioHostedService(proveedor.GetRequiredService<IServiceScopeFactory>(), cfg, NullLogger<CierreDiarioHostedService>.Instance);
+        cierre.EjecutarAsync(CancellationToken.None).Wait();
+        Check("EjecutarAsync llama una vez a la verificación de auditoría", llamadas == 1);
+        lanzar = true; var ok = true; try { cierre.EjecutarAsync(CancellationToken.None).Wait(); } catch { ok = false; }
+        Check("si la verificación falla, el servicio NO se cae (reintenta mañana)", ok && llamadas == 2);
+        var apagado = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Auditoria:CierreDiario:Habilitado"] = "false" }).Build();
+        var inactivo = new CierreDiarioHostedService(proveedor.GetRequiredService<IServiceScopeFactory>(), apagado, NullLogger<CierreDiarioHostedService>.Instance);
+        inactivo.StartAsync(CancellationToken.None).Wait(); inactivo.StopAsync(CancellationToken.None).Wait();
+        Check("con Habilitado=false no programa nada", llamadas == 2);
+
         Console.WriteLine($"\nRESULTADO: {pass} ✓  {fail} ✗");
         return fail == 0 ? 0 : 1;
     }
````

### 4.5 Verificación REAL del cierre con la base de datos
#### 📄 NUEVO — `sciad-backend/verify-cierre.mjs`
~4 minutos: adelanta la hora del cierre, recrea el backend, espera a que dispare solo y lo restaura.
````js
// Verificación REAL del cierre diario de auditoría (opción A) contra el stack Docker.
//   node verify-cierre.mjs            (API en http://localhost:3000; compose en ../docker-compose.yml)
//
// Comprueba, con la BD real:
//   1) Un ingreso de AYER sin egreso se marca como hallazgo «acceso_sin_egreso» (verificación manual = misma lógica).
//   2) Repetir la verificación NO duplica el hallazgo.
//   3) El cierre AUTOMÁTICO (servicio en segundo plano) lo marca solo, sin que nadie pulse nada: se adelanta la hora del
//      cierre unos minutos (variable AUDITORIA_CIERRE_HORA), se recrea el backend, y se espera a que dispare. (~4 min)
//   4) Restaura la hora por defecto (00:05).
// Siembra los ingresos de ayer por psql (el API no permite fechas pasadas), igual que verify-2d.mjs.
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.SCIAD_BASE ?? 'http://localhost:3000';
const PG = { ...process.env, PGPASSWORD: process.env.PGPASSWORD ?? 'sciad_local_dev_2026' };
const PSQL = (sql) => execSync(`docker exec sciad-db psql -U sciad -d sciad -v ON_ERROR_STOP=1 -c "${sql}"`, { env: PG, encoding: 'utf8' });
const COMPOSE = (args, env = {}) => execSync(`docker compose ${args}`, { cwd: `${HERE}/..`, env: { ...process.env, ...env }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const gt = (extraMs = 0) => new Date(Date.now() - 6 * 3600e3 + extraMs);          // reloj de Guatemala (UTC-6) leído en UTC
const hm = (d) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
const ayer = new Date(Date.now() - 6 * 3600e3 - 86400e3).toISOString().slice(0, 10);

let pass = 0, fail = 0;
const check = (n, c, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗ FALLO'} ${n}${x ? '  → ' + x : ''}`); };
async function call(method, path, { token, body } = {}) {
  const r = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch { /* sin cuerpo */ }
  return { status: r.status, body: j };
}
const items = (b) => (Array.isArray(b) ? b : b?.items ?? []);
async function esperarSalud(ms = 120000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const r = await fetch(`${BASE}/api/health`); if (r.ok) return true; } catch { /* aún no */ } await sleep(2000); } return false; }
async function hallazgos(token, nombre) { const r = await call('GET', '/api/auditoria?tipo=acceso_sin_egreso&tamanoPagina=100', { token }); return items(r.body).filter((h) => (h.descripcion ?? '').includes(nombre)); }

const R = Date.now().toString().slice(-8);
console.log(`\nCierre diario de auditoría → ${BASE}  (ayer en Guatemala = ${ayer})\n`);
const login = await call('POST', '/api/auth/login', { body: { email: 'admin@sciad.gt', password: 'sciad123' } });
if (!login.body?.token) { console.error('✗ No se pudo iniciar sesión como admin.'); process.exit(1); }
const T = login.body.token, adminId = login.body.user.id;
const zona = items((await call('GET', '/api/zonas-acceso', { token: T })).body).find((z) => z.estado === 'activo');
if (!zona) { console.error('✗ No hay ninguna zona activa (ejecuta seed-demo.mjs).'); process.exit(1); }
const crear = async (k) => (await call('POST', '/api/personas', { token: T, body: { nombre: `ZZ CIERRE ${k} ${R}`, dpiCodigo: `CIE-${R}-${k}`, tipo: 1 } })).body;
const A = await crear('A'), B = await crear('B');
const sembrar = (p) => PSQL(`INSERT INTO registros_acceso (persona_id, zona_id, fecha, hora, tipo, usuario_id) VALUES (${p.id}, ${zona.id}, '${ayer}', '08:00:00', 'ingreso', ${adminId});`);

console.log('[1] Verificación manual (misma lógica que el cierre automático)');
check('se sembró el ingreso de ayer de la persona A', /INSERT 0 1/.test(sembrar(A)));
const v1 = await call('POST', '/api/auditoria/verificar', { token: T });
check('POST /auditoria/verificar → 200', v1.status === 200, JSON.stringify(v1.body));
let hA = await hallazgos(T, `ZZ CIERRE A ${R}`);
check('el ingreso de ayer sin egreso queda marcado «acceso_sin_egreso» (abierto)', hA.length === 1 && hA[0].estado === 'abierto', `${hA.length} hallazgo(s)`);
check('la descripción menciona el día del ingreso', hA[0]?.descripcion.includes(ayer));

console.log('\n[2] Sin duplicados');
await call('POST', '/api/auditoria/verificar', { token: T });
await call('POST', '/api/auditoria/verificar', { token: T });
hA = await hallazgos(T, `ZZ CIERRE A ${R}`);
check('tras 2 verificaciones más, sigue habiendo UN solo hallazgo para A', hA.length === 1, `${hA.length}`);

console.log('\n[3] Cierre AUTOMÁTICO (servicio en segundo plano)');
const objetivo = gt(150000);                                  // dentro de ~2,5 min en hora de Guatemala
const horaCierre = hm(objetivo);
console.log(`  adelanto el cierre a las ${horaCierre} (Guatemala) y recreo el backend…`);
COMPOSE('up -d backend', { AUDITORIA_CIERRE_HORA: horaCierre });
check('el backend vuelve a estar sano', await esperarSalud());
const logs0 = execSync('docker logs sciad-backend 2>&1', { encoding: 'utf8', maxBuffer: 20e6 });
check('el log anuncia el cierre diario programado a esa hora', logs0.includes('Cierre diario de auditoría programado') && logs0.includes(horaCierre), (logs0.match(/Cierre diario de auditoría programado[^\n]*/) ?? [''])[0].slice(0, 120));
check('se sembró el ingreso de ayer de la persona B (DESPUÉS de reiniciar)', /INSERT 0 1/.test(sembrar(B)));
check('antes de la hora, B todavía NO está marcada', (await hallazgos(T, `ZZ CIERRE B ${R}`)).length === 0);
// ⚠ el login del script ya no sirve si el backend se recreó con otra clave JWT: se vuelve a iniciar sesión
const T2 = (await call('POST', '/api/auth/login', { body: { email: 'admin@sciad.gt', password: 'sciad123' } })).body?.token ?? T;
console.log('  esperando a que dispare el cierre (máx. 5 min)…');
let hB = [], t0 = Date.now();
while (Date.now() - t0 < 300000) { hB = await hallazgos(T2, `ZZ CIERRE B ${R}`); if (hB.length) break; await sleep(5000); }
check('el cierre automático marcó a B SIN que nadie pulsara «Verificar»', hB.length === 1 && hB[0].estado === 'abierto', `${hB.length} hallazgo(s) tras ${Math.round((Date.now() - t0) / 1000)} s`);
const logs1 = execSync('docker logs sciad-backend 2>&1', { encoding: 'utf8', maxBuffer: 20e6 });
check('el log registra la ejecución del cierre diario', /Cierre diario de auditoría: \d+ hallazgo/.test(logs1), (logs1.match(/Cierre diario de auditoría: [^\n]*/) ?? [''])[0].slice(0, 120));
check('A no se duplicó con el cierre automático', (await hallazgos(T2, `ZZ CIERRE A ${R}`)).length === 1);

console.log('\n[4] Restauración');
COMPOSE('up -d backend', {});
check('backend recreado con la hora por defecto', await esperarSalud());
const logs2 = execSync('docker logs sciad-backend --tail 200 2>&1', { encoding: 'utf8', maxBuffer: 20e6 });
check('el log anuncia el cierre a las 00:05', /programado a las 00:05/.test(logs2));
const T3 = (await call('POST', '/api/auth/login', { body: { email: 'admin@sciad.gt', password: 'sciad123' } })).body?.token;
for (const p of [A, B]) await call('PATCH', `/api/personas/${p.id}/estado`, { token: T3, body: { estado: 'inactivo' } });

console.log(`\nRESULTADO: ${pass} ✓  ${fail} ✗`);
console.log('Nota: los hallazgos «ZZ CIERRE …» quedan abiertos en Auditoría; márcalos «resuelto» o reinicia la BD de pruebas.');
process.exit(fail ? 1 : 0);
````

---

## 5. PASO 3 — Backend: compilar y probar (Docker, sin .NET local)

```bash
docker run --rm -v "<ruta absoluta a SCIAD/sciad-backend>:/src:ro" mcr.microsoft.com/dotnet/sdk:8.0 sh -c \
  "cp -r /src /work && cd /work && dotnet test tests/Sciad.Tests/Sciad.Tests.csproj --nologo && dotnet run --project tests/Sciad.TimeHarness"
```
**Esperado:** `dotnet test` → **162 pruebas, todas pasan** (igual que el documento) y el arnés termina con `RESULTADO: 28 ✓  0 ✗`.
Si hay errores de compilación (el código nuevo se compiló y probó contra Domain+Application, pero no contra el proyecto Api/Infrastructure completos): corrige con el cambio mínimo y explícalo.

## 6. PASO 4 — Frontend

```bash
cd SCIAD/sciad-frontend
npx ng build --configuration production        # sin WARNING ni ERROR
cd tests-fase1 && npm run test:logic           # 20 pruebas OK
```

## 7. PASO 5 — Stack real y verificaciones

```bash
cd SCIAD
docker compose up --build -d                   # recrea el backend con el cierre diario
docker compose logs backend | grep -i "cierre diario"     # debe decir: programado a las 00:05 (hora de Guatemala)
node sciad-backend/verify-seguridad.mjs        # 152 ✓ / 0 ✗ otra vez (Gerencia ya NO lista personas)
node sciad-backend/verify-2d.mjs               # auditoría: la deduplicación no debe romperlo
node sciad-backend/verify-cierre.mjs           # ~4 min: el cierre automático marca el «sin egreso» de ayer, sin duplicar
cd sciad-frontend/tests-fase5 && SCIAD_BASE=http://localhost:8080 node e2e-real.mjs      # 25 ✓ / 0 ✗
cd ../tests-fase1 && npm run test:e2e          # 28 ✓ / 0 ✗
```
Reporta el resultado real de cada uno. Un fallo debe **diagnosticarse** (¿código nuevo?, ¿datos previos de pruebas?, ¿script desactualizado?) antes de tocar nada.
Nota: `verify-cierre.mjs` recrea el backend dos veces; al terminar lo deja con la hora por defecto (00:05). Los hallazgos «ZZ CIERRE …» quedan abiertos en Auditoría (son de prueba).

## 8. PASO 6 — Informe final (obligatorio)

1. `git status --short` y `git diff --stat` (no incluyas `sciad-backend/evidencia/.tokens.json`: es una caché que reescriben los `verify-*`; restáurala con `git restore` si aparece modificada).
2. Resultado **real** de cada verificación (en especial: `dotnet test` = 162, arnés = 28 ✓, `verify-seguridad` = 152 ✓, `verify-cierre`).
3. Confirma explícitamente los **puntos de contacto con PG2_V2.docx** del Anexo A (todos deben cumplirse).
4. **Pregunta:** *«¿Revisaste los cambios? ¿Hago el commit local?»* — no hagas commit hasta que diga que sí
   (`git add -A && git commit -m "Fase 6: cierre diario de auditoría y alineación con PG2_V2"`, local, sin push).

---

## ANEXO A — Coherencia con PG2_V2.docx (no debe modificarse)

| El documento afirma | Estado tras esta fase |
|---|---|
| Módulo de gestión: **todos** los endpoints `RequireAdmin`, salvo la consulta de zonas (§4.3.2, Tabla 14) | ✅ Restaurado (`/api/personas` solo Admin). Matriz E2E: 152 checks. |
| **162 / 162** pruebas unitarias exitosas (Tabla 23, Figura 18) | ✅ `dotnet test` = 162. Los tests nuevos viven en el arnés (fuera de `Sciad.Tests`). *(La cobertura de la Tabla 24 se calculó antes; si se vuelve a medir puede variar mínimamente por el código nuevo de `Sciad.Application`.)* |
| Limitación de intentos de login con bloqueo en el 6.º intento | ✅ Restaurado en el compose de desarrollo (`5 por 5 min`); el overlay del túnel (pruebas) es aparte. |
| Tabla 16: «ingreso sin egreso anómalo» = ingreso de fecha **anterior al día actual** sin egreso ese día; el del día en curso **no** es anomalía | ✅ Sin cambios de criterio (el arnés lo comprueba: a las 23:59 no se marca, a las 00:05 sí). |
| Endpoint `POST /api/auditoria/verificar` **exclusivo del Administrador** | ✅ Sin cambios. El cierre nocturno es un servicio interno, no un endpoint. |
| Solo la *concentración inusual* genera notificación; las demás «quedan registradas para revisión posterior» | ✅ El «sin egreso» solo crea hallazgo (abierto); sin notificación nueva. |
| Estados de hallazgo `abierto → en_revision → resuelto` | ✅ Sin cambios. |
| «Verificación automática de su integridad» | ✅ Ahora además se ejecuta sola cada noche. |
| Baja lógica, sin borrado físico; la bitácora no se altera | ✅ El cierre **no** inserta egresos ni modifica registros. |

*Lo que el documento no menciona y esta implementación añade (sin contradecirlo):* hora de Guatemala UTC-6 en las fechas de negocio (Fase 4), cierre automático 00:05 y la deduplicación de hallazgos. El Anexo no exige cambiar el documento; si el asesor pregunta, es una mejora de operación de la verificación ya descrita.

## ANEXO B — Qué se verificó al preparar este documento (y qué no)

**Verificado:** compilación de Domain+Application+servicio en segundo plano (Roslyn, sin NuGet) · arnés **28 ✓** con el código real: cálculo de la hora del cierre, persona que no marca salida (23:59 no se marca / 00:05 sí), sin duplicados, solo el caso nuevo se agrega, sin notificación ni egreso,
el servicio no se cae si la BD falla · build del frontend · `e2e-real` contra backend simulado.

**NO verificado (por eso existen los Pasos 3 y 5):** `AuditoriaRepository` (consulta EF contra PostgreSQL) · el registro en `Program.cs` y el arranque real del servicio · `verify-cierre.mjs` (usa Docker/psql reales) ·
que `verify-2d.mjs` siga en verde con la deduplicación · los 162 tests xUnit tras quitar `GuatemalaTimeTests`.

## ANEXO C — Limitaciones conocidas (para el informe)
- Si el backend está **apagado** a las 00:05, ese cierre no corre y no se recupera al arrancar; el Administrador puede ejecutar «Verificar integridad» a mano (es la misma verificación y no duplica).
- Si alguien se va sin marcar y **regresa el mismo día**, su regreso se registra como «egreso»; y quien entra a una **segunda zona** el mismo día recibe 409. Es consecuencia de la regla «un ingreso por persona y día» del documento (decisión pendiente del usuario, no modificada).
- Es una sola instancia de backend; con varias, la deduplicación evita los repetidos.
