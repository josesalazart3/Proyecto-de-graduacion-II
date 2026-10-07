# INSTRUCCIONES PARA CLAUDE CODE — SCIAD · Fases 3, 4 y 5
## Datos demo + zona horaria de Guatemala + endurecimiento + verificación REAL con Docker

> **Para quién es este archivo:** Claude Code, en la computadora del usuario, dentro de su copia local del proyecto SCIAD.
> Es **autocontenido** (trae todo el código) y se aplica **después** de `INSTRUCCIONES_CLAUDE_CODE_FASES_1_2.md`, que ya está aplicado y commiteado.
>
> ⚠ **Es largo (~2100 líneas).** Léelo **completo**, en varias lecturas consecutivas (de ~500 en 500 líneas), antes de modificar nada.

**Objetivo del usuario:** que la app quede **100 % funcional de verdad** — escanear con la cámara (PC y celular), frontend + backend + Docker + base de datos
funcionando juntos. Hasta ahora todo se verificó con un backend *simulado*; **este documento termina con la verificación contra el stack REAL**,
que es la parte más importante: úsala para encontrar y corregir lo que falle.

---

## 0. REGLAS (obligatorias)

1. **Todo es LOCAL, sobre el árbol de trabajo.** Prohibido: `git commit`, `git push`, ramas, `stash`, `reset`. El commit lo hace el usuario cuando lo confirme.
   (`git apply` sin `--index` sí está permitido.)
2. **Docker SÍ está autorizado** para levantar/probar el stack (`docker compose up/ps/logs/exec`, `docker run` del SDK de .NET).
   **Excepción:** `docker compose down -v` / borrar volúmenes **destruye la base de datos**: pide confirmación explícita al usuario antes (ver Paso 9).
3. **Aplica el código tal cual** está en este documento. No lo "mejores". Si algo parece mal, repórtalo.
4. **Si un bloque no encaja** (archivo distinto al esperado, un `diff` no aplica): detente, muestra la diferencia y pregunta.
5. **Cambios fuera de este documento:** solo para corregir un **fallo real** que descubran las pruebas del Paso 12 y que sea pequeño y claro. Explica causa y cambio;
   **no toques** el esquema de BD/migraciones, ni la matriz RBAC más allá de lo que dice este documento, ni la regla de «un ingreso por persona y día».
6. Al terminar: informe (Paso 14) y **espera** la confirmación del usuario para el commit.

## 1. Qué cambia

| Fase | Contenido |
|---|---|
| **3** | `seed-demo.mjs` (zonas, personas, perfiles y credenciales de demostración por la API + hoja imprimible de QR) y `GUIA_DE_USO.md`. |
| **4** | **Backend: hora de Guatemala (UTC-6).** El backend usaba `DateTime.UtcNow`: a las 18:00 locales cambiaba el día y quien salía a las 6:30 pm quedaba como *nuevo ingreso*. Se agrega `GuatemalaTime` y se usa en los servicios; el frontend y los scripts se alinean. |
| **5** | Endurecimiento y errores reales hallados: cuentas demo ocultas en producción · listas truncadas a 20 filas (el frontend pedía 500 y el backend solo acepta ≤100) y KPI del dashboard · Gerencia sin permiso para listar personas (filtros de CU-06/CU-07) · límite de login en desarrollo · scripts `verify-*` al día de Guatemala · **prueba E2E real con Docker** (`e2e-real.mjs`). |

Rutas relativas a `SCIAD/` (la carpeta que contiene `sciad-frontend/` y `sciad-backend/`). Los `git apply` se ejecutan **desde la raíz del repo**
con `--directory=SCIAD` (ajusta si tu carpeta se llama distinto).

---

## 2. PASO 0 — Comprobaciones previas (reporta cada resultado antes de modificar)

1. `git status --short` → anota qué hay sin commit. Debe estar limpio o con cambios que no toquen los archivos de este documento; si no, **pregunta**.
2. `git log --oneline -3` → debe verse el commit de las Fases 1 y 2. Si no está, detente: aplica primero `INSTRUCCIONES_CLAUDE_CODE_FASES_1_2.md`.
3. Existen `sciad-frontend/src/app/core/util/time.ts` y `qr-camera.ts`, y **no** existe `sciad-backend/src/Sciad.Domain/Time/`.
4. `node -v` ≥ 22.22.3 · `docker version` responde (Docker Desktop en marcha) · `docker compose version`.
5. Anota cuántos tests tiene hoy el backend (se verá en el Paso 8: esperado **162**).

---

## 3. PASO 1 — Fase 4 · Backend: hora de Guatemala

### 3.1 Archivo nuevo
#### 📄 NUEVO — `sciad-backend/src/Sciad.Domain/Time/GuatemalaTime.cs`

````csharp
namespace Sciad.Domain.Time;

/// <summary>
/// Hora oficial de Guatemala para las reglas de negocio de acceso (Fase 4).
///
/// Guatemala está en UTC-6 todo el año (no usa horario de verano), por lo que se aplica un desplazamiento
/// fijo en vez de depender de la base de zonas horarias (tzdata) del contenedor. Esto evita que "hoy"
/// cambie a las 18:00 locales (medianoche UTC): una persona que sale a las 6:30 pm sigue en el mismo día
/// y se registra como egreso, no como un nuevo ingreso.
///
/// Convención: los campos <c>fecha</c>/<c>hora</c> de <c>registros_acceso</c> (y las fechas de negocio
/// <c>emitido</c>, <c>generado</c>, <c>auditoria.fecha</c>) se guardan en hora de Guatemala. Los
/// instantes (<c>notificaciones.fecha</c>, el <c>timestamp</c> de la respuesta, la expiración del JWT)
/// siguen siendo UTC verdadero.
/// </summary>
public static class GuatemalaTime
{
    /// <summary>Desplazamiento fijo respecto a UTC (UTC-6).</summary>
    public static readonly TimeSpan Offset = TimeSpan.FromHours(-6);

    /// <summary>Fuente de tiempo. Solo se reemplaza en pruebas; en producción es el reloj del sistema.</summary>
    public static TimeProvider Proveedor { get; set; } = TimeProvider.System;

    /// <summary>Instante actual en UTC (Kind = Utc).</summary>
    public static DateTime UtcNow => Proveedor.GetUtcNow().UtcDateTime;

    /// <summary>Fecha y hora actuales de Guatemala (Kind = Unspecified).</summary>
    public static DateTime Now => FromUtc(UtcNow);

    /// <summary>Fecha de hoy en Guatemala.</summary>
    public static DateOnly Hoy => DateOnly.FromDateTime(Now);

    /// <summary>Convierte un instante UTC a la hora de Guatemala.</summary>
    public static DateTime FromUtc(DateTime utc) =>
        DateTime.SpecifyKind(utc + Offset, DateTimeKind.Unspecified);

    /// <summary>Convierte fecha+hora de Guatemala al instante UTC equivalente (Kind = Utc).</summary>
    public static DateTime ToUtc(DateOnly fecha, TimeOnly hora)
    {
        var local = new DateTime(
            fecha.Year, fecha.Month, fecha.Day,
            hora.Hour, hora.Minute, hora.Second, DateTimeKind.Unspecified);
        return DateTime.SpecifyKind(local - Offset, DateTimeKind.Utc);
    }
}
````

### 3.2 Servicios (diffs)

Aplica cada `diff` desde la raíz del repo: `git apply --directory=SCIAD --whitespace=nowarn <archivo.diff>` (el `diff` guardado en un temporal **fuera del repo**).

#### 🔧 EDITAR (diff) — `sciad-backend/src/Sciad.Application/Services/RegistrosAccesoService.cs`
Fecha/hora de negocio en hora de Guatemala; el `timestamp` de la respuesta sigue siendo el instante UTC real.
````diff
diff --git a/sciad-backend/src/Sciad.Application/Services/RegistrosAccesoService.cs b/sciad-backend/src/Sciad.Application/Services/RegistrosAccesoService.cs
index a06a8b2..6e9d829 100644
--- a/sciad-backend/src/Sciad.Application/Services/RegistrosAccesoService.cs
+++ b/sciad-backend/src/Sciad.Application/Services/RegistrosAccesoService.cs
@@ -3,6 +3,7 @@ using Sciad.Application.Dtos.Common;
 using Sciad.Application.Dtos.RegistrosAcceso;
 using Sciad.Application.Interfaces;
 using Sciad.Domain.Entities;
+using Sciad.Domain.Time;
 
 namespace Sciad.Application.Services;
 
@@ -51,7 +52,10 @@ public sealed class RegistrosAccesoService : IRegistrosAccesoService
     public async Task<ServicioResultado<RegistroAccesoResultadoDto>> RegistrarAccesoAsync(
         RegistrarAccesoRequest request, int usuarioId, CancellationToken ct = default)
     {
-        var ahora = DateTime.UtcNow;
+        // Fecha/hora de negocio en hora de Guatemala (UTC-6): el "día" no cambia a las 18:00 locales.
+        // El instante real (UTC) se conserva solo para el timestamp de la respuesta.
+        var ahoraUtc = GuatemalaTime.UtcNow;
+        var ahora = GuatemalaTime.FromUtc(ahoraUtc);
         var hoy = DateOnly.FromDateTime(ahora);
 
         // 1) Token QR existe (RNF-01). Devuelve la credencial en cualquier estado + persona.
@@ -140,13 +144,13 @@ public sealed class RegistrosAccesoService : IRegistrosAccesoService
             creado.Id, persona.Id, zona.Id, tipo, usuarioId);
 
         return ServicioResultado<RegistroAccesoResultadoDto>.Ok(
-            RegistroAccesoResultadoDto.From(creado, persona, zona, ahora));
+            RegistroAccesoResultadoDto.From(creado, persona, zona, ahoraUtc));
     }
 
     public async Task<ServicioResultado<List<AccesoDelDiaDto>>> ListarDelDiaAsync(
         int? zonaId, CancellationToken ct = default)
     {
-        var hoy = DateOnly.FromDateTime(DateTime.UtcNow);
+        var hoy = GuatemalaTime.Hoy;
         var registros = await _registros.ListarDelDiaAsync(zonaId, hoy, ct);
 
         var resultado = new List<AccesoDelDiaDto>();
````

#### 🔧 EDITAR (diff) — `sciad-backend/src/Sciad.Application/Services/AuditoriaService.cs`
"Hoy" y la ventana de concentración con hora de Guatemala.
````diff
diff --git a/sciad-backend/src/Sciad.Application/Services/AuditoriaService.cs b/sciad-backend/src/Sciad.Application/Services/AuditoriaService.cs
index 56b62e0..65ef141 100644
--- a/sciad-backend/src/Sciad.Application/Services/AuditoriaService.cs
+++ b/sciad-backend/src/Sciad.Application/Services/AuditoriaService.cs
@@ -3,6 +3,7 @@ using Sciad.Application.Dtos.Auditoria;
 using Sciad.Application.Dtos.Common;
 using Sciad.Application.Interfaces;
 using Sciad.Domain.Entities;
+using Sciad.Domain.Time;
 
 namespace Sciad.Application.Services;
 
@@ -50,7 +51,7 @@ public sealed class AuditoriaService : IAuditoriaService
     public async Task<ServicioResultado<VerificacionAuditoriaResultadoDto>> VerificarAsync(
         CancellationToken ct = default)
     {
-        var hoy = DateOnly.FromDateTime(DateTime.UtcNow);
+        var hoy = GuatemalaTime.Hoy;
         var hallazgos = new List<Auditoria>();
         var notificacionesGeneradas = 0;
 
@@ -79,7 +80,7 @@ public sealed class AuditoriaService : IAuditoriaService
         }
 
         // 4) Concentración inusual en una zona: N ingresos en la ventana rodante, agrupados por zona.
-        var ahora = DateTime.UtcNow;
+        var ahora = GuatemalaTime.UtcNow;
         var desdeVentana = ahora.AddMinutes(-VentanaConcentracionMinutos);
         foreach (var grupo in (await _registros.ListarIngresosDelDiaAsync(hoy, ct)).GroupBy(r => r.ZonaId))
         {
@@ -171,10 +172,9 @@ public sealed class AuditoriaService : IAuditoriaService
 
     private static bool DentroDeVentana(RegistroAcceso r, DateTime desde, DateTime hasta)
     {
-        // Fecha+Hora se persisten en UTC (2C usa DateTime.UtcNow): se reconstruye el timestamp UTC.
-        var momento = new DateTime(
-            r.Fecha.Year, r.Fecha.Month, r.Fecha.Day,
-            r.Hora.Hour, r.Hora.Minute, r.Hora.Second, DateTimeKind.Utc);
+        // Fecha+Hora se persisten en hora de Guatemala (UTC-6): se reconstruye el instante UTC equivalente
+        // para compararlo con la ventana (que está en UTC).
+        var momento = GuatemalaTime.ToUtc(r.Fecha, r.Hora);
         return momento >= desde && momento <= hasta;
     }
 }
\ No newline at end of file
````

#### 🔧 EDITAR (diff) — `sciad-backend/src/Sciad.Application/Services/CredencialesService.cs`
`emitido` = fecha de Guatemala.
````diff
diff --git a/sciad-backend/src/Sciad.Application/Services/CredencialesService.cs b/sciad-backend/src/Sciad.Application/Services/CredencialesService.cs
index 20bdfca..2e4e433 100644
--- a/sciad-backend/src/Sciad.Application/Services/CredencialesService.cs
+++ b/sciad-backend/src/Sciad.Application/Services/CredencialesService.cs
@@ -3,6 +3,7 @@ using Microsoft.Extensions.Logging;
 using Sciad.Application.Dtos.Credenciales;
 using Sciad.Application.Interfaces;
 using Sciad.Domain.Entities;
+using Sciad.Domain.Time;
 
 namespace Sciad.Application.Services;
 
@@ -156,7 +157,7 @@ public sealed class CredencialesService : ICredencialesService
         return ServicioResultado<List<CredencialDto>>.Ok(todas.Select(CredencialDto.From).ToList());
     }
 
-    private static DateOnly Hoy() => DateOnly.FromDateTime(DateTime.UtcNow);
+    private static DateOnly Hoy() => GuatemalaTime.Hoy;
 
     /// <summary>32 bytes aleatorios (CSPRNG) → 64 caracteres hex. RNF-01 / RNF-02.</summary>
     private static string GenerarTokenHex64()
````

#### 🔧 EDITAR (diff) — `sciad-backend/src/Sciad.Application/Services/ReportesService.cs`
`generado` = fecha de Guatemala.
````diff
diff --git a/sciad-backend/src/Sciad.Application/Services/ReportesService.cs b/sciad-backend/src/Sciad.Application/Services/ReportesService.cs
index d67c7f0..bf1fcb8 100644
--- a/sciad-backend/src/Sciad.Application/Services/ReportesService.cs
+++ b/sciad-backend/src/Sciad.Application/Services/ReportesService.cs
@@ -4,6 +4,7 @@ using Sciad.Application.Dtos.Common;
 using Sciad.Application.Dtos.Reportes;
 using Sciad.Application.Interfaces;
 using Sciad.Domain.Entities;
+using Sciad.Domain.Time;
 
 namespace Sciad.Application.Services;
 
@@ -67,7 +68,7 @@ public sealed class ReportesService : IReportesService
         {
             Periodo = periodo,
             TotalRegistros = filas.Count,
-            Generado = DateOnly.FromDateTime(DateTime.UtcNow),
+            Generado = GuatemalaTime.Hoy,
             UsuarioId = usuarioId,
         }, ct);
 
````

### 3.3 Tests del backend

**(a)** En `sciad-backend/tests/Sciad.Tests/` reemplaza **todas** las apariciones de `DateTime.UtcNow` por `GuatemalaTime.Now` **únicamente** en estos 5 archivos
(los tests construyen "hoy" igual que los servicios). Conteos esperados — verifícalos antes y después:

| Archivo | Ocurrencias |
|---|---|
| `Support/TestData.cs` | 10 |
| `Services/PerfilesAccesoServiceTests.cs` | 8 |
| `Services/ReportesServiceTests.cs` | 6 |
| `Services/AuditoriaServiceTests.cs` | 5 |
| `Services/RegistrosAccesoServiceTests.cs` | 4 |

**NO** cambies `Services/TokenServiceTests.cs` ni `Services/NotificacionesServiceTests.cs` (usan UTC a propósito: expiración del JWT e instante de notificación).
Al terminar, `UtcNow` solo debe quedar en esos dos archivos (3 líneas) y en `GetUtcNow` del reloj falso de `GuatemalaTimeTests.cs` (4 líneas en total).

**(b)** Diff del `.csproj` de tests (agrega el `using` global de `Sciad.Domain.Time`):

#### 🔧 EDITAR (diff) — `sciad-backend/tests/Sciad.Tests/Sciad.Tests.csproj`

````diff
diff --git a/sciad-backend/tests/Sciad.Tests/Sciad.Tests.csproj b/sciad-backend/tests/Sciad.Tests/Sciad.Tests.csproj
index 5100ee7..bdb020c 100644
--- a/sciad-backend/tests/Sciad.Tests/Sciad.Tests.csproj
+++ b/sciad-backend/tests/Sciad.Tests/Sciad.Tests.csproj
@@ -24,6 +24,8 @@
        para que los atributos [Fact]/[Theory] resuelvan sin usar por archivo. -->
   <ItemGroup>
     <Using Include="Xunit" />
+    <!-- Fase 4: los tests construyen "hoy" con la hora de Guatemala, igual que los servicios. -->
+    <Using Include="Sciad.Domain.Time" />
   </ItemGroup>
 
   <ItemGroup>
````

**(c)** Tests nuevos de `GuatemalaTime`:

#### 📄 NUEVO — `sciad-backend/tests/Sciad.Tests/Services/GuatemalaTimeTests.cs`

````csharp
using Sciad.Domain.Time;

namespace Sciad.Tests.Services;

/// <summary>Fase 4: la hora de negocio es la de Guatemala (UTC-6 fijo, sin horario de verano).</summary>
public class GuatemalaTimeTests : IDisposable
{
    private sealed class RelojFijo : TimeProvider
    {
        private readonly DateTimeOffset _ahora;
        public RelojFijo(string isoUtc) => _ahora = DateTimeOffset.Parse(isoUtc + "Z");
        public override DateTimeOffset GetUtcNow() => _ahora;
    }

    public void Dispose() => GuatemalaTime.Proveedor = TimeProvider.System;

    [Fact]
    public void FromUtc_RestaSeisHoras()
    {
        var local = GuatemalaTime.FromUtc(new DateTime(2026, 8, 21, 13, 15, 32, DateTimeKind.Utc));
        Assert.Equal(new DateTime(2026, 8, 21, 7, 15, 32), local);
    }

    [Fact]
    public void Hoy_NoCambiaALas18HorasLocales()
    {
        // 00:30 UTC del día 22 = 18:30 del día 21 en Guatemala.
        GuatemalaTime.Proveedor = new RelojFijo("2026-08-22T00:30:00");
        Assert.Equal(new DateOnly(2026, 8, 21), GuatemalaTime.Hoy);
    }

    [Fact]
    public void Hoy_CambiaALaMedianocheDeGuatemala()
    {
        GuatemalaTime.Proveedor = new RelojFijo("2026-08-22T05:59:59");
        Assert.Equal(new DateOnly(2026, 8, 21), GuatemalaTime.Hoy);
        GuatemalaTime.Proveedor = new RelojFijo("2026-08-22T06:00:00");
        Assert.Equal(new DateOnly(2026, 8, 22), GuatemalaTime.Hoy);
    }

    [Fact]
    public void ToUtc_EsLaInversaDeFromUtc()
    {
        var utc = GuatemalaTime.ToUtc(new DateOnly(2026, 8, 21), new TimeOnly(18, 30, 0));
        Assert.Equal(new DateTime(2026, 8, 22, 0, 30, 0), utc);
        Assert.Equal(DateTimeKind.Utc, utc.Kind);
    }
}
````

**(d)** Arnés de regresión (ejecuta el código REAL de los servicios con repositorios en memoria y un reloj simulado; sin base de datos):

#### 📄 NUEVO — `sciad-backend/tests/Sciad.TimeHarness/Sciad.TimeHarness.csproj`

````xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <RootNamespace>Sciad.TimeHarness</RootNamespace>
    <IsPackable>false</IsPackable>
  </PropertyGroup>

  <ItemGroup>
    <ProjectReference Include="..\..\src\Sciad.Domain\Sciad.Domain.csproj" />
    <ProjectReference Include="..\..\src\Sciad.Application\Sciad.Application.csproj" />
  </ItemGroup>

</Project>
````

#### 📄 NUEVO — `sciad-backend/tests/Sciad.TimeHarness/Program.cs`

````csharp
// Arnés de regresión de la Fase 4 (zona horaria de Guatemala). Ejecutar: dotnet run --project tests/Sciad.TimeHarness
// Usa el código REAL de RegistrosAccesoService/AuditoriaService con repositorios en memoria y un reloj simulado.
// Devuelve código de salida 0 si todo pasa. No requiere base de datos.
using System.Reflection;
using Microsoft.Extensions.Logging.Abstractions;
using Sciad.Application.Interfaces;
using Sciad.Application.Services;
using Sciad.Domain.Entities;
using Sciad.Domain.Time;

// Arnés: ejecuta el código REAL de RegistrosAccesoService/AuditoriaService con repositorios en memoria
// y un reloj simulado, para comprobar el comportamiento de zona horaria de Guatemala (UTC-6).
public class Fake : DispatchProxy
{
    public Dictionary<string, Func<object?[], object?>> H = new();
    protected override object? Invoke(MethodInfo? m, object?[]? a)
    {
        if (!H.TryGetValue(m!.Name, out var f)) throw new NotImplementedException(m.Name);
        var r = f(a ?? Array.Empty<object?>());
        var rt = m.ReturnType;
        if (rt == typeof(Task)) return Task.CompletedTask;
        if (rt.IsGenericType && rt.GetGenericTypeDefinition() == typeof(Task<>))
            return typeof(Task).GetMethod("FromResult")!.MakeGenericMethod(rt.GetGenericArguments()[0]).Invoke(null, new[] { r });
        return r;
    }
    public static T Make<T>(Dictionary<string, Func<object?[], object?>> h) where T : class
    { var p = Create<T, Fake>(); ((Fake)(object)p).H = h; return p; }
}
public class ClockFake : TimeProvider { public DateTimeOffset Now; public override DateTimeOffset GetUtcNow() => Now; }

public static class Harness
{
    static int pass, fail;
    static void Check(string n, bool ok, string extra = "") { if (ok) pass++; else fail++; Console.WriteLine($"  {(ok ? "✓" : "✗ FALLO")} {n}{(extra != "" ? "  → " + extra : "")}"); }
    static DateTimeOffset Z(string iso) => DateTimeOffset.Parse(iso + "Z");

    public static int Main()
    {
        var clock = new ClockFake(); GuatemalaTime.Proveedor = clock;
        var persona = new Persona { Id = 7, Nombre = "Juan Pérez López", DpiCodigo = "D1", Tipo = 1, Estado = "activo" };
        var zona = new ZonaAcceso { Id = 1, Nombre = "Entrada Principal", NivelSeguridad = "MEDIO", Estado = "activo" };
        var cred = new CredencialQr { Id = 1, PersonaId = 7, Persona = persona, Token = new string('A', 64), Estado = "activa" };
        var perfil = new PerfilAcceso { Id = 1, PersonaId = 7, ZonaId = 1, VigenciaInicio = new DateOnly(2026, 1, 1), VigenciaFin = new DateOnly(2026, 12, 31) };
        var db = new List<RegistroAcceso>(); var notifs = new List<Notificacion>();

        var registros = Fake.Make<IRegistroAccesoRepository>(new()
        {
            ["ContarMovimientosAsync"] = a => { var (p, z, f) = ((int)a[0]!, (int)a[1]!, (DateOnly)a[2]!); var x = db.Where(r => r.PersonaId == p && r.ZonaId == z && r.Fecha == f).ToList(); return (x.Count(r => r.Tipo == "ingreso"), x.Count(r => r.Tipo == "egreso")); },
            // imita el índice UNIQUE uq_ingreso_diario (persona, fecha) WHERE tipo='ingreso'
            ["RegistrarConTransaccionAsync"] = a => { var r = (RegistroAcceso)a[0]!; if (r.Tipo == "ingreso" && db.Any(x => x.PersonaId == r.PersonaId && x.Fecha == r.Fecha && x.Tipo == "ingreso")) return null; r.Id = db.Count + 1; db.Add(r); return r; },
            ["AgregarNotificacionAsync"] = a => { notifs.Add((Notificacion)a[0]!); return null; },
            ["ListarDelDiaAsync"] = a => { var f = (DateOnly)a[1]!; return db.Where(r => r.Fecha == f).Select(r => { r.Persona = persona; r.Zona = zona; return r; }).OrderBy(r => r.Hora).ToList(); },
        });
        var svc = new RegistrosAccesoService(
            Fake.Make<ICredencialRepository>(new() { ["ObtenerPorTokenAsync"] = a => cred }),
            Fake.Make<IZonaRepository>(new() { ["FindByIdAsync"] = a => zona }),
            Fake.Make<IPerfilAccesoRepository>(new() { ["ListarAsync"] = a => new List<PerfilAcceso> { perfil } }),
            registros,
            Fake.Make<IUsuarioRepository>(new() { ["ObtenerActivoPorRolAsync"] = a => null }),
            NullLogger<RegistrosAccesoService>.Instance);
        var req = new Sciad.Application.Dtos.RegistrosAcceso.RegistrarAccesoRequest { Token = cred.Token, ZonaId = 1 };

        Console.WriteLine("[1] GuatemalaTime");
        clock.Now = Z("2026-08-22T05:59:59"); Check("05:59:59Z = 23:59:59 GT sigue siendo el día 21", GuatemalaTime.Hoy == new DateOnly(2026, 8, 21), GuatemalaTime.Now.ToString("s"));
        clock.Now = Z("2026-08-22T06:00:00"); Check("06:00:00Z = 00:00:00 GT cambia al día 22", GuatemalaTime.Hoy == new DateOnly(2026, 8, 22));
        Check("ToUtc(fecha,hora GT) ida y vuelta", GuatemalaTime.ToUtc(new DateOnly(2026, 8, 21), new TimeOnly(18, 30, 0)) == new DateTime(2026, 8, 22, 0, 30, 0, DateTimeKind.Utc));

        Console.WriteLine("[2] Escaneo: entrada 7:15 am y salida 6:30 pm (el error que se corrige)");
        clock.Now = Z("2026-08-21T13:15:32");   // 07:15:32 en Guatemala
        var r1 = svc.RegistrarAccesoAsync(req, 1).Result;
        Check("7:15 am GT → INGRESO", r1.Exitoso && r1.Dato!.Tipo == "ingreso", r1.Mensaje);
        Check("se guarda fecha 21 y hora 07:15:32 (hora de Guatemala)", db[0].Fecha == new DateOnly(2026, 8, 21) && db[0].Hora == new TimeOnly(7, 15, 32), $"{db[0].Fecha} {db[0].Hora}");
        Check("timestamp de la respuesta sigue siendo el instante UTC real", r1.Dato!.Timestamp == new DateTime(2026, 8, 21, 13, 15, 32, DateTimeKind.Utc) && r1.Dato.Timestamp.Kind == DateTimeKind.Utc, r1.Dato.Timestamp.ToString("o"));

        clock.Now = Z("2026-08-22T00:30:00");   // 18:30 del MISMO día en Guatemala (medianoche pasada en UTC)
        var r2 = svc.RegistrarAccesoAsync(req, 1).Result;
        Check("6:30 pm GT (00:30 UTC del día siguiente) → EGRESO, no un nuevo ingreso", r2.Exitoso && r2.Dato!.Tipo == "egreso", r2.Mensaje ?? r2.Dato?.Tipo);
        Check("el egreso queda en la fecha 21 (día de Guatemala)", db[1].Fecha == new DateOnly(2026, 8, 21) && db[1].Hora == new TimeOnly(18, 30, 0), $"{db[1].Fecha} {db[1].Hora}");

        var hoy = svc.ListarDelDiaAsync(null).Result.Dato!;
        Check("'accesos del día' a las 6:30 pm GT sigue mostrando a la persona (fuera)", hoy.Count == 1 && !hoy[0].Dentro, $"filas={hoy.Count}");

        clock.Now = Z("2026-08-22T12:00:00");   // 06:00 am del día 22 en Guatemala
        var r3 = svc.RegistrarAccesoAsync(req, 1).Result;
        Check("al día siguiente (6:00 am GT) → nuevo INGRESO en fecha 22", r3.Exitoso && r3.Dato!.Tipo == "ingreso" && db[2].Fecha == new DateOnly(2026, 8, 22));

        Console.WriteLine("[3] Auditoría: concentración (ventana 30 min) con reloj de Guatemala");
        db.Clear();
        clock.Now = Z("2026-08-22T00:30:00");   // 18:30 GT del día 21
        var hallazgos = new List<Auditoria>(); var nots = new List<Notificacion>();
        var zonaC = new ZonaAcceso { Id = 2, Nombre = "Oficinas", NivelSeguridad = "MEDIO", Estado = "activo" };
        for (int i = 0; i < AuditoriaService.UmbralConcentracion; i++)   // 10 ingresos "hace 5 minutos" (18:25 GT)
            db.Add(new RegistroAcceso { Id = 100 + i, PersonaId = 10 + i, ZonaId = 2, Zona = zonaC, Persona = new Persona { Id = 10 + i, Nombre = "P" + i }, Fecha = new DateOnly(2026, 8, 21), Hora = new TimeOnly(18, 25, 0), Tipo = "ingreso" });
        var aud = new AuditoriaService(
            Fake.Make<IRegistroAccesoRepository>(new() {
                ["IngresosSinEgresoAsync"] = a => new List<RegistroAcceso>(), ["RegistrosDuplicadosAsync"] = a => new List<RegistroAcceso>(),
                ["RegistrosInconsistentesAsync"] = a => new List<RegistroAcceso>(),
                ["ListarIngresosDelDiaAsync"] = a => { var f = (DateOnly)a[0]!; return db.Where(r => r.Fecha == f).ToList(); } }),
            Fake.Make<IAuditoriaRepository>(new() { ["AgregarHallazgosAsync"] = a => { hallazgos.AddRange((List<Auditoria>)a[0]!); return a[0]; } }),
            Fake.Make<INotificacionRepository>(new() { ["AgregarAsync"] = a => { nots.Add((Notificacion)a[0]!); return a[0]; } }),
            Fake.Make<IUsuarioRepository>(new() { ["ObtenerActivoPorRolAsync"] = a => null }),
            NullLogger<AuditoriaService>.Instance);
        var v = aud.VerificarAsync().Result;
        Check("10 ingresos a las 18:25 GT, verificación a las 18:30 GT → detecta concentración", hallazgos.Any(h => h.Tipo == "concentracion"), string.Join(",", hallazgos.Select(h => h.Tipo)));
        Check("hallazgo con fecha de Guatemala (21)", hallazgos.All(h => h.Fecha == new DateOnly(2026, 8, 21)));
        Check("genera 1 notificación de concentración", nots.Count == 1 && nots[0].Tipo == "concentracion");

        Console.WriteLine($"\nRESULTADO: {pass} ✓  {fail} ✗");
        return fail == 0 ? 0 : 1;
    }
}
````

### 3.4 Frontend de la Fase 4 (hora de Guatemala)

#### ♻️ REEMPLAZAR POR COMPLETO — `sciad-frontend/src/app/core/util/time.ts`
Interpreta `fecha`/`hora` como hora de Guatemala (UTC-6) y agrega `hoyServidor()`.
````ts
// Utilidades de fecha/hora.
//
// Desde la Fase 4 el backend guarda `fecha` (DateOnly) y `hora` (TimeOnly) de los registros de acceso en
// **hora de Guatemala** (UTC-6 fijo, sin horario de verano), no en UTC. El "día" del servidor es, por tanto,
// el día de Guatemala (no cambia a las 18:00 locales). Estas funciones interpretan ese par con su
// desplazamiento real y lo muestran en la zona horaria del dispositivo (que en Guatemala es la misma).
// Los instantes verdaderos (p. ej. `timestamp` de un escaneo, `notificacion.fecha`) llegan en UTC con "Z"
// y se muestran con `new Date(iso)`.
const GT_OFFSET_HOURS = -6;
const GT_OFFSET_ISO = '-06:00';

const HORA_RE = /^(\d{2}):(\d{2})(?::(\d{2}))?/;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Convierte (fecha yyyy-mm-dd, hora HH:mm[:ss]) de Guatemala a un Date (instante). null si no es válido. */
export function toDate(fecha: string | null | undefined, hora: string | null | undefined): Date | null {
  if (!fecha || !hora) return null;
  const m = HORA_RE.exec(hora);
  if (!m || !/^\d{4}-\d{2}-\d{2}/.test(fecha)) return null;
  const d = new Date(`${fecha.slice(0, 10)}T${m[1]}:${m[2]}:${m[3] ?? '00'}${GT_OFFSET_ISO}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 'HH:mm' en la hora del dispositivo. Si no se puede convertir, devuelve los primeros 5 caracteres de `hora`. */
export function horaLocal(fecha: string | null | undefined, hora: string | null | undefined): string {
  const d = toDate(fecha, hora);
  if (!d) return (hora ?? '').slice(0, 5);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 'yyyy-mm-dd' en la fecha del dispositivo. Si no se puede convertir, devuelve `fecha` tal cual. */
export function fechaLocal(fecha: string | null | undefined, hora: string | null | undefined): string {
  const d = toDate(fecha, hora);
  if (!d) return fecha ?? '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Fecha de "hoy" según el servidor (día de Guatemala), 'yyyy-mm-dd'. */
export function hoyServidor(now: Date = new Date()): string {
  return new Date(now.getTime() + GT_OFFSET_HOURS * 3_600_000).toISOString().slice(0, 10);
}
````

#### 🔧 EDITAR (diff) — `sciad-frontend/src/app/features/security/access-log.component.ts`

````diff
diff --git a/sciad-frontend/src/app/features/security/access-log.component.ts b/sciad-frontend/src/app/features/security/access-log.component.ts
index 53d30dd..57f8a68 100644
--- a/sciad-frontend/src/app/features/security/access-log.component.ts
+++ b/sciad-frontend/src/app/features/security/access-log.component.ts
@@ -10,7 +10,7 @@ import { Button } from '../../shared/ui/button.component';
 import { Card } from '../../shared/ui/card.component';
 import { EmptyState } from '../../shared/ui/empty-state.component';
 import { ToastService } from '../../shared/ui/toast.service';
-import { horaLocal, hoyUtc } from '../../core/util/time';
+import { horaLocal, hoyServidor } from '../../core/util/time';
 
 @Component({
   selector: 'app-access-log',
@@ -110,9 +110,9 @@ export class AccessLogComponent implements OnInit {
   protected readonly loading = signal(true);
   protected readonly records = signal<AccesoDelDia[]>([]);
 
-  /** La hora llega en UTC del servidor ("hoy" = fecha UTC): se muestra en hora local. */
+  /** La hora llega en hora de Guatemala ("hoy" = día de Guatemala): se muestra en la hora del dispositivo. */
   protected hora(h: string | null | undefined): string {
-    return horaLocal(hoyUtc(), h);
+    return horaLocal(hoyServidor(), h);
   }
 
   protected readonly counts = computed(() => {
````

#### 🔧 EDITAR (diff) — `sciad-frontend/src/app/features/admin/dashboard.component.ts`
También corrige el KPI «Accesos hoy» (usa el `total` real del servidor).
````diff
diff --git a/sciad-frontend/src/app/features/admin/dashboard.component.ts b/sciad-frontend/src/app/features/admin/dashboard.component.ts
index 9a9f58b..7ae9924 100644
--- a/sciad-frontend/src/app/features/admin/dashboard.component.ts
+++ b/sciad-frontend/src/app/features/admin/dashboard.component.ts
@@ -11,7 +11,7 @@ import {
 } from '../../core/services/crud.service';
 import { RegistroHistorial } from '../../core/models/access-log.model';
 import { KpiCard } from '../../shared/ui/kpi-card.component';
-import { horaLocal } from '../../core/util/time';
+import { horaLocal, hoyServidor } from '../../core/util/time';
 import { Card } from '../../shared/ui/card.component';
 
 @Component({
@@ -164,7 +164,7 @@ export class AdminDashboardComponent implements OnInit {
   protected readonly alerts = signal<{ id: string; personaNombre?: string; mensaje: string; fecha: string }[]>([]);
 
   ngOnInit(): void {
-    const hoy = new Date().toISOString().slice(0, 10);
+    const hoy = hoyServidor();
     const done = () => {
       if (
         this.accesosHoy() !== '—' &&
@@ -176,9 +176,11 @@ export class AdminDashboardComponent implements OnInit {
       }
     };
 
-    this.logs.historial({ desde: hoy, hasta: hoy }).subscribe((list) => {
-      const rows = list.sort((a, b) => (a.fecha + a.hora < b.fecha + b.hora ? 1 : -1));
-      this.accesosHoy.set(String(rows.length));
+    // Se pide solo la página de "actividad reciente" (6 más nuevos, el backend ordena por fecha/hora desc) y el
+    // KPI usa el `total` real del servidor (antes contaba filas de una página truncada a 20).
+    this.logs.historialPagina({ desde: hoy, hasta: hoy, tamanoPagina: 6 }).subscribe((page) => {
+      const rows = [...page.items].sort((a, b) => (a.fecha + a.hora < b.fecha + b.hora ? 1 : -1));
+      this.accesosHoy.set(String(page.total));
       this.events.set(rows.slice(0, 6));
       done();
     });
@@ -205,7 +207,7 @@ export class AdminDashboardComponent implements OnInit {
     });
   }
 
-  /** La hora del registro viene en UTC del servidor: se muestra en hora local. */
+  /** La hora del registro viene en hora de Guatemala: se muestra en la hora del dispositivo. */
   protected horaDe(ev: RegistroHistorial): string {
     return horaLocal(ev.fecha, ev.hora);
   }
````

### 3.5 Scripts `verify-*` del backend: "hoy" = día de Guatemala

#### 🔧 EDITAR (diff) — `sciad-backend/verify-2c.mjs`

````diff
diff --git a/sciad-backend/verify-2c.mjs b/sciad-backend/verify-2c.mjs
index 5282c61..8a46994 100644
--- a/sciad-backend/verify-2c.mjs
+++ b/sciad-backend/verify-2c.mjs
@@ -8,7 +8,7 @@ const BASE = process.env.SCIAD_BASE ?? 'http://localhost:3000';
 const H = { 'Content-Type': 'application/json' };
 
 const R = Date.now().toString().slice(-8); // sufijo único por corrida
-const hoyUtc = new Date().toISOString().slice(0, 10);
+const hoyUtc = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10); // día de Guatemala (UTC-6): el backend lo usa como "hoy" (Fase 4)
 const fecha = (ms) => new Date(ms).toISOString().slice(0, 10);
 const inicioVigencia = fecha(Date.now() - 1 * 86400000);
 const finVigencia = fecha(Date.now() + 30 * 86400000);
````

#### 🔧 EDITAR (diff) — `sciad-backend/verify-2d.mjs`

````diff
diff --git a/sciad-backend/verify-2d.mjs b/sciad-backend/verify-2d.mjs
index f634b7b..00d4e9c 100644
--- a/sciad-backend/verify-2d.mjs
+++ b/sciad-backend/verify-2d.mjs
@@ -13,8 +13,9 @@ const PG = { ...process.env, PGPASSWORD: 'sciad_local_dev_2026' };
 const PSQL = (sql) => execSync(`docker exec sciad-db psql -U sciad -d sciad -v ON_ERROR_STOP=1 -c "${sql}"`, { env: PG, encoding: 'utf8' });
 
 const R = Date.now().toString().slice(-8);
-const hoy = new Date().toISOString().slice(0, 10);
-const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
+// "hoy" = día de Guatemala (UTC-6): el backend guarda y filtra por hora de Guatemala (Fase 4)
+const hoy = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
+const ayer = new Date(Date.now() - 6 * 3600e3 - 86400000).toISOString().slice(0, 10);
 const horaAhora = new Date().toISOString().slice(11, 19);
 const fecha = (ms) => new Date(ms).toISOString().slice(0, 10);
 const iniVig = fecha(Date.now() - 1 * 86400000);
````

#### 🔧 EDITAR (diff) — `sciad-backend/verify-carga.mjs`

````diff
diff --git a/sciad-backend/verify-carga.mjs b/sciad-backend/verify-carga.mjs
index 4a457dc..99f984b 100644
--- a/sciad-backend/verify-carga.mjs
+++ b/sciad-backend/verify-carga.mjs
@@ -54,7 +54,7 @@ const ADMIN = await getToken('admin@sciad.gt', PASSWORD);
 const zona = await call('POST', '/api/zonas-acceso', { token: ADMIN, body: { nombre: `Z-CARGA-${SUF}`, nivelSeguridad: 'ALTO', nivelRiesgo: 'CRITICO', capacidad: N + K + M } });
 if (zona.status !== 201) throw new Error(`Zona no creada: ${zona.status} ${JSON.stringify(zona.body)}`);
 const zonaId = zona.body.id;
-const hoy    = new Date().toISOString().slice(0, 10);
+const hoy    = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10); // día de Guatemala (UTC-6), Fase 4
 const finVig = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
 
 let seqPersona = 0; // contador global: dpiCodigo único sin importar el grupo
````

#### 🔧 EDITAR (diff) — `sciad-backend/verify-fase3-rec.mjs`

````diff
diff --git a/sciad-backend/verify-fase3-rec.mjs b/sciad-backend/verify-fase3-rec.mjs
index 6bafbf4..d13ad9c 100644
--- a/sciad-backend/verify-fase3-rec.mjs
+++ b/sciad-backend/verify-fase3-rec.mjs
@@ -23,7 +23,7 @@ const R = Date.now().toString().slice(-8);
 const fecha = (ms) => new Date(ms).toISOString().slice(0, 10);
 const iniVig = fecha(Date.now() - 1 * 86400000);
 const finVig = fecha(Date.now() + 30 * 86400000);
-const hoy = new Date().toISOString().slice(0, 10);
+const hoy = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10); // día de Guatemala (UTC-6), Fase 4
 
 let pass = 0, fail = 0, hallazgos = [];
 function check(name, cond, extra = '') {
````

### 3.6 Pruebas del frontend de la Fase 1 actualizadas a la hora de Guatemala (reemplazos completos)

#### ♻️ REEMPLAZAR POR COMPLETO — `sciad-frontend/tests-fase1/logic.test.mjs`
Ahora el servidor simulado guarda hora de Guatemala; `e2e.mjs` además crea `out/` solo.
````js
process.env.TZ = 'America/Guatemala'; // portable (Windows/Linux/macOS); debe fijarse antes de usar Date
import assert from 'node:assert/strict';
import { extractToken, ScanGate, TOKEN_RE } from '../src/app/core/util/token.ts';
import { horaLocal, fechaLocal, hoyServidor } from '../src/app/core/util/time.ts';

let n = 0; const ok = (name, fn) => { fn(); n++; console.log('  ✓', name); };
const T = 'A'.repeat(32) + '0123456789abcdef'.repeat(2);   // 64 hex
assert.equal(T.length, 64);

console.log('token.ts');
ok('acepta token puro', () => assert.equal(extractToken(T), T));
ok('recorta espacios/saltos', () => assert.equal(extractToken('  ' + T + '\n'), T));
ok('extrae token dentro de URL', () => assert.equal(extractToken('https://x.gt/c/' + T + '?a=1'), T));
ok('rechaza 63 y 65 hex', () => { assert.equal(extractToken(T.slice(1)), null); assert.equal(extractToken(T + 'a'), null); });
ok('rechaza texto no hex / vacío / null', () => { assert.equal(extractToken('hola'), null); assert.equal(extractToken(''), null); assert.equal(extractToken(null), null); });
ok('rechaza 64 chars con una letra no-hex', () => assert.equal(extractToken('g' + T.slice(1)), null));

console.log('ScanGate');
const g = new ScanGate({ holdMs: 2500, sameTokenMs: 15000 });
ok('primer token se procesa', () => assert.equal(g.canProcess(T, 0), true));
g.begin(T, 0);
ok('bloquea mientras hay petición en curso (otro token)', () => assert.equal(g.canProcess('B'.repeat(64), 100), false));
g.end(300);
ok('bloquea todo durante holdMs tras terminar', () => assert.equal(g.canProcess('B'.repeat(64), 1000), false));
ok('otro token pasa tras holdMs', () => assert.equal(g.canProcess('B'.repeat(64), 2900), true));
ok('mismo token bloqueado hasta sameTokenMs', () => { assert.equal(g.canProcess(T, 5000), false); assert.equal(g.canProcess(T, 14999), false); });
ok('mismo token permitido pasado sameTokenMs', () => assert.equal(g.canProcess(T, 15001), true));
ok('forget() permite reintento inmediato (fallo de red)', () => { g.forget(); assert.equal(g.canProcess(T, 3000), true); });

console.log('time.ts (el backend guarda hora de Guatemala = UTC-6; Fase 4)');
ok('TZ del proceso = America/Guatemala', () => assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, 'America/Guatemala'));
ok('07:15:32 (GT) se muestra 07:15', () => assert.equal(horaLocal('2026-08-21', '07:15:32'), '07:15'));
ok('acepta fracciones de segundo del servidor', () => assert.equal(horaLocal('2026-08-21', '07:15:32.1234567'), '07:15'));
ok('18:30 (GT) sigue siendo el mismo día (el error de las 6 pm)', () => { assert.equal(horaLocal('2026-08-21', '18:30:00'), '18:30'); assert.equal(fechaLocal('2026-08-21', '18:30:00'), '2026-08-21'); });
ok('entradas inválidas no rompen (fallback)', () => { assert.equal(horaLocal(null, '13:15:32'), '13:15'); assert.equal(horaLocal('x', 'y'), 'y'.slice(0,5)); });
ok('hoyServidor: 05:59Z = día 21; 06:00Z = día 22 (medianoche de Guatemala)', () => { assert.equal(hoyServidor(new Date('2026-08-22T05:59:59Z')), '2026-08-21'); assert.equal(hoyServidor(new Date('2026-08-22T06:00:00Z')), '2026-08-22'); });
ok('hoyServidor: 00:30Z del 22 sigue siendo el día 21 (18:30 en Guatemala)', () => assert.equal(hoyServidor(new Date('2026-08-22T00:30:00Z')), '2026-08-21'));
console.log(`\n${n} pruebas OK`);
````

#### ♻️ REEMPLAZAR POR COMPLETO — `sciad-frontend/tests-fase1/mock-server.mjs`
Ahora el servidor simulado guarda hora de Guatemala; `e2e.mjs` además crea `out/` solo.
````js
// Servidor simulado que respeta el CONTRATO real del backend (DTOs, Problem Details con code/detail,
// alternancia ingreso/egreso, 409 por UNIQUE, 401 por token expirado). Sirve además el build de Angular.
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOK = JSON.parse(readFileSync(new URL('./tokens.json', import.meta.url)));
const DIST = fileURLToPath(new URL('../dist/sciad-frontend/browser', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

export function createServer() {
  const log = [];            // POST /registros-acceso recibidos: {token, status, code, tipo}
  const movs = [];           // movimientos persistidos
  const zonas = [
    { id: '1', nombre: 'Entrada Principal', nivelSeguridad: 'MEDIO', capacidad: 50, nivelRiesgo: 'BAJO', estado: 'activo' },
    { id: '2', nombre: 'Sala de Servidores', nivelSeguridad: 'ALTO', capacidad: 5, nivelRiesgo: 'ALTO', estado: 'activo' },
  ];
  const persona = { id: '7', nombre: 'Juan Pérez López', dpiCodigo: '2345678901234', tipo: 1, estado: 'activo' };
  const creds = [
    { id: '1', personaId: '7', personaNombre: persona.nombre, dpiCodigo: persona.dpiCodigo, token: TOK.A, estado: 'activa', emitido: '2026-08-21', motivo: null, reemitidoDe: null },
    { id: '2', personaId: '7', personaNombre: persona.nombre, dpiCodigo: persona.dpiCodigo, token: TOK.REV, estado: 'revocada', emitido: '2026-08-01', motivo: 'Pérdida', reemitidoDe: null },
  ];
  const users = {
    'admin@sciad.gt': { rol: 'ADMIN', nombre: 'Lic. Marco Antonio Ortíz', token: 'ok.jwt' },
    'seguridad@sciad.gt': { rol: 'SEGURIDAD', nombre: 'Carlos Gómez Rivera', token: 'ok.jwt' },
    'expira@sciad.gt': { rol: 'ADMIN', nombre: 'Sesión Vencida', token: 'expired.jwt' },
  };
  const problem = (res, status, code, detail) => {
    res.writeHead(status, { 'Content-Type': 'application/problem+json' });
    res.end(JSON.stringify({ status, title: 'x', detail, code, message: detail }));
  };
  const json = (res, obj, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  const page = (items) => ({ items, total: items.length, pagina: 1, tamanoPagina: 500, totalPaginas: 1 });
  const body = (req) => new Promise((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => r(d ? JSON.parse(d) : {})); });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/api/')) {
      const auth = req.headers.authorization ?? '';
      const p = url.pathname;
      if (p === '/api/auth/login' && req.method === 'POST') {
        const { email, password } = await body(req);
        const u = users[email];
        if (!u || password !== 'sciad123') return problem(res, 401, 'UNAUTHORIZED', 'Credenciales inválidas.');
        return json(res, { token: u.token, user: { id: '1', nombre: u.nombre, email, rol: u.rol, puesto: 'x', activo: true, avatarInitials: 'XX', fechaCreacion: new Date().toISOString() } });
      }
      if (!auth.startsWith('Bearer ') || auth.includes('expired')) return problem(res, 401, 'UNAUTHORIZED', 'Token ausente, inválido o expirado.');
      if (p === '/api/zonas-acceso') return json(res, zonas);
      if (p === '/api/personas') return json(res, page([persona]));
      if (p === '/api/credenciales' && req.method === 'GET') return json(res, creds);
      if (p === '/api/notificaciones') return json(res, page([]));
      if (p === '/api/registros-acceso/hoy') {
        const rows = [];
        for (const m of movs) { const last = movs.filter((x) => x.personaId === m.personaId).at(-1); if (m === last) rows.push({ personaId: +m.personaId, personaNombre: persona.nombre, zonaId: +m.zonaId, zonaNombre: zonas[+m.zonaId - 1].nombre, ultimoTipo: m.tipo, ultimaHora: m.hora, dentro: m.tipo === 'ingreso' }); }
        return json(res, rows);
      }
      if (p === '/api/registros-acceso' && req.method === 'GET') {
        return json(res, page(movs.map((m, i) => ({ id: String(i + 1), personaId: +m.personaId, personaNombre: persona.nombre, zonaId: +m.zonaId, zonaNombre: zonas[+m.zonaId - 1].nombre, fecha: m.fecha, hora: m.hora, tipo: m.tipo, registradoPor: 'Carlos' }))));
      }
      if (p === '/api/registros-acceso' && req.method === 'POST') {
        const { token, zonaId } = await body(req);
        const entry = { token, status: 0, code: null, tipo: null, at: Date.now() };
        log.push(entry);
        const fail = (status, code, detail) => { entry.status = status; entry.code = code; return problem(res, status, code, detail); };
        if (!/^[0-9a-fA-F]{64}$/.test(token ?? '')) return fail(400, 'VALIDACION', 'Token inválido.');
        const c = creds.find((x) => x.token === token);
        if (!c) return fail(400, 'TOKEN_INVALIDO', 'El token de la credencial QR no es válido.');
        if (c.estado !== 'activa') return fail(400, 'CREDENCIAL_REVOCADA', 'La credencial está revocada o vencida.');
        const ing = movs.filter((m) => m.tipo === 'ingreso').length, egr = movs.filter((m) => m.tipo === 'egreso').length;
        const tipo = ing > egr ? 'egreso' : 'ingreso';
        if (tipo === 'ingreso' && ing > 0) return fail(409, 'CONFLICT', 'Ya existe un ingreso registrado para esta persona hoy (doble ingreso).');
        const now = new Date();
        const gt = new Date(now.getTime() - 6 * 3600e3); // el backend guarda la hora de Guatemala (UTC-6), Fase 4
        const m = { personaId: '7', zonaId: String(zonaId), tipo, fecha: gt.toISOString().slice(0, 10), hora: gt.toISOString().slice(11, 19) };
        movs.push(m); entry.status = 200; entry.tipo = tipo;
        return json(res, { id: String(movs.length), personaId: 7, personaNombre: persona.nombre, zonaId: +zonaId, zonaNombre: zonas[+zonaId - 1].nombre, tipo, fecha: m.fecha, hora: m.hora, estado: 'autorizado', timestamp: now.toISOString() });
      }
      return json(res, {}, 404);
    }
    let f = join(DIST, url.pathname === '/' ? 'index.html' : url.pathname);
    if (!existsSync(f) || statSync(f).isDirectory()) f = join(DIST, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[extname(f)] ?? 'application/octet-stream' });
    res.end(readFileSync(f));
  });
  return { server, log, movs, TOK };
}
````

#### ♻️ REEMPLAZAR POR COMPLETO — `sciad-frontend/tests-fase1/e2e.mjs`
Ahora el servidor simulado guarda hora de Guatemala; `e2e.mjs` además crea `out/` solo.
````js
// TZ: la prueba valida horas locales de Guatemala (portable, se fija antes de usar Date).
process.env.TZ = 'America/Guatemala';
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
mkdirSync(new URL('./out/', import.meta.url), { recursive: true }); // capturas de pantalla
import { createRequire } from 'node:module';
import os from 'node:os';
import { createServer } from './mock-server.mjs';
const require = createRequire(new URL('../package.json', import.meta.url));
const jsQR = require('jsqr'); const { PNG } = require('pngjs');

const PORT = 8099, BASE = `http://localhost:${PORT}`;
const { server, log, movs, TOK } = createServer();
await new Promise((r) => server.listen(PORT, '0.0.0.0', r));

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { (cond ? pass++ : fail++); console.log(`  ${cond ? '✓' : '✗ FALLO'} ${name}${extra ? '  → ' + extra : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms, step = 150) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(step); } return null; };

// Navegador: CHROME_PATH (Chrome/Edge instalado; Windows/macOS/Linux) o, en Linux, Chromium vía npm (@sparticuz/chromium).
async function resolverNavegador() {
  if (process.env.CHROME_PATH) return { executablePath: process.env.CHROME_PATH, headless: true };
  if (process.platform !== 'linux') throw new Error('Define CHROME_PATH con la ruta de Chrome/Edge (p. ej. C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe).');
  const chromium = (await import('@sparticuz/chromium')).default;
  return { executablePath: await chromium.executablePath(), headless: 'shell' };
}
const nav = await resolverNavegador();
const browser = await puppeteer.launch({
  ...nav,
  env: { ...process.env, TZ: 'America/Guatemala' },
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
    '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
    `--use-file-for-fake-video-capture=${fileURLToPath(new URL('./fake_cam.y4m', import.meta.url))}`],
});
const mobile = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';

async function login(page, base, email) {
  await page.goto(`${base}/login`, { waitUntil: 'networkidle0' });
  await page.type('input[type=email], input[formcontrolname=email], sci-input input', email);
  const inputs = await page.$$('form input');
  await inputs[1].type('sciad123');
  await page.click('form button.submit, form button[type=submit], form button');
}

// ───────────────────────── 1) ESCANEO CON CÁMARA (celular) ─────────────────────────
console.log('\n[1] Escaneo con cámara real (viewport de celular, cámara simulada)');
{
  const page = await browser.newPage(); await page.setViewport(mobile); await page.setUserAgent(UA);
  const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
  await login(page, BASE, 'seguridad@sciad.gt');
  await page.waitForFunction(() => location.pathname.includes('/seguridad/escaneo'), { timeout: 10000 });
  check('login SEGURIDAD → /seguridad/escaneo', true);

  const live = await until(() => page.$('.viewport.live'), 12000);
  check('cámara activa (viewport.live) sin pulsar nada', !!live);
  const vsz = await page.evaluate(() => { const v = document.querySelector('video'); return v ? [v.videoWidth, v.videoHeight, !!v.srcObject] : null; });
  check('el <video> recibe fotogramas', vsz && vsz[0] > 0, JSON.stringify(vsz));
  const iconos = await page.$$eval('sci-icon svg', (n) => n.filter((s) => s.children.length > 0).length);
  check('los íconos de la app se dibujan (SVG con contenido)', iconos > 3, `íconos con contenido=${iconos}`);
  const zona = await page.$eval('#zona-sel', (e) => e.value);
  check('zona preseleccionada automáticamente', zona === '1', `zona=${zona}`);

  // 1.a QR válido → ingreso (exactamente UNA petición aunque el QR esté 6 s frente a la cámara)
  const ok1 = await until(() => page.$('.overlay.ok'), 45000);
  check('QR válido → alerta VERDE', !!ok1);
  if (ok1) {
    const t = await page.$eval('.overlay.ok', (e) => e.innerText);
    check('muestra persona y tipo INGRESO', /Juan Pérez López/.test(t) && /INGRESO/.test(t), t.replace(/\n/g, ' | '));
    const hh = await page.$eval('.overlay.ok .o-when', (e) => e.textContent.trim());
    const d = new Date(), exp = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const near = Math.abs((+hh.slice(0, 2) * 60 + +hh.slice(3)) - (d.getHours() * 60 + d.getMinutes())) <= 1;
    check('hora mostrada = hora LOCAL (UTC-6), no UTC', near && hh !== new Date().toISOString().slice(11, 16), `mostrada=${hh} local≈${exp} utc=${new Date().toISOString().slice(11, 16)}`);
    await page.screenshot({ path: 'out/shot_scan_ok.png' });
  }
  await sleep(5500); // el QR sigue frente a la cámara varios segundos
  const aPosts1 = log.filter((l) => l.token === TOK.A).length;
  check('NO se duplica el escaneo mientras el QR sigue visible (1 petición)', aPosts1 === 1, `peticiones=${aPosts1}`);

  // 1.b QR revocado → rojo
  const bad = await until(() => page.$('.overlay.bad'), 30000);
  check('QR revocado → alerta ROJA', !!bad);
  if (bad) {
    const t = await page.$eval('.overlay.bad', (e) => e.innerText);
    check('título "Credencial revocada"', /Credencial revocada/.test(t), t.replace(/\n/g, ' | '));
    await page.screenshot({ path: 'out/shot_scan_bad.png' });
  }

  // 1.c QR ajeno → "Código no reconocido" sin llamar al servidor
  const before = log.length;
  const alien = await until(async () => (await page.$$eval('.overlay.bad .o-title', (n) => n.map((x) => x.textContent))).some((x) => /Código no reconocido/.test(x)), 30000);
  check('QR ajeno → "Código no reconocido"', !!alien);
  check('QR ajeno NO genera petición al servidor', log.length === before, `peticiones nuevas=${log.length - before}`);

  // 1.d Reaparece el QR válido (>15 s después) → EGRESO
  const egreso = await until(async () => { const t = await page.$$eval('.overlay.ok', (n) => n.map((x) => x.innerText)); return t.find((x) => /EGRESO/.test(x)); }, 45000);
  check('al volver a presentar la credencial → EGRESO (alternancia del servidor)', !!egreso);

  const seq = log.map((l) => `${l.token === TOK.A ? 'A' : l.token === TOK.REV ? 'REV' : '?'}:${l.status}${l.tipo ? '/' + l.tipo : ''}`).join('  ');
  check('secuencia de peticiones exacta: A ingreso, REV 400, A egreso', seq === 'A:200/ingreso  REV:400  A:200/egreso', seq);
  const rec = await page.$$eval('.rec', (n) => n.length);
  check('lista "Últimos escaneos" registra los resultados', rec >= 3, `filas=${rec}`);
  check('sin errores de consola/JS', errs.length === 0, errs.slice(0, 2).join(' || '));
  await page.close();
}

// ───────────────────────── 2) CONTEXTO NO SEGURO (HTTP por IP de red) ─────────────────────────
console.log('\n[2] Cámara sobre HTTP en IP de red (contexto no seguro) → mensaje claro');
{
  const ip = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
  if (!ip) { console.log('  (sin IP de red en este entorno, se omite)'); }
  else {
    const page = await browser.newPage(); await page.setViewport(mobile); await page.setUserAgent(UA);
    await login(page, `http://${ip}:${PORT}`, 'seguridad@sciad.gt');
    await page.waitForFunction(() => location.pathname.includes('/seguridad/escaneo'), { timeout: 10000 });
    const secure = await page.evaluate(() => window.isSecureContext);
    const msg = await until(() => page.$eval('.cam-error', (e) => e.innerText).catch(() => null), 8000);
    check('isSecureContext=false en http://IP', secure === false, `ip=${ip}`);
    check('explica que se necesita HTTPS y ofrece alternativas', !!msg && /HTTPS/.test(msg) && /foto/.test(msg), msg && msg.replace(/\n/g, ' | '));
    const btn = await page.$$eval('.actions button', (b) => b.map((x) => x.innerText.trim()));
    check('botón "Reintentar cámara" disponible', btn.some((t) => /Reintentar/.test(t)), btn.join(','));
    await page.screenshot({ path: 'out/shot_insecure.png' });
    await page.close();
  }
}

// ───────────────────────── 3) ADMIN: QR real, descarga, gafete, escaneo en PC ─────────────────────────
console.log('\n[3] Administrador en escritorio: QR real + gafete + escáner');
{
  const page = await browser.newPage(); await page.setViewport({ width: 1366, height: 800 });
  await login(page, BASE, 'admin@sciad.gt');
  await page.waitForFunction(() => location.pathname.includes('/admin/'), { timeout: 10000 });
  await page.goto(`${BASE}/admin/credenciales`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('table.sci-table tbody tr td');
  const ver = (await page.$$('button[aria-label="Ver"]'))[0]; await ver.click();
  await page.waitForSelector('img.qr-img', { timeout: 8000 });
  const src = await page.$eval('img.qr-img', (i) => i.src);
  const png = PNG.sync.read(Buffer.from(src.split(',')[1], 'base64'));
  const dec = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data;
  check('el modal muestra un QR REAL que decodifica exactamente al token', dec === TOK.A, `${dec?.slice(0, 12)}…`);
  const nota = await page.$eval('.qr-note', (e) => e.textContent);
  check('aclara que el QR no contiene datos personales', /no incluye datos personales/.test(nota));
  await page.screenshot({ path: 'out/shot_qr_modal.png' });

  // gafete: se arma el iframe de impresión con nombre + QR
  await page.evaluate(() => { window.__iframes = []; const orig = Node.prototype.appendChild; Node.prototype.appendChild = function (n) { const r = orig.call(this, n); if (n.tagName === 'IFRAME') window.__iframes.push(n); return r; }; });
  const [, btnImp] = await page.$$('.qr-actions button');
  await btnImp.click(); await sleep(1500);
  const gaf = await page.evaluate(() => { const f = window.__iframes[0]; const d = f?.contentDocument; return d ? { nombre: d.querySelector('.name')?.textContent, img: !!d.querySelector('img.qr')?.src.startsWith('data:image/png'), tipo: d.querySelector('.tipo')?.textContent } : null; });
  check('"Imprimir gafete" arma el gafete con nombre, tipo y QR', gaf && gaf.nombre === 'Juan Pérez López' && gaf.img, JSON.stringify(gaf));

  // credencial revocada: QR atenuado + sello + sin impresión
  await page.evaluate(() => document.querySelectorAll('button[aria-label="Ver"]')[1].click());
  await page.waitForSelector('.qr-stamp', { timeout: 5000 });
  const disabled = await page.$$eval('.qr-actions button', (b) => b[1].disabled);
  check('credencial revocada: sello "REVOCADA" y gafete deshabilitado', disabled === true);

  // el admin puede abrir el escáner en la PC
  await page.goto(`${BASE}/admin/escaneo`, { waitUntil: 'networkidle0' });
  const live = await until(() => page.$('.viewport.live'), 12000);
  check('Admin: /admin/escaneo abre la cámara de la computadora', !!live);
  const nav = await page.$$eval('.nav a', (a) => a.map((x) => x.innerText.trim()));
  check('menú de Admin incluye "Punto de acceso" y "Accesos de hoy"', nav.includes('Punto de acceso') && nav.includes('Accesos de hoy'), nav.join(' | '));
  await page.screenshot({ path: 'out/shot_admin_scan.png' });

  // pantallas con hora: muestran hora local
  await page.goto(`${BASE}/admin/accesos`, { waitUntil: 'networkidle0' });
  const h = await page.$$eval('.row-right .mono', (n) => n.map((x) => x.textContent.trim()).filter((t) => /\d\d:\d\d/.test(t)));
  const gtH = movs.at(-1)?.hora.slice(0, 5);                 // lo que guarda el backend (hora de Guatemala)
  const utcH = new Date().toISOString().slice(11, 16);        // hora UTC actual
  check('"Accesos de hoy" muestra la hora de Guatemala guardada (≠ UTC)', h.length > 0 && h[0] === gtH && h[0] !== utcH, `mostrada=${h[0]} guardada=${gtH} utc=${utcH}`);
  await page.close();
}

// ───────────────────────── 4) SESIÓN EXPIRADA ─────────────────────────
console.log('\n[4] Token vencido (401) → vuelve al login');
{
  const page = await browser.newPage(); await page.setViewport({ width: 1100, height: 800 });
  await login(page, BASE, 'expira@sciad.gt');
  const back = await page.waitForFunction(() => location.pathname === '/login' && !localStorage.getItem('sciad.session'), { timeout: 10000 }).then(() => true).catch(() => false);
  check('401 en cualquier endpoint → sesión cerrada y redirige a /login', back);
  await page.close();
}

console.log(`\nRESULTADO: ${pass} ✓  ${fail} ✗`);
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
````

---

## 4. PASO 2 — Fase 5 · Errores de funcionamiento hallados y endurecimiento

### 4.1 Listas truncadas a 20 filas
El backend limita `tamanoPagina` a 100 y, si se pide más, devuelve **20** (historial, notificaciones, auditoría, reportes). El frontend pedía 500.

#### 🔧 EDITAR (diff) — `sciad-frontend/src/app/core/services/crud.service.ts`
Pide 100 y agrega `historialPagina()` (con `total` real).
````diff
diff --git a/sciad-frontend/src/app/core/services/crud.service.ts b/sciad-frontend/src/app/core/services/crud.service.ts
index 104e022..11539e6 100644
--- a/sciad-frontend/src/app/core/services/crud.service.ts
+++ b/sciad-frontend/src/app/core/services/crud.service.ts
@@ -23,6 +23,13 @@ import { Paginado } from '../models/paginado.model';
 
 const API = environment.apiUrl;
 
+/**
+ * Tamaño de página máximo que acepta el backend en historial, notificaciones, auditoría y reportes.
+ * Si se pide más de 100, esos servicios IGNORAN el valor y devuelven 20 filas (truncando la lista sin avisar),
+ * por eso se pide exactamente 100. (Usuarios y personas no tienen ese tope.)
+ */
+const MAX_PAGINA = '100';
+
 /** Desempaqueta PaginadoDto → items (el frontend no necesita paginación real). */
 function unwrapItems<T>() {
   return map((page: Paginado<T>) => page.items);
@@ -179,13 +186,19 @@ export class AccessLogService {
   historial(filtros?: {
     personaId?: number; zonaId?: number; desde?: string; hasta?: string; tipo?: 'ingreso' | 'egreso';
   }): Observable<RegistroHistorial[]> {
-    let params = new HttpParams().set('tamanoPagina', '500');
+    return this.historialPagina(filtros).pipe(unwrapItems());
+  }
+  /** Igual que `historial` pero devuelve la página completa (con `total` real) y permite fijar `tamanoPagina` (≤ 100). */
+  historialPagina(filtros?: {
+    personaId?: number; zonaId?: number; desde?: string; hasta?: string; tipo?: 'ingreso' | 'egreso'; tamanoPagina?: number;
+  }): Observable<Paginado<RegistroHistorial>> {
+    let params = new HttpParams().set('tamanoPagina', String(Math.min(filtros?.tamanoPagina ?? 100, 100)));
     if (filtros?.personaId) params = params.set('personaId', String(filtros.personaId));
     if (filtros?.zonaId) params = params.set('zonaId', String(filtros.zonaId));
     if (filtros?.desde) params = params.set('desde', filtros.desde);
     if (filtros?.hasta) params = params.set('hasta', filtros.hasta);
     if (filtros?.tipo) params = params.set('tipo', filtros.tipo);
-    return this.http.get<Paginado<RegistroHistorial>>(`${API}/registros-acceso`, { params }).pipe(unwrapItems());
+    return this.http.get<Paginado<RegistroHistorial>>(`${API}/registros-acceso`, { params });
   }
 }
 
@@ -194,7 +207,7 @@ export class NotificationsService {
   constructor(private http: HttpClient) {}
   /** GET /api/notificaciones?tamanoPagina=N → Notificacion[]. */
   list(): Observable<Notificacion[]> {
-    const params = new HttpParams().set('tamanoPagina', '500');
+    const params = new HttpParams().set('tamanoPagina', MAX_PAGINA);
     return this.http.get<Paginado<Notificacion>>(`${API}/notificaciones`, { params }).pipe(unwrapItems());
   }
   /** PATCH /api/notificaciones/{id}/leida {leida}. */
@@ -208,7 +221,7 @@ export class AuditService {
   constructor(private http: HttpClient) {}
   /** GET /api/auditoria?tipo&estado → HallazgoAuditoria[]. */
   list(filtros?: { tipo?: string; estado?: string }): Observable<HallazgoAuditoria[]> {
-    let params = new HttpParams().set('tamanoPagina', '500');
+    let params = new HttpParams().set('tamanoPagina', MAX_PAGINA);
     if (filtros?.tipo) params = params.set('tipo', filtros.tipo);
     if (filtros?.estado) params = params.set('estado', filtros.estado);
     return this.http.get<Paginado<HallazgoAuditoria>>(`${API}/auditoria`, { params }).pipe(unwrapItems());
@@ -228,7 +241,7 @@ export class ReportsService {
   constructor(private http: HttpClient) {}
   /** GET /api/reportes → Reporte[] (paginado desempaquetado). */
   list(): Observable<Reporte[]> {
-    const params = new HttpParams().set('tamanoPagina', '500');
+    const params = new HttpParams().set('tamanoPagina', MAX_PAGINA);
     return this.http.get<Paginado<Reporte>>(`${API}/reportes`, { params }).pipe(unwrapItems());
   }
   /** POST /api/reportes/generar → CSV (blob). El backend NO guarda el archivo; devuelve el CSV. */
````

### 4.2 Gerencia debe poder **leer** personas (CU-06 y CU-07: filtrar historial y reportes por colaborador)

`GET /api/personas` era solo Admin → 403 para Gerencia (filtros vacíos). Se permite la **lectura** a Admin y Gerencia; crear/actualizar/baja siguen **solo Admin**.
> **Decisión de privacidad a mencionar al usuario en el informe:** Gerencia verá nombre, DPI, tipo y estado de las personas (solo lectura). Si prefiere no exponerlo,
> se revierte este sub-paso (4.2) y el frontend sigue funcionando (deriva el filtro de los registros), pero el filtro por persona de **Reportes** quedaría vacío para Gerencia.

#### 🔧 EDITAR (diff) — `sciad-backend/src/Sciad.Api/Controllers/PersonasController.cs`
Solo atributos de autorización (mismo patrón que `ZonasAccesoController`).
````diff
diff --git a/sciad-backend/src/Sciad.Api/Controllers/PersonasController.cs b/sciad-backend/src/Sciad.Api/Controllers/PersonasController.cs
index 0428a75..a91d856 100644
--- a/sciad-backend/src/Sciad.Api/Controllers/PersonasController.cs
+++ b/sciad-backend/src/Sciad.Api/Controllers/PersonasController.cs
@@ -7,9 +7,12 @@ using Sciad.Application.Interfaces;
 
 namespace Sciad.Api.Controllers;
 
-/// <summary>CRUD administrativo de personas (Colaboradores/Visitantes). Solo rol Administrador.</summary>
+/// <summary>
+/// Personas (Colaboradores/Visitantes). <b>Lectura</b> (listado): Administrador o Gerencia/Auditoría — necesaria para
+/// filtrar historial y reportes por colaborador (CU-06/CU-07). <b>Escritura</b> (crear/actualizar/baja lógica): solo Administrador.
+/// </summary>
 [ApiController]
-[Authorize(Policy = "RequireAdmin")]
+[Authorize]
 [Route("api/personas")]
 public sealed class PersonasController : ControllerBase
 {
@@ -25,6 +28,7 @@ public sealed class PersonasController : ControllerBase
     /// y por <c>estado</c> (activo/inactivo).
     /// </summary>
     [HttpGet]
+    [Authorize(Policy = "RequireAdminOGerencia")]
     [ProducesResponseType(typeof(PaginadoDto<PersonaDto>), StatusCodes.Status200OK)]
     [ProducesResponseType(StatusCodes.Status400BadRequest)]
     public async Task<IActionResult> Listar(
@@ -40,6 +44,7 @@ public sealed class PersonasController : ControllerBase
 
     /// <summary>Crea una persona. 409 si el DPI ya existe.</summary>
     [HttpPost]
+    [Authorize(Policy = "RequireAdmin")]
     [ProducesResponseType(typeof(PersonaDto), StatusCodes.Status201Created)]
     [ProducesResponseType(StatusCodes.Status400BadRequest)]
     [ProducesResponseType(StatusCodes.Status409Conflict)]
@@ -52,6 +57,7 @@ public sealed class PersonasController : ControllerBase
     }
 
     [HttpPut("{id:int}")]
+    [Authorize(Policy = "RequireAdmin")]
     [ProducesResponseType(typeof(PersonaDto), StatusCodes.Status200OK)]
     [ProducesResponseType(StatusCodes.Status400BadRequest)]
     [ProducesResponseType(StatusCodes.Status404NotFound)]
@@ -64,6 +70,7 @@ public sealed class PersonasController : ControllerBase
 
     /// <summary>Alta/baja lógica: <c>{"estado":"activo|inactivo"}</c>. Nunca borrado físico.</summary>
     [HttpPatch("{id:int}/estado")]
+    [Authorize(Policy = "RequireAdmin")]
     [ProducesResponseType(typeof(PersonaDto), StatusCodes.Status200OK)]
     [ProducesResponseType(StatusCodes.Status400BadRequest)]
     [ProducesResponseType(StatusCodes.Status404NotFound)]
````

#### 🔧 EDITAR (diff) — `sciad-backend/tests/Sciad.Tests/Auth/RbacPolicyTests.cs`
Matriz RBAC: `Personas.Listar` → `RequireAdminOGerencia`.
````diff
diff --git a/sciad-backend/tests/Sciad.Tests/Auth/RbacPolicyTests.cs b/sciad-backend/tests/Sciad.Tests/Auth/RbacPolicyTests.cs
index 1c93097..2f8ccbd 100644
--- a/sciad-backend/tests/Sciad.Tests/Auth/RbacPolicyTests.cs
+++ b/sciad-backend/tests/Sciad.Tests/Auth/RbacPolicyTests.cs
@@ -89,7 +89,7 @@ public sealed class RbacPolicyTests
         foreach (var (c, acciones) in new[]
                  {
                      ("UsuariosController", new[] { "Listar", "Crear", "Actualizar", "CambiarEstado" }),
-                     ("PersonasController", new[] { "Listar", "Crear", "Actualizar", "CambiarEstado" }),
+                     ("PersonasController", new[] { "Crear", "Actualizar", "CambiarEstado" }),
                      ("PerfilesAccesoController", new[] { "Listar", "Crear", "Eliminar" }),
                      ("CredencialesController", new[] { "Listar", "Generar", "Reemitir", "Revocar" }),
                  })
@@ -100,6 +100,9 @@ public sealed class RbacPolicyTests
             }
         }
 
+        // --- Personas: lectura (Listar) Admin o Gerencia (filtros de historial/reportes por colaborador, CU-06/07); escritura solo Admin ---
+        Espera("PersonasController", "Listar", "RequireAdminOGerencia");
+
         // --- Zonas: lectura a cualquier rol autenticado, escritura solo Admin ---
         Espera("ZonasAccesoController", "Listar", "RequireZonaLectura");
         Espera("ZonasAccesoController", "Crear", "RequireAdmin");
````

#### 🔧 EDITAR (diff) — `sciad-backend/verify-seguridad.mjs`
Matriz E2E: `GET /api/personas` permitido a ADMIN y GERENCIA.
````diff
diff --git a/sciad-backend/verify-seguridad.mjs b/sciad-backend/verify-seguridad.mjs
index 5d721a4..5d04012 100644
--- a/sciad-backend/verify-seguridad.mjs
+++ b/sciad-backend/verify-seguridad.mjs
@@ -65,7 +65,7 @@ const MATRIZ = [
   ['POST',   '/api/zonas-acceso',                   {},   ['ADMIN'], false],
   ['PUT',    '/api/zonas-acceso/999999999',         { nombre: 'X', nivelSeguridad: 'ALTO' }, ['ADMIN'], false],
   ['PATCH',  '/api/zonas-acceso/999999999/estado',  { estado: 'inactivo' }, ['ADMIN'], false],
-  ['GET',    '/api/personas',                       null, ['ADMIN'], false],
+  ['GET',    '/api/personas',                       null, ['ADMIN', 'GERENCIA'], false],
   ['POST',   '/api/personas',                       {},   ['ADMIN'], false],
   ['PUT',    '/api/personas/999999999',             {},   ['ADMIN'], false],
   ['PATCH',  '/api/personas/999999999/estado',      {},   ['ADMIN'], false],
````

#### 🔧 EDITAR (diff) — `sciad-frontend/src/app/features/management/traceability.component.ts`
Resistente a 403: deriva el filtro de personas de los registros.
````diff
diff --git a/sciad-frontend/src/app/features/management/traceability.component.ts b/sciad-frontend/src/app/features/management/traceability.component.ts
index f546564..59f2740 100644
--- a/sciad-frontend/src/app/features/management/traceability.component.ts
+++ b/sciad-frontend/src/app/features/management/traceability.component.ts
@@ -3,7 +3,6 @@
 import { Component, computed, inject, OnInit, signal } from '@angular/core';
 import { AccessLogService, PersonasService, ZonasService } from '../../core/services/crud.service';
 import { RegistroHistorial } from '../../core/models/access-log.model';
-import { Persona } from '../../core/models/persona.model';
 import { Zona } from '../../core/models/access.model';
 import { Card } from '../../shared/ui/card.component';
 import { Button } from '../../shared/ui/button.component';
@@ -105,12 +104,16 @@ export class TraceabilityComponent implements OnInit {
 
   protected readonly badgeTipo = badgeTipo;
 
-  // fecha/hora vienen en UTC del servidor: se muestran en hora local del dispositivo.
+  // fecha/hora vienen en hora de Guatemala (Fase 4): se muestran en la hora del dispositivo.
   protected fechaDe(r: RegistroHistorial): string { return fechaLocal(r.fecha, r.hora); }
   protected horaDe(r: RegistroHistorial): string { return horaLocal(r.fecha, r.hora); }
   protected readonly loading = signal(true);
   protected readonly rows = signal<RegistroHistorial[]>([]);
-  protected readonly personas = signal<Persona[]>([]);
+  // Opciones del filtro "persona": se usa el listado del backend (GET /api/personas permite lectura a Gerencia, CU-06).
+  // Si el backend lo negara (403), no se rompe la pantalla: se derivan de los registros ya cargados.
+  private readonly personasApi = signal<{ id: string; nombre: string }[]>([]);
+  private readonly personasVistas = signal<{ id: string; nombre: string }[]>([]);
+  protected readonly personas = computed(() => (this.personasApi().length ? this.personasApi() : this.personasVistas()));
   protected readonly zonas = signal<Zona[]>([]);
   protected readonly personaId = signal('');
   protected readonly zonaId = signal('');
@@ -122,7 +125,10 @@ export class TraceabilityComponent implements OnInit {
 
   ngOnInit(): void {
     this.load();
-    this.personasSvc.list().subscribe((ps) => this.personas.set(ps));
+    this.personasSvc.list().subscribe({
+      next: (ps) => this.personasApi.set(ps.map((p) => ({ id: String(p.id), nombre: p.nombre }))),
+      error: () => undefined, // sin permiso: se usan las personas vistas en los registros
+    });
     this.zonasSvc.list().subscribe((zs) => this.zonas.set(zs));
   }
 
@@ -138,12 +144,22 @@ export class TraceabilityComponent implements OnInit {
       .subscribe({
         next: (list) => {
           this.rows.set(list);
+          this.recordarPersonas(list);
           this.loading.set(false);
         },
         error: () => this.loading.set(false),
       });
   }
 
+  /** Acumula (sin repetir) las personas vistas en los registros para poblar el filtro. */
+  private recordarPersonas(list: RegistroHistorial[]): void {
+    const actuales = new Map(this.personasVistas().map((p) => [p.id, p.nombre]));
+    for (const r of list) actuales.set(String(r.personaId), r.personaNombre);
+    if (actuales.size !== this.personasVistas().length) {
+      this.personasVistas.set([...actuales].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
+    }
+  }
+
   protected onPersona(e: Event): void {
     this.personaId.set((e.target as HTMLSelectElement).value);
     this.load();
````

#### 🔧 EDITAR (diff) — `sciad-frontend/src/app/features/reports/reports.component.ts`
No se rompe si no hay permiso.
````diff
diff --git a/sciad-frontend/src/app/features/reports/reports.component.ts b/sciad-frontend/src/app/features/reports/reports.component.ts
index af9e394..2e15f71 100644
--- a/sciad-frontend/src/app/features/reports/reports.component.ts
+++ b/sciad-frontend/src/app/features/reports/reports.component.ts
@@ -148,7 +148,7 @@ export class ReportsComponent implements OnInit {
 
   ngOnInit(): void {
     this.load();
-    this.personasSvc.list().subscribe((ps) => this.personas.set(ps));
+    this.personasSvc.list().subscribe({ next: (ps) => this.personas.set(ps), error: () => undefined }); // sin permiso: lista vacía, sin romper
     this.zonasSvc.list().subscribe((zs) => this.zonas.set(zs));
   }
 
````

### 4.3 Cuentas demo ocultas en producción, y límite de login en desarrollo

#### 📄 NUEVO — `sciad-frontend/src/environments/environment.prod.ts`
`ng build --configuration production` (Docker y túnel) sustituye `environment.ts` por este archivo.
````ts
// Entorno de PRODUCCIÓN (`ng build --configuration production`, que es el que usan Docker y el túnel).
// Sustituye a environment.ts mediante `fileReplacements` en angular.json.
export const environment = {
  production: true,
  apiUrl: '/api',
  // Las cuentas demo NO se muestran en el login. Para una demostración (defensa de tesis) ponlo en `true`
  // y vuelve a compilar; recuerda que cualquiera con la URL vería las contraseñas demo.
  showDemoAccounts: false,
};
````

#### 🔧 EDITAR (diff) — `sciad-frontend/src/environments/environment.ts`

````diff
diff --git a/sciad-frontend/src/environments/environment.ts b/sciad-frontend/src/environments/environment.ts
index 7992a67..8e8143b 100644
--- a/sciad-frontend/src/environments/environment.ts
+++ b/sciad-frontend/src/environments/environment.ts
@@ -6,4 +6,6 @@
 export const environment = {
   production: false,
   apiUrl: '/api',
+  // Muestra en el login las cuentas demo (con contraseña). Solo desarrollo (`ng serve`).
+  showDemoAccounts: true,
 };
````

#### 🔧 EDITAR (diff) — `sciad-frontend/angular.json`
`fileReplacements` de producción.
````diff
diff --git a/sciad-frontend/angular.json b/sciad-frontend/angular.json
index 0101a15..370df14 100644
--- a/sciad-frontend/angular.json
+++ b/sciad-frontend/angular.json
@@ -74,7 +74,13 @@
                   "maximumError": "10kB"
                 }
               ],
-              "outputHashing": "all"
+              "outputHashing": "all",
+              "fileReplacements": [
+                {
+                  "replace": "src/environments/environment.ts",
+                  "with": "src/environments/environment.prod.ts"
+                }
+              ]
             },
             "development": {
               "optimization": false,
````

#### 🔧 EDITAR (diff) — `sciad-frontend/src/app/features/auth/login.component.ts`
Las cuentas demo solo se muestran si `environment.showDemoAccounts`.
````diff
diff --git a/sciad-frontend/src/app/features/auth/login.component.ts b/sciad-frontend/src/app/features/auth/login.component.ts
index c7f3b01..78010f8 100644
--- a/sciad-frontend/src/app/features/auth/login.component.ts
+++ b/sciad-frontend/src/app/features/auth/login.component.ts
@@ -8,6 +8,7 @@ import { Button } from '../../shared/ui/button.component';
 import { SciInput } from '../../shared/ui/field.component';
 import { ToastService } from '../../shared/ui/toast.service';
 import { homeFor } from '../../core/auth/paths';
+import { environment } from '../../../environments/environment';
 
 @Component({
   selector: 'app-login',
@@ -50,17 +51,19 @@ import { homeFor } from '../../core/auth/paths';
           </button>
         </form>
 
-        <div class="demo">
-          <div class="demo-label uppercase-label">Cuentas de demostración</div>
-          <div class="demo-grid">
-            @for (acc of demoAccounts; track acc.email) {
-              <button type="button" class="demo-chip" (click)="fill(acc.email, acc.password)">
-                <span class="dot" [class]="'d-' + acc.rol.toLowerCase()"></span>
-                <span>{{ acc.label }}</span>
-              </button>
-            }
+        @if (showDemoAccounts) {
+          <div class="demo">
+            <div class="demo-label uppercase-label">Cuentas de demostración</div>
+            <div class="demo-grid">
+              @for (acc of demoAccounts; track acc.email) {
+                <button type="button" class="demo-chip" (click)="fill(acc.email, acc.password)">
+                  <span class="dot" [class]="'d-' + acc.rol.toLowerCase()"></span>
+                  <span>{{ acc.label }}</span>
+                </button>
+              }
+            </div>
           </div>
-        </div>
+        }
       </div>
     </div>
   `,
@@ -178,6 +181,8 @@ export class LoginComponent {
   private readonly toast = inject(ToastService);
 
   protected readonly demoAccounts = DEMO_ACCOUNTS;
+  /** Las cuentas demo (con su contraseña) solo se muestran en desarrollo; el build de producción las oculta. */
+  protected readonly showDemoAccounts = environment.showDemoAccounts;
   protected readonly loading = signal(false);
   protected readonly serverError = signal<string | null>(null);
 
````

#### 🔧 EDITAR (diff) — `docker-compose.yml`
Límite de login configurable en desarrollo (tras nginx todos comparten IP).
````diff
diff --git a/docker-compose.yml b/docker-compose.yml
index 1b9d45a..2e0f2cb 100644
--- a/docker-compose.yml
+++ b/docker-compose.yml
@@ -40,6 +40,11 @@ services:
       - ConnectionStrings__Postgres=Host=db;Port=5432;Database=${POSTGRES_DB};Username=${POSTGRES_USER};Password=${POSTGRES_PASSWORD};Maximum Pool Size=${POSTGRES_MAX_POOL:-400}
       - Jwt__Secreto=${SCIAD_JWT_SECRET}
       - Cors__Origins=${SCIAD_CORS_ORIGINS}
+      # Tras el nginx del frontend todos los clientes llegan con la IP del proxy: el límite de login (5 por 5 min,
+      # SEC-04) se compartiría entre TODOS los usuarios. En desarrollo se amplía; en producción se usa
+      # KnownProxies (docker-compose.prod.yml) y el límite estricto.
+      - RateLimit__LoginPermitLimit=${RATE_LIMIT_LOGIN_PERMIT:-30}
+      - RateLimit__LoginWindowSeconds=${RATE_LIMIT_LOGIN_WINDOW:-300}
     depends_on:
       db:
         condition: service_healthy
````

#### 🔧 EDITAR (diff) — `.gitignore`
Ignora la salida de la demo (contiene tokens).
````diff
diff --git a/.gitignore b/.gitignore
index 243a589..03be3cc 100644
--- a/.gitignore
+++ b/.gitignore
@@ -10,3 +10,7 @@ sciad-backend/obj/
 sciad-backend/tests/**/bin/
 sciad-backend/tests/**/obj/
 sciad-backend/tests/TestResults/
+
+# Salida del script de datos demo (contiene tokens QR)
+demo-credenciales.json
+demo-gafetes.html
````

---

## 5. PASO 3 — Fase 3 · Datos demo y guía

#### 📄 NUEVO — `sciad-backend/seed-demo.mjs`
Idempotente; usa la API real. `SCIAD_BASE` (por defecto `http://localhost:3000`).
````js
// Datos de demostración de SCIAD (Fase 3) — crea, POR LA API REAL, zonas, personas, perfiles y credenciales
// para poder probar el escaneo de inmediato, y genera una hoja con los QR (demo-gafetes.html).
//
// Uso:   node seed-demo.mjs                       (API en http://localhost:3000, la del docker-compose de desarrollo)
//        SCIAD_BASE=http://localhost:8080 node seed-demo.mjs     (a través de nginx/frontend)
//
// Es IDEMPOTENTE: puede ejecutarse varias veces; reutiliza lo que ya existe (zonas por nombre, personas por DPI,
// perfiles por persona+zona, credenciales por persona). No borra nada. Requiere la cuenta admin@sciad.gt del seeder.
import { writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');                         // carpeta SCIAD/
const BASE = (process.env.SCIAD_BASE ?? 'http://localhost:3000').replace(/\/$/, '');
const ADMIN = { email: process.env.SCIAD_ADMIN ?? 'admin@sciad.gt', password: process.env.SCIAD_PASSWORD ?? 'sciad123' };

// "hoy" según el servidor = día de Guatemala (UTC-6)
const fechaGT = (offsetDias = 0) => new Date(Date.now() - 6 * 3600e3 + offsetDias * 86400e3).toISOString().slice(0, 10);

async function call(method, path, { token, body } = {}) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await r.json(); } catch { /* sin cuerpo */ }
  return { status: r.status, body: json };
}
const must = (r, ok, what) => {
  if (!ok.includes(r.status)) throw new Error(`${what}: HTTP ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
};
const items = (b) => (Array.isArray(b) ? b : b?.items ?? []);

// ── Definición de la demostración ───────────────────────────────────────────────────────────
const ZONAS = [
  { nombre: 'Entrada Principal', nivelSeguridad: 'BAJO', nivelRiesgo: 'BAJO', capacidad: 200 },
  { nombre: 'Oficinas', nivelSeguridad: 'MEDIO', nivelRiesgo: 'MEDIO', capacidad: 80 },
  { nombre: 'Sala de Servidores', nivelSeguridad: 'ALTO', nivelRiesgo: 'CRITICO', capacidad: 5 },
];
// perfiles: { zona, ini, fin } con offsets en días respecto a hoy
const VIGENTE = { ini: -30, fin: 365 };
const VENCIDO = { ini: -400, fin: -35 };
const PERSONAS = [
  { dpi: 'DEMO-0001', nombre: 'Juan Pérez López', tipo: 1, escenario: 'Acceso normal en Entrada Principal y Oficinas',
    esperado: '✅ Autorizado (ingreso; al volver a escanear: egreso)', perfiles: [['Entrada Principal', VIGENTE], ['Oficinas', VIGENTE]] },
  { dpi: 'DEMO-0002', nombre: 'María Fernanda Ruiz', tipo: 1, escenario: 'Acceso total, incluida la Sala de Servidores',
    esperado: '✅ Autorizado en las 3 zonas', perfiles: [['Entrada Principal', VIGENTE], ['Oficinas', VIGENTE], ['Sala de Servidores', VIGENTE]] },
  { dpi: 'DEMO-0003', nombre: 'Carlos Méndez Soto', tipo: 1, escenario: 'Perfil de acceso VENCIDO',
    esperado: '❌ Fuera de vigencia (y genera notificación a Gerencia)', perfiles: [['Entrada Principal', VENCIDO]] },
  { dpi: 'DEMO-0004', nombre: 'Ana Lucía Castillo', tipo: 1, escenario: 'Credencial REVOCADA (extraviada)',
    esperado: '❌ Credencial revocada (y genera notificación a Gerencia)', perfiles: [['Entrada Principal', VIGENTE]], revocar: 'Demo: credencial extraviada' },
  { dpi: 'DEMO-0005', nombre: 'Roberto Aguilar', tipo: 2, escenario: 'Visitante solo con acceso a Entrada Principal',
    esperado: '✅ En Entrada Principal · ❌ Zona no autorizada en Oficinas', perfiles: [['Entrada Principal', VIGENTE]] },
  { dpi: 'DEMO-0006', nombre: 'Sofía Morales', tipo: 2, escenario: 'Visitante SIN perfil de acceso',
    esperado: '❌ Zona no autorizada', perfiles: [] },
];

console.log(`SCIAD · datos demo → ${BASE}\n`);
const login = await call('POST', '/api/auth/login', { body: ADMIN });
if (!login.body?.token) {
  console.error(`✗ No se pudo iniciar sesión como ${ADMIN.email} (HTTP ${login.status}). ¿Está la API arriba? ¿Cambió la contraseña?`);
  process.exit(1);
}
const T = login.body.token;

// 1) Zonas
const zonasExistentes = items(must(await call('GET', '/api/zonas-acceso', { token: T }), [200], 'listar zonas'));
const zonaId = {};
for (const z of ZONAS) {
  let ex = zonasExistentes.find((x) => x.nombre === z.nombre);
  if (!ex) { ex = must(await call('POST', '/api/zonas-acceso', { token: T, body: z }), [200, 201], `crear zona ${z.nombre}`); console.log(`  + zona   ${z.nombre}`); }
  else console.log(`  = zona   ${z.nombre} (ya existía)`);
  zonaId[z.nombre] = Number(ex.id);
}

// 2) Personas, perfiles y credenciales
const personasExistentes = items(must(await call('GET', '/api/personas?tamanoPagina=500', { token: T }), [200], 'listar personas'));
const salida = [];
for (const p of PERSONAS) {
  let per = personasExistentes.find((x) => x.dpiCodigo === p.dpi);
  if (!per) { per = must(await call('POST', '/api/personas', { token: T, body: { nombre: p.nombre, dpiCodigo: p.dpi, tipo: p.tipo } }), [200, 201], `crear persona ${p.nombre}`); console.log(`  + persona ${p.nombre}`); }
  else console.log(`  = persona ${p.nombre} (ya existía)`);
  const personaId = Number(per.id);

  const perfilesExistentes = items(must(await call('GET', `/api/perfiles-acceso?personaId=${personaId}`, { token: T }), [200], 'listar perfiles'));
  for (const [zonaNombre, v] of p.perfiles) {
    if (perfilesExistentes.some((x) => Number(x.zonaId) === zonaId[zonaNombre])) continue;
    must(await call('POST', '/api/perfiles-acceso', { token: T, body: { personaId, zonaId: zonaId[zonaNombre], vigenciaInicio: fechaGT(v.ini), vigenciaFin: fechaGT(v.fin) } }), [200, 201], `perfil ${p.nombre}/${zonaNombre}`);
    console.log(`      + perfil ${zonaNombre} (${v === VENCIDO ? 'VENCIDO' : 'vigente'})`);
  }

  let creds = items(must(await call('GET', `/api/credenciales?personaId=${personaId}`, { token: T }), [200], 'listar credenciales'));
  if (creds.length === 0) {
    const nueva = must(await call('POST', `/api/credenciales/${personaId}/generar`, { token: T }), [200, 201], `generar credencial ${p.nombre}`);
    console.log(`      + credencial generada`);
    if (p.revocar) {
      must(await call('POST', `/api/credenciales/${nueva.id}/revocar`, { token: T, body: { motivo: p.revocar } }), [200], `revocar ${p.nombre}`);
      console.log(`      + credencial revocada (escenario de prueba)`);
    }
    creds = items(must(await call('GET', `/api/credenciales?personaId=${personaId}`, { token: T }), [200], 'relistar credenciales'));
  }
  const cred = creds.find((c) => c.estado === 'activa') ?? creds[0];
  salida.push({ nombre: p.nombre, dpi: p.dpi, tipo: p.tipo === 1 ? 'Colaborador' : 'Visitante', escenario: p.escenario, esperado: p.esperado, estado: cred.estado, token: cred.token });
}

// 3) Archivos de salida (ignorados por git)
writeFileSync(join(ROOT, 'demo-credenciales.json'), JSON.stringify(salida, null, 2));

let html = '';
const qrLib = join(ROOT, 'sciad-frontend', 'node_modules', 'qrcode');
if (existsSync(qrLib)) {
  const QRCode = createRequire(join(ROOT, 'sciad-frontend', 'package.json'))('qrcode');
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const cards = [];
  for (const s of salida) {
    const img = await QRCode.toDataURL(s.token, { errorCorrectionLevel: 'M', margin: 3, width: 360 });
    cards.push(`<div class="c"><img src="${img}" alt="QR"><div class="n">${esc(s.nombre)}</div><div class="t">${esc(s.tipo)} · ${esc(s.estado)}</div><div class="e">${esc(s.escenario)}</div><div class="x">${esc(s.esperado)}</div></div>`);
  }
  html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>SCIAD — QR de demostración</title><style>
body{font-family:system-ui,Segoe UI,Roboto,sans-serif;margin:24px;color:#0f172a}h1{margin:0 0 4px}p{color:#475569;margin:0 0 18px}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}.c{border:1px solid #cbd5e1;border-radius:12px;padding:14px;text-align:center;break-inside:avoid}
.c img{width:220px;height:220px}.n{font-weight:700;margin-top:6px}.t{font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.06em}
.e{font-size:13px;margin-top:6px}.x{font-size:12px;color:#334155;margin-top:4px;background:#f1f5f9;border-radius:8px;padding:6px}
</style></head><body><h1>SCIAD — QR de demostración</h1><p>Abre esta hoja en una pantalla y escanéala con la app en el celular. Generada ${new Date().toLocaleString('es-GT')}.</p>
<div class="g">${cards.join('')}</div></body></html>`;
  writeFileSync(join(ROOT, 'demo-gafetes.html'), html);
}

console.log('\n┌──────────────────────┬─────────────┬──────────┬────────────────────────────────────────────────────┐');
for (const s of salida) console.log(`│ ${s.nombre.padEnd(20)} │ ${s.tipo.padEnd(11)} │ ${s.estado.padEnd(8)} │ ${s.esperado.slice(0, 50).padEnd(50)} │`);
console.log('└──────────────────────┴─────────────┴──────────┴────────────────────────────────────────────────────┘');
console.log(`\nListo. Archivos en ${ROOT}:`);
console.log('  • demo-credenciales.json  (tokens y resultado esperado de cada escenario)');
console.log(html ? '  • demo-gafetes.html       (ábrelo y escanea los QR con el celular)' : '  • (sin demo-gafetes.html: instala el frontend con `npm ci` en sciad-frontend/ y repite)');
console.log('\nPrueba: entra como seguridad@sciad.gt / sciad123 → Punto de acceso → elige la zona → escanea un QR.');
console.log('Nota: el sistema permite UN ingreso por persona y día; el 2.º escaneo es egreso y el 3.º devuelve 409 hasta mañana.');
````

#### 📄 NUEVO — `GUIA_DE_USO.md`

````markdown
# SCIAD — Guía de uso: escanear con el celular y con la computadora

## 1. Arrancar todo (una vez)
```bash
cd SCIAD
cp .env.example .env                 # solo la primera vez (revisa las contraseñas)
docker compose up --build -d         # base de datos + API + frontend
node sciad-backend/seed-demo.mjs     # crea zonas, personas, perfiles y credenciales de demostración
```
- Aplicación: **http://localhost:8080** · API directa: http://localhost:3000 (Swagger: `/swagger`).
- Cuentas del sistema (creadas por el seeder de la API): `admin@sciad.gt`, `seguridad@sciad.gt`, `gerencia@sciad.gt` — contraseña `sciad123`.
  (Cámbialas antes de exponer el sistema fuera de tu equipo; el build de producción **no** muestra estas cuentas en el login.)

## 2. Escanear desde la computadora (webcam)
1. Abre `http://localhost:8080` (en `localhost` la cámara funciona sin HTTPS) y entra como **seguridad@sciad.gt**
   (o como Admin: menú **Punto de acceso**).
2. Elige la **zona**; el navegador pedirá permiso para la cámara → *Permitir*.
3. Abre `demo-gafetes.html` (lo genera el script de datos demo) en **otra pantalla o en tu celular** y acerca el QR a la cámara.
   También puedes imprimir un gafete desde **Credenciales QR → Ver → Imprimir gafete**.

## 3. Escanear desde el celular (necesita HTTPS)
La cámara del navegador **solo funciona en HTTPS** (o localhost). Para probar en un celular sin dominio:
```bash
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d --build
./scripts/url-celular.sh             # Windows: .\scripts\url-celular.ps1   → imprime https://….trycloudflare.com
```
1. Abre esa URL en el celular, entra como **seguridad@sciad.gt** y permite la cámara.
2. Muestra a la cámara el QR de `demo-gafetes.html` abierto en tu computadora.
3. Instalar como app: Android/Chrome → ⋮ → *Agregar a la pantalla principal* · iPhone/Safari → Compartir → *Agregar a inicio*.
4. Al terminar: `docker compose -f docker-compose.yml -f docker-compose.tunnel.yml stop tunnel`.

⚠ Mientras el túnel esté encendido la URL es pública. Úsalo solo para pruebas y no compartas la URL. Para uso real: VPS con dominio y TLS (`DESPLIEGUE.md`).

## 4. Qué debe pasar con cada persona de la demostración
| Persona | Escenario | Resultado al escanear |
|---|---|---|
| Juan Pérez López | Entrada Principal y Oficinas, vigente | ✅ verde: INGRESO; 2.º escaneo: EGRESO |
| María Fernanda Ruiz | Las 3 zonas, vigente | ✅ verde en cualquier zona |
| Carlos Méndez Soto | Perfil vencido | ❌ rojo «Fuera de vigencia» (avisa a Gerencia) |
| Ana Lucía Castillo | Credencial revocada | ❌ rojo «Credencial revocada» (avisa a Gerencia) |
| Roberto Aguilar (visitante) | Solo Entrada Principal | ✅ en Entrada · ❌ «Zona no autorizada» en otras zonas |
| Sofía Morales (visitante) | Sin perfil | ❌ rojo «Zona no autorizada» |

## 5. Reglas que conviene conocer
- **El servidor alterna ingreso/egreso** en cada escaneo válido. La app no reenvía el mismo QR mientras siga frente a la cámara
  (hay que retirarlo y volver a presentarlo; además hay una espera de 15 s para el mismo código).
- **Un solo ingreso por persona y día** (regla del DERCAS, CU-04): el 3.er escaneo del día devuelve «Ingreso ya registrado» (409) hasta mañana.
  Quien entra a una 2.ª zona el mismo día, o sale y vuelve a entrar, también recibe ese aviso. Para repetir pruebas el mismo día usa otra persona.
- **Horas**: el sistema trabaja en **hora de Guatemala (UTC-6)**; el día cambia a medianoche local, no a las 18:00.
- Las listas (historial, notificaciones, auditoría, reportes) muestran hasta **100** filas; usa los filtros para acotar.

## 6. Si algo no funciona
| Síntoma | Causa y solución |
|---|---|
| «La cámara solo funciona en HTTPS» | Abriste `http://192.168.x.x`. Usa `localhost` en la PC o el túnel HTTPS en el celular. |
| «Se bloqueó el permiso de la cámara» | Candado de la barra de direcciones → Cámara → Permitir; recarga. En iPhone: Ajustes → Safari → Cámara. |
| No lee el QR | Más luz, acércalo/aléjalo, evita reflejos; usa la linterna (🔦) o «Leer desde foto». |
| «Sin conexión» | El celular perdió red o el stack está apagado: `docker compose ps`. |
| Login bloqueado (429) | Límite de intentos; espera 5 min. |
| La URL del túnel no aparece | `docker compose -f docker-compose.yml -f docker-compose.tunnel.yml logs tunnel`. |
````

---

## 6. PASO 4 — Prueba E2E real (archivos nuevos)

`tests-fase5/` contiene: `e2e-real.mjs` (navegador + cámara simulada contra el **stack real**), `mock-backend.mjs` (backend simulado fiel al contrato, para validar los
scripts cuando no hay Docker), `package.json` y `.gitignore`. Reutiliza `node_modules` de `tests-fase1` (hace `require` hacia `../package.json` del frontend para `qrcode`/`pngjs`).

#### 📄 NUEVO — `sciad-frontend/tests-fase5/package.json`

````json
{
  "name": "sciad-tests-fase5",
  "private": true,
  "type": "module",
  "description": "Fase 5: E2E contra el stack REAL (Docker) con cámara simulada. Reutiliza node_modules de tests-fase1.",
  "scripts": { "test:real": "node --no-warnings e2e-real.mjs" },
  "devDependencies": { "puppeteer-core": "25.12.0" },
  "optionalDependencies": { "@sparticuz/chromium": "153.0.0" }
}
````

#### 📄 NUEVO — `sciad-frontend/tests-fase5/.gitignore`

````
node_modules
node_modules/
out/
````

#### 📄 NUEVO — `sciad-frontend/tests-fase5/mock-backend.mjs`

````js
// Backend SIMULADO fiel al contrato real de SCIAD (DTOs, Problem Details con code/detail, reglas de
// RegistrosAccesoService, hora de Guatemala UTC-6, índice único de ingreso por persona y día, notificaciones).
// Sirve además el build de Angular (como haría nginx). Se usa SOLO para validar los scripts de la Fase 3 y 5
// cuando no hay Docker; contra el stack real se usa la misma prueba con SCIAD_BASE=http://localhost:8080.
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist/sciad-frontend/browser', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const gt = () => new Date(Date.now() - 6 * 3600e3);                         // "ahora" en hora de Guatemala
const fechaGT = () => gt().toISOString().slice(0, 10);

export function createBackend() {
  let seq = 1; const id = () => String(seq++);
  const S = { zonas: [], personas: [], perfiles: [], creds: [], movs: [], notifs: [], log: [] };
  const users = {
    'admin@sciad.gt': { rol: 'ADMIN', nombre: 'Lic. Marco Antonio Ortíz' },
    'seguridad@sciad.gt': { rol: 'SEGURIDAD', nombre: 'Carlos Gómez Rivera' },
    'gerencia@sciad.gt': { rol: 'GERENCIA', nombre: 'Ing. Sofía Herrera' },
  };
  const problem = (res, status, code, detail) => { res.writeHead(status, { 'Content-Type': 'application/problem+json' }); res.end(JSON.stringify({ status, title: 'x', detail, code, message: detail })); };
  const json = (res, obj, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  // Igual que el backend real en historial/notificaciones/auditoría/reportes: tamaño fuera de 1..100 ⇒ 20.
  const page = (it, q) => { const n = Number(q?.get('tamanoPagina') ?? 20); const t = n < 1 || n > 100 ? 20 : n; return { items: it.slice(0, t), total: it.length, pagina: 1, tamanoPagina: t, totalPaginas: it.length ? Math.ceil(it.length / t) : 0 }; };
  const body = (req) => new Promise((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => r(d ? JSON.parse(d) : {})); });
  const zonaDto = (z) => ({ id: z.id, nombre: z.nombre, nivelSeguridad: z.nivelSeguridad, capacidad: z.capacidad, nivelRiesgo: z.nivelRiesgo, estado: z.estado });
  const credDto = (c) => { const p = S.personas.find((x) => x.id === c.personaId); return { id: c.id, personaId: c.personaId, personaNombre: p.nombre, dpiCodigo: p.dpiCodigo, token: c.token, estado: c.estado, emitido: c.emitido, motivo: c.motivo ?? null, reemitidoDe: null }; };
  const perfilDto = (f) => ({ id: f.id, personaId: f.personaId, personaNombre: S.personas.find((x) => x.id === f.personaId).nombre, zonaId: f.zonaId, zonaNombre: S.zonas.find((x) => x.id === f.zonaId).nombre, vigenciaInicio: f.vigenciaInicio, vigenciaFin: f.vigenciaFin });
  const notif = (tipo, persona, mensaje) => S.notifs.push({ id: id(), usuarioId: 3, tipo, mensaje, fecha: new Date().toISOString(), leida: false, personaId: Number(persona.id), personaNombre: persona.nombre });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x'); const p = url.pathname; const m = req.method;
    if (!p.startsWith('/api/')) {
      let f = join(DIST, p === '/' ? 'index.html' : p);
      if (!existsSync(f) || statSync(f).isDirectory()) f = join(DIST, 'index.html');
      res.writeHead(200, { 'Content-Type': MIME[extname(f)] ?? 'application/octet-stream', ...(f.endsWith('index.html') ? { 'Cache-Control': 'no-cache' } : {}) });
      return res.end(readFileSync(f));
    }
    if (p === '/api/auth/login' && m === 'POST') {
      const { email, password } = await body(req); const u = users[email];
      if (!u || password !== 'sciad123') return problem(res, 401, 'UNAUTHORIZED', 'Credenciales inválidas.');
      return json(res, { token: `tok.${u.rol}`, user: { id: '1', nombre: u.nombre, email, rol: u.rol, puesto: 'x', activo: true, avatarInitials: 'XX', fechaCreacion: new Date().toISOString() } });
    }
    const auth = req.headers.authorization ?? '';
    if (!auth.startsWith('Bearer tok.')) return problem(res, 401, 'UNAUTHORIZED', 'Token ausente, inválido o expirado.');
    const rol = auth.slice(11);
    const only = (...r) => (r.includes(rol) ? true : (problem(res, 403, 'FORBIDDEN', 'El rol no tiene permiso para esta operación.'), false));

    if (p === '/api/zonas-acceso' && m === 'GET') return json(res, S.zonas.map(zonaDto));
    if (p === '/api/zonas-acceso' && m === 'POST') { if (!only('ADMIN')) return; const b = await body(req); const z = { id: id(), estado: 'activo', capacidad: null, ...b }; S.zonas.push(z); return json(res, zonaDto(z), 201); }
    if (p === '/api/personas' && m === 'GET') { if (!only('ADMIN', 'GERENCIA')) return; return json(res, { items: S.personas, total: S.personas.length, pagina: 1, tamanoPagina: 500, totalPaginas: 1 }); }   // sin tope (como el backend)
    if (p === '/api/personas' && m === 'POST') { if (!only('ADMIN')) return; const b = await body(req); if (S.personas.some((x) => x.dpiCodigo === b.dpiCodigo)) return problem(res, 409, 'CONFLICT', 'El DPI ya existe.'); const x = { id: id(), estado: 'activo', ...b }; S.personas.push(x); return json(res, x, 201); }
    let mm;
    if ((mm = p.match(/^\/api\/personas\/(\d+)\/estado$/)) && m === 'PATCH') { const x = S.personas.find((q) => q.id === mm[1]); x.estado = (await body(req)).estado; return json(res, x); }
    if (p === '/api/perfiles-acceso' && m === 'GET') { if (!only('ADMIN')) return; let l = S.perfiles; const pid = url.searchParams.get('personaId'); if (pid) l = l.filter((x) => x.personaId === pid); return json(res, l.map(perfilDto)); }
    if (p === '/api/perfiles-acceso' && m === 'POST') { if (!only('ADMIN')) return; const b = await body(req); if (b.vigenciaFin < b.vigenciaInicio) return problem(res, 400, 'VALIDACION', 'La vigencia final no puede ser anterior a la inicial.'); const f = { id: id(), personaId: String(b.personaId), zonaId: String(b.zonaId), vigenciaInicio: b.vigenciaInicio, vigenciaFin: b.vigenciaFin }; S.perfiles.push(f); return json(res, perfilDto(f), 201); }
    if (p === '/api/credenciales' && m === 'GET') { if (!only('ADMIN')) return; let l = S.creds; const pid = url.searchParams.get('personaId'); if (pid) l = l.filter((x) => x.personaId === pid); return json(res, l.map(credDto)); }
    if ((mm = p.match(/^\/api\/credenciales\/(\d+)\/generar$/)) && m === 'POST') { if (!only('ADMIN')) return; if (S.creds.some((c) => c.personaId === mm[1] && c.estado === 'activa')) return problem(res, 409, 'CONFLICT', 'La persona ya tiene una credencial activa.'); const c = { id: id(), personaId: mm[1], token: randomBytes(32).toString('hex').toUpperCase(), estado: 'activa', emitido: fechaGT() }; S.creds.push(c); return json(res, credDto(c), 201); }
    if ((mm = p.match(/^\/api\/credenciales\/(\d+)\/revocar$/)) && m === 'POST') { const c = S.creds.find((x) => x.id === mm[1]); if (c.estado === 'revocada') return problem(res, 400, 'VALIDACION', 'La credencial ya está revocada.'); c.estado = 'revocada'; c.motivo = (await body(req)).motivo ?? null; return json(res, credDto(c)); }
    if (p === '/api/notificaciones' && m === 'GET') { if (!only('GERENCIA', 'ADMIN')) return; return json(res, page(S.notifs, url.searchParams)); }
    if (p === '/api/usuarios' && m === 'GET') { if (!only('ADMIN')) return; return json(res, { items: Object.entries(users).map(([email, u], i) => ({ id: String(i + 1), nombre: u.nombre, email, rol: u.rol, puesto: 'x', activo: true, avatarInitials: 'XX', fechaCreacion: new Date().toISOString() })), total: 3, pagina: 1, tamanoPagina: 500, totalPaginas: 1 }); }
    if ((p === '/api/auditoria' || p === '/api/reportes') && m === 'GET') { if (!only('ADMIN', 'GERENCIA')) return; return json(res, page([], url.searchParams)); }

    if (p === '/api/registros-acceso/hoy' && m === 'GET') {
      if (!only('SEGURIDAD', 'ADMIN')) return; const hoy = fechaGT(); const rows = [];
      const keys = [...new Set(S.movs.filter((x) => x.fecha === hoy).map((x) => `${x.personaId}|${x.zonaId}`))];
      for (const k of keys) { const l = S.movs.filter((x) => x.fecha === hoy && `${x.personaId}|${x.zonaId}` === k); const u = l.at(-1); rows.push({ personaId: +u.personaId, personaNombre: S.personas.find((q) => q.id === u.personaId).nombre, zonaId: +u.zonaId, zonaNombre: S.zonas.find((q) => q.id === u.zonaId).nombre, ultimoTipo: u.tipo, ultimaHora: u.hora, dentro: l.filter((x) => x.tipo === 'ingreso').length > l.filter((x) => x.tipo === 'egreso').length }); }
      return json(res, rows);
    }
    if (p === '/api/registros-acceso' && m === 'GET') {
      if (!only('ADMIN', 'GERENCIA')) return;
      const pid = url.searchParams.get('personaId'); let l = S.movs; if (pid) l = l.filter((x) => x.personaId === pid);
      l = [...l].reverse();   // más recientes primero, como el backend
      return json(res, page(l.map((x) => ({ id: x.id, personaId: +x.personaId, personaNombre: S.personas.find((q) => q.id === x.personaId).nombre, zonaId: +x.zonaId, zonaNombre: S.zonas.find((q) => q.id === x.zonaId).nombre, fecha: x.fecha, hora: x.hora, tipo: x.tipo, registradoPor: 'Carlos Gómez Rivera' })), url.searchParams));
    }
    if (p === '/api/registros-acceso' && m === 'POST') {
      if (!only('SEGURIDAD', 'ADMIN')) return;
      const { token, zonaId } = await body(req); const e = { token, status: 0, code: null }; S.log.push(e);
      const fail = (st, code, d) => { e.status = st; e.code = code; return problem(res, st, code, d); };
      const c = S.creds.find((x) => x.token === token);
      if (!c) return fail(400, 'TOKEN_INVALIDO', 'El token de la credencial QR no es válido.');
      const per = S.personas.find((x) => x.id === c.personaId);
      if (c.estado !== 'activa') { notif('token_revocado', per, `Intento de acceso con una credencial ${c.estado} (token revocado o vencido).`); return fail(400, 'CREDENCIAL_REVOCADA', 'La credencial está revocada o vencida.'); }
      if (per.estado !== 'activo') return fail(400, 'PERSONA_INACTIVA', 'La persona titular de la credencial está inactiva.');
      const z = S.zonas.find((x) => x.id === String(zonaId));
      if (!z) return fail(400, 'ZONA_NO_AUTORIZADA', 'La zona de acceso no existe.');
      if (z.estado !== 'activo') return fail(400, 'ZONA_NO_AUTORIZADA', 'La zona de acceso está inactiva.');
      const hoy = fechaGT(); const ps = S.perfiles.filter((x) => x.personaId === per.id && x.zonaId === z.id);
      const vig = ps.find((x) => x.vigenciaInicio <= hoy && hoy <= x.vigenciaFin);
      if (!vig) {
        if (ps.length) { notif('fuera_horario', per, `Intento de acceso fuera del horario/vigencia del perfil en la zona '${z.nombre}'.`); return fail(400, 'FUERA_VIGENCIA', 'La persona tiene un perfil en esta zona, pero su vigencia no cubre la fecha de hoy (fuera de horario).'); }
        return fail(400, 'ZONA_NO_AUTORIZADA', 'La persona no tiene autorización (perfil) para esta zona.');
      }
      const ing = S.movs.filter((x) => x.personaId === per.id && x.zonaId === z.id && x.fecha === hoy && x.tipo === 'ingreso').length;
      const egr = S.movs.filter((x) => x.personaId === per.id && x.zonaId === z.id && x.fecha === hoy && x.tipo === 'egreso').length;
      const tipo = ing > egr ? 'egreso' : 'ingreso';
      if (tipo === 'ingreso' && S.movs.some((x) => x.personaId === per.id && x.fecha === hoy && x.tipo === 'ingreso')) return fail(409, 'CONFLICT', 'Ya existe un ingreso registrado para esta persona en esta zona hoy (doble ingreso).');
      const now = new Date(); const g = gt();
      const mov = { id: id(), personaId: per.id, zonaId: z.id, tipo, fecha: g.toISOString().slice(0, 10), hora: g.toISOString().slice(11, 19) };
      S.movs.push(mov); e.status = 200; e.tipo = tipo;
      return json(res, { id: mov.id, personaId: +per.id, personaNombre: per.nombre, zonaId: +z.id, zonaNombre: z.nombre, tipo, fecha: mov.fecha, hora: mov.hora, estado: 'autorizado', timestamp: now.toISOString() });
    }
    return problem(res, 404, 'NOT_FOUND', 'No encontrado');
  });
  return { server, S };
}
````

#### 📄 NUEVO — `sciad-frontend/tests-fase5/e2e-real.mjs`

````js
// E2E REAL (Fase 5): navegador + cámara simulada contra el STACK REAL (nginx + backend .NET + PostgreSQL).
//
//   SCIAD_BASE=http://localhost:8080 node e2e-real.mjs        (por defecto)
//
// No depende de la demo: crea sus propios datos por la API (personas "ZZ E2E …"), así que se puede repetir el
// mismo día (el sistema permite un solo ingreso por persona y día). Al final da de baja lógica a esas personas.
// Escenarios que recorre la cámara: ingreso válido → perfil vencido → credencial revocada → sin perfil → egreso.
// Después comprueba en el backend: registros (fecha/hora de Guatemala), notificaciones y "accesos de hoy".
// Navegador: CHROME_PATH (Chrome/Edge) o, en Linux, Chromium vía npm (@sparticuz/chromium).
process.env.TZ = 'America/Guatemala';
import puppeteer from 'puppeteer-core';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(new URL('../package.json', import.meta.url));
const QRCode = require('qrcode');
const { PNG } = require('pngjs');
const BASE = (process.env.SCIAD_BASE ?? 'http://localhost:8080').replace(/\/$/, '');
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const check = (n, c, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗ FALLO'} ${n}${x ? '  → ' + x : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const gtNow = () => new Date(Date.now() - 6 * 3600e3);
const fechaGT = (d = 0) => new Date(Date.now() - 6 * 3600e3 + d * 86400e3).toISOString().slice(0, 10);

async function api(method, path, { token, body } = {}) {
  const r = await fetch(`${BASE}/api${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch { /* sin cuerpo */ }
  return { status: r.status, body: j };
}
const items = (b) => (Array.isArray(b) ? b : b?.items ?? []);
async function login(email) { const r = await api('POST', '/auth/login', { body: { email, password: 'sciad123' } }); if (!r.body?.token) throw new Error(`login ${email}: HTTP ${r.status}. ¿Está el stack arriba en ${BASE}?`); return r.body.token; }

// ───────────── video de la cámara simulada (Y4M 320x240 a 10 fps), 100 % Node ─────────────
async function crearVideo(file, segs) {
  const W = 320, H = 240, FPS = 10, Q = 200;
  const frames = [];
  for (const s of segs) {
    let qr = null;
    if (s.token) { const png = PNG.sync.read(await QRCode.toBuffer(s.token, { errorCorrectionLevel: 'M', margin: 3, width: 220 })); qr = png; }
    for (let i = 0; i < s.sec * FPS; i++) {
      const rgb = Buffer.alloc(W * H * 3);
      for (let p = 0; p < W * H; p++) { rgb[p * 3] = 150; rgb[p * 3 + 1] = 155; rgb[p * 3 + 2] = 160; }
      if (qr) {
        const jx = Math.round(2 * Math.sin(i / 6)), ox = ((W - Q) >> 1) + jx, oy = (H - Q) >> 1;
        for (let y = 0; y < Q; y++) for (let x = 0; x < Q; x++) {
          const sx = Math.min(qr.width - 1, Math.floor((x * qr.width) / Q)), sy = Math.min(qr.height - 1, Math.floor((y * qr.height) / Q));
          const si = (sy * qr.width + sx) * 4, di = ((oy + y) * W + (ox + x)) * 3;
          rgb[di] = qr.data[si]; rgb[di + 1] = qr.data[si + 1]; rgb[di + 2] = qr.data[si + 2];
        }
      }
      for (let p = 0; p < rgb.length; p++) { const n = (Math.random() + Math.random() + Math.random() - 1.5) * 8; rgb[p] = Math.max(0, Math.min(255, rgb[p] + n)); } // ruido de sensor
      // RGB → YUV 4:2:0
      const Y = Buffer.alloc(W * H), U = Buffer.alloc((W / 2) * (H / 2)), V = Buffer.alloc((W / 2) * (H / 2));
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 3; Y[y * W + x] = 0.299 * rgb[o] + 0.587 * rgb[o + 1] + 0.114 * rgb[o + 2]; }
      for (let y = 0; y < H / 2; y++) for (let x = 0; x < W / 2; x++) {
        let r = 0, g = 0, b = 0; for (const [dy, dx] of [[0, 0], [0, 1], [1, 0], [1, 1]]) { const o = ((2 * y + dy) * W + 2 * x + dx) * 3; r += rgb[o]; g += rgb[o + 1]; b += rgb[o + 2]; }
        r /= 4; g /= 4; b /= 4;
        U[y * (W / 2) + x] = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b; V[y * (W / 2) + x] = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      }
      frames.push(Buffer.from('FRAME\n'), Y, U, V);
    }
  }
  writeFileSync(file, Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F${FPS}:1 Ip A1:1 C420jpeg\n`), ...frames]));
}

// ───────────── 1) Datos de prueba por la API ─────────────
console.log(`\nE2E REAL → ${BASE}\n\n[1] Preparación de datos por la API`);
const run = Date.now().toString().slice(-8);
const admin = await login('admin@sciad.gt');
let zonas = items((await api('GET', '/zonas-acceso', { token: admin })).body);
let zona = zonas.find((z) => z.estado === 'activo');
if (!zona) zona = (await api('POST', '/zonas-acceso', { token: admin, body: { nombre: 'Zona E2E', nivelSeguridad: 'MEDIO', nivelRiesgo: 'MEDIO', capacidad: 50 } })).body;
console.log(`  zona de la prueba: ${zona.nombre} (id ${zona.id}) — es la que la pantalla preselecciona (primera activa)`);

const defs = [
  { k: 'A', nombre: `ZZ E2E Valido ${run}`, perfil: [-30, 365] },
  { k: 'B', nombre: `ZZ E2E Vencido ${run}`, perfil: [-400, -35] },
  { k: 'C', nombre: `ZZ E2E Revocada ${run}`, perfil: [-30, 365], revocar: true },
  { k: 'D', nombre: `ZZ E2E SinPerfil ${run}`, perfil: null },
];
const P = {};
for (const d of defs) {
  const per = (await api('POST', '/personas', { token: admin, body: { nombre: d.nombre, dpiCodigo: `E2E-${run}-${d.k}`, tipo: 1 } })).body;
  if (d.perfil) await api('POST', '/perfiles-acceso', { token: admin, body: { personaId: +per.id, zonaId: +zona.id, vigenciaInicio: fechaGT(d.perfil[0]), vigenciaFin: fechaGT(d.perfil[1]) } });
  const cred = (await api('POST', `/credenciales/${per.id}/generar`, { token: admin })).body;
  if (d.revocar) await api('POST', `/credenciales/${cred.id}/revocar`, { token: admin, body: { motivo: 'E2E' } });
  P[d.k] = { ...d, id: per.id, token: cred.token };
}
check('4 personas de prueba con credencial creadas (token de 64 hex)', Object.values(P).every((x) => /^[0-9a-fA-F]{64}$/.test(x.token ?? '')), Object.values(P).map((x) => x.k + ':' + (x.token ?? '').slice(0, 6)).join(' '));

const video = join(tmpdir(), `sciad-e2e-real-${run}.y4m`);
await crearVideo(video, [
  { sec: 3 }, { token: P.A.token, sec: 6 }, { sec: 3 }, { token: P.B.token, sec: 6 }, { sec: 3 },
  { token: P.C.token, sec: 6 }, { sec: 3 }, { token: P.D.token, sec: 6 }, { sec: 3 }, { token: P.A.token, sec: 6 },
]);
console.log('  video de la cámara simulada generado (45 s: válido, vencido, revocado, sin perfil, válido)');

// ───────────── 2) Navegador + cámara ─────────────
async function nav() {
  if (process.env.CHROME_PATH) return { executablePath: process.env.CHROME_PATH, headless: true };
  if (process.platform !== 'linux') throw new Error('Define CHROME_PATH con la ruta de Chrome/Edge.');
  const chromium = (await import('@sparticuz/chromium')).default;
  return { executablePath: await chromium.executablePath(), headless: 'shell' };
}
const browser = await puppeteer.launch({ ...(await nav()), env: { ...process.env, TZ: 'America/Guatemala' },
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${video}`] });
console.log('\n[2] Escaneo con la cámara (celular simulado)');
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
check('login SIN cuentas demo visibles (build de producción)', (await page.$$('.demo-chip')).length === 0 && !/Cuentas de demostración/.test(await page.evaluate(() => document.body.innerText)));
await page.type('sci-input input', 'seguridad@sciad.gt');
await (await page.$$('form input'))[1].type('sciad123');
await page.click('form button');
await page.waitForFunction(() => location.pathname.includes('/seguridad/escaneo'), { timeout: 15000 });
check('login real de SEGURIDAD → /seguridad/escaneo', true);
check('cámara activa', !!(await page.waitForSelector('.viewport.live', { timeout: 15000 }).catch(() => null)));
const zonaSel = await page.$eval('#zona-sel', (e) => e.value);
check('la pantalla preselecciona la zona esperada', String(zonaSel) === String(zona.id), `ui=${zonaSel} esperada=${zona.id}`);

const esperado = [/Acceso autorizado.*INGRESO/, /Fuera de vigencia/, /Credencial revocada/, /Zona no autorizada/, /Acceso autorizado.*EGRESO/];
const etiquetas = ['válido → INGRESO (verde)', 'perfil vencido → "Fuera de vigencia" (rojo)', 'revocada → "Credencial revocada" (rojo)', 'sin perfil → "Zona no autorizada" (rojo)', 'válido otra vez → EGRESO (verde)'];
const vistos = []; let ultimo = ''; const t0 = Date.now();
while (Date.now() - t0 < 150000 && vistos.length < esperado.length) {
  const t = await page.evaluate(() => { const o = document.querySelector('.overlay'); return o ? o.innerText.replace(/\s+/g, ' ').trim() : ''; });
  if (t && t !== ultimo) { vistos.push(t); if (vistos.length === 1) await page.screenshot({ path: join(OUT, 'real_1_ingreso.png') }); if (vistos.length === 3) await page.screenshot({ path: join(OUT, 'real_3_revocada.png') }); }
  ultimo = t; await sleep(80);
}
esperado.forEach((re, i) => check(etiquetas[i], re.test(vistos[i] ?? ''), (vistos[i] ?? '(no apareció)').slice(0, 90)));
check('ningún QR de más: exactamente 5 resultados en el orden esperado', vistos.length === 5 && !vistos.some((v) => /no reconocido/i.test(v)), `${vistos.length} resultados`);

// ───────────── 3) Lo que quedó en el backend ─────────────
console.log('\n[3] Verificación en el backend real');
const hist = items((await api('GET', `/registros-acceso?personaId=${P.A.id}&tamanoPagina=50`, { token: admin })).body);
check('persona válida: 2 registros (ingreso y egreso)', hist.length === 2 && hist.some((h) => h.tipo === 'ingreso') && hist.some((h) => h.tipo === 'egreso'), hist.map((h) => `${h.tipo} ${h.fecha} ${h.hora}`).join(' | '));
const g = gtNow(); const hoyGT = g.toISOString().slice(0, 10);
check('fecha guardada = día de Guatemala (Fase 4)', hist.length > 0 && hist.every((h) => h.fecha === hoyGT), `guardada=${hist[0]?.fecha} esperada=${hoyGT}`);
const minGuardado = (h) => { const [hh, mm] = h.hora.split(':').map(Number); return hh * 60 + mm; };
const ahoraMin = g.getUTCHours() * 60 + g.getUTCMinutes();
check('hora guardada = hora de Guatemala (±3 min), no UTC', hist.length > 0 && hist.every((h) => Math.abs(minGuardado(h) - ahoraMin) <= 3 || Math.abs(minGuardado(h) - ahoraMin) >= 1437), `guardada=${hist[0]?.hora} guatemala≈${String(g.getUTCHours()).padStart(2, '0')}:${String(g.getUTCMinutes()).padStart(2, '0')}`);
for (const k of ['B', 'C', 'D']) { const h = items((await api('GET', `/registros-acceso?personaId=${P[k].id}&tamanoPagina=50`, { token: admin })).body); check(`persona ${k} (${P[k].nombre.split(' ')[2]}): 0 registros (rechazada)`, h.length === 0, `${h.length}`); }
const ger = await login('gerencia@sciad.gt');
const nots = items((await api('GET', '/notificaciones?tamanoPagina=500', { token: ger })).body);
check('Gerencia recibió "fuera_horario" por la persona de perfil vencido', nots.some((n) => n.tipo === 'fuera_horario' && (n.personaNombre ?? '').includes(P.B.nombre)));
check('Gerencia recibió "token_revocado" por la credencial revocada', nots.some((n) => n.tipo === 'token_revocado' && (n.personaNombre ?? '').includes(P.C.nombre)));

await page.goto(`${BASE}/seguridad/accesos`, { waitUntil: 'networkidle0' });
const txt = await page.evaluate(() => document.body.innerText);
check('"Accesos del turno" lista a la persona válida como fuera (egresó)', txt.includes(P.A.nombre) && /fuera/i.test(txt));
await page.screenshot({ path: join(OUT, 'real_accesos.png') });


// ───────────── 4) Recorrido por TODAS las pantallas (Admin y Gerencia) ─────────────
console.log('\n[4] Recorrido por las pantallas con datos reales (sin errores, tamaños de página válidos)');
async function recorrer(email, rutas) {
  const pg = await browser.newPage(); await pg.setViewport({ width: 1366, height: 800 });
  const problemas = [], paginas = [];
  pg.on('pageerror', (e) => problemas.push(`JS: ${String(e).slice(0, 100)}`));
  pg.on('response', (r) => { const u = r.url(); if (u.includes('/api/') && r.status() >= 400) problemas.push(`HTTP ${r.status()} ${u.replace(BASE, '')}`); });
  pg.on('request', (r) => { const u = new URL(r.url()); if (/\/api\/(registros-acceso|notificaciones|auditoria|reportes)$/.test(u.pathname) && u.searchParams.has('tamanoPagina')) paginas.push(Number(u.searchParams.get('tamanoPagina'))); });
  await pg.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
  await pg.type('sci-input input', email); await (await pg.$$('form input'))[1].type('sciad123'); await pg.click('form button');
  await pg.waitForFunction(() => !location.pathname.includes('/login'), { timeout: 15000 });
  const resultados = {};
  for (const r of rutas) {
    await pg.goto(`${BASE}${r}`, { waitUntil: 'networkidle0' }); await sleep(400);
    resultados[r] = await pg.evaluate(() => ({ h1: document.querySelector('h1')?.textContent?.trim() ?? '', texto: document.body.innerText }));
  }
  return { pg, problemas, paginas, resultados };
}
const adminRutas = ['/admin/dashboard', '/admin/usuarios', '/admin/personas', '/admin/zonas', '/admin/perfiles', '/admin/credenciales', '/admin/auditoria', '/admin/reportes', '/admin/accesos', '/admin/escaneo'];
const A = await recorrer('admin@sciad.gt', adminRutas);
check(`Admin: ${adminRutas.length} pantallas cargan sin errores JS ni respuestas ≥ 400`, A.problemas.length === 0, A.problemas.slice(0, 3).join(' | '));
check('Admin: todas las listas paginadas piden tamanoPagina ≤ 100 (el backend ignora lo mayor y devuelve 20)', A.paginas.length > 0 && A.paginas.every((n) => n >= 1 && n <= 100), `pedidos=${[...new Set(A.paginas)].join(',')}`);
const totalHoy = (await api('GET', `/registros-acceso?desde=${hoyGT}&hasta=${hoyGT}&tamanoPagina=1`, { token: admin })).body?.total;
const kpi = Number((/Accesos hoy\s*(\d+)/.exec(A.resultados['/admin/dashboard'].texto) ?? [])[1]);
check('Dashboard: KPI "Accesos hoy" = total real del servidor', Number.isFinite(kpi) && kpi === totalHoy, `kpi=${kpi} servidor=${totalHoy}`);
await A.pg.screenshot({ path: join(OUT, 'real_admin_dashboard.png') });
const G = await recorrer('gerencia@sciad.gt', ['/gerencia/trazabilidad', '/gerencia/notificaciones', '/gerencia/reportes']);
check('Gerencia: 3 pantallas cargan sin errores ni respuestas ≥ 400', G.problemas.length === 0, G.problemas.slice(0, 3).join(' | '));
check('Gerencia: tamaños de página ≤ 100', G.paginas.every((n) => n >= 1 && n <= 100), `pedidos=${[...new Set(G.paginas)].join(',')}`);

// ───────────── limpieza (baja lógica) ─────────────
for (const k of Object.keys(P)) await api('PATCH', `/personas/${P[k].id}/estado`, { token: admin, body: { estado: 'inactivo' } });
await browser.close();
console.log(`\nRESULTADO: ${pass} ✓  ${fail} ✗   (capturas en tests-fase5/out/)`);
process.exit(fail ? 1 : 0);
````

---

## 7. PASO 5 — Compilar el frontend

```bash
cd SCIAD/sciad-frontend
npx ng build --configuration production      # sin WARNING ni ERROR
cd tests-fase1 && npm install && npm run test:logic        # esperado: 20 pruebas OK
```

---

## 8. PASO 6 — Backend: compilar y probar (en Docker; no necesitas .NET local)

Copia el backend a un contenedor del SDK (así no se ensucia tu carpeta con `bin/`/`obj/`). Ejecuta **desde `SCIAD/`** (ajusta la sintaxis del montaje a tu shell/Windows):

```bash
docker run --rm -v "<ruta absoluta a SCIAD/sciad-backend>:/src:ro" mcr.microsoft.com/dotnet/sdk:8.0 sh -c \
  "cp -r /src /work && cd /work && dotnet test tests/Sciad.Tests/Sciad.Tests.csproj --nologo && dotnet run --project tests/Sciad.TimeHarness"
```
**Esperado:** todos los tests pasan (**166** = 162 originales + 4 de `GuatemalaTimeTests`) y el arnés imprime `RESULTADO: 13 ✓  0 ✗`.
Si hay **errores de compilación** (este código no se pudo compilar con NuGet donde se preparó): corrígelos con el cambio mínimo, explica cuál fue y por qué, y repite.
Si falla un test que usaba `UtcNow`, revisa que el reemplazo del Paso 3.3(a) se hizo en los 5 archivos.

---

## 9. PASO 7 — Datos existentes en la base (decisión del usuario)

El backend ahora guarda `fecha`/`hora` en **hora de Guatemala**; las filas viejas (si existen) están en UTC. **Pregunta al usuario** cuál prefiere:

- **A (recomendada si es un entorno de desarrollo): reiniciar la BD** → `docker compose down -v` (⚠ borra TODOS los datos) y luego el Paso 8.
- **B: convertir** las filas existentes, una sola vez (puede fallar por la restricción `uq_ingreso_diario` si dos ingresos de una persona caen el mismo día tras el desplazamiento; en ese caso usar A):
  ```sql
  UPDATE registros_acceso SET fecha = ((fecha + hora) - interval '6 hours')::date, hora = ((fecha + hora) - interval '6 hours')::time;
  ```
  (ejecutar con `docker compose exec db psql -U <usuario> -d <base> -c "..."`; lee usuario/base de `.env`).
- **C:** no hacer nada si la BD está vacía o solo tiene datos de prueba que no importan.

---

## 10. PASO 8 — Levantar el stack REAL

```bash
cd SCIAD
cp .env.example .env            # solo si no existe
docker compose up --build -d
docker compose ps               # db, backend y frontend en estado healthy/running
```
Lee `docker-compose.yml` para confirmar los puertos (esperado: frontend **8080**, API **3000**). Comprueba `GET http://localhost:3000/api/health` → 200 y `http://localhost:8080` carga el login
**sin** mostrar «Cuentas de demostración» (es el build de producción). Si algo no arranca, revisa `docker compose logs backend` y corrige/reporta.

---

## 11. PASO 9 — Datos demo y verificaciones del backend

```bash
node sciad-backend/seed-demo.mjs                  # 1.ª vez crea; una 2.ª ejecución no debe crear nada nuevo
node sciad-backend/verify-seguridad.mjs           # matriz RBAC E2E: todo ✓ (ahora Gerencia puede GET /api/personas)
```
Si existen y funcionan en el entorno del usuario, ejecuta además `verify-2c.mjs`, `verify-2d.mjs` y `verify-fase3-rec.mjs` (algunos usan `psql` vía Docker; si no pueden, dilo).
`verify-carga.mjs` es opcional (carga). **Reporta el resultado real de cada uno.** Un fallo debe diagnosticarse (¿backend?, ¿script desactualizado por la hora de Guatemala?, ¿datos previos?).

---

## 12. PASO 10 — **Prueba E2E real con la cámara (la prueba clave)**

```bash
cd SCIAD/sciad-frontend/tests-fase5
npm install                                       # o enlaza node_modules de ../tests-fase1 (ya instalado)
# Windows: CHROME_PATH con la ruta de Chrome/Edge. Linux/macOS: igual si no se usa @sparticuz/chromium.
SCIAD_BASE=http://localhost:8080 node e2e-real.mjs     # PowerShell: $env:SCIAD_BASE="http://localhost:8080"; node e2e-real.mjs
```
Crea sus propias personas «ZZ E2E …» (se puede repetir el mismo día; al final quedan inactivas), escanea con la cámara simulada y verifica en el backend real:
ingreso → «Fuera de vigencia» → «Credencial revocada» → «Zona no autorizada» → egreso; registros con **fecha/hora de Guatemala**; notificaciones a Gerencia; «Accesos del turno»;
y recorre **todas** las pantallas de Admin y Gerencia (sin errores JS, sin respuestas ≥ 400, tamaños de página ≤ 100, KPI del dashboard = total del servidor).

**Esperado: 0 ✗.** Si algo falla, **eso es lo que hay que arreglar** (regla 5): identifica si la causa es el backend, el frontend o la prueba; corrige lo mínimo; repite hasta 0 ✗ o hasta que
quede un problema que requiera una decisión del usuario (entonces explícalo). Las capturas quedan en `tests-fase5/out/`.

También repite las pruebas de la Fase 1 (ya contra el build actual): `cd tests-fase1 && npm run test:e2e` → **28 ✓ / 0 ✗**.

---

## 13. PASO 11 — Prueba manual con celular (la hace el usuario; guíalo)

Sigue `GUIA_DE_USO.md` §3 (túnel HTTPS): `docker compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d --build`, `./scripts/url-celular.sh`
(Windows: `.\scripts\url-celular.ps1`), abrir la URL en el celular, entrar como `seguridad@sciad.gt`, permitir la cámara y escanear los QR de `demo-gafetes.html` abierto en la PC.
Si el script no encuentra la URL, revisa `... logs tunnel` y ajusta el `grep`. Apaga el túnel al terminar (`stop tunnel`).

---

## 14. PASO 12 — Informe final y confirmación (obligatorio)

1. `git status --short` y `git diff --stat` en el informe (recuerda: `demo-credenciales.json` y `demo-gafetes.html` están ignorados; no deben aparecer).
2. Resultado **real** de cada verificación: build, `test:logic`, tests del backend (n.º exacto), arnés, `verify-seguridad`, resto de `verify-*`, `e2e-real`, E2E de la Fase 1.
3. Cambios hechos **fuera** de este documento (regla 5) con causa y justificación; lo que no se pudo verificar y por qué; y las **decisiones pendientes** del Anexo B.
4. **Pregunta:** *«¿Revisaste los cambios? ¿Hago el commit local?»* — **no** hagas commit hasta que diga que sí:
   `git add -A && git commit -m "Fases 3-5: hora de Guatemala, datos demo, endurecimiento y prueba E2E real"` — **local, sin push**.

---

## ANEXO A — Qué se verificó al preparar este documento (y qué no)

**Verificado:** compilación de Domain + Application (Roslyn, sin NuGet) · arnés de zona horaria (código real de `RegistrosAccesoService`/`AuditoriaService`, 13 ✓) · los 4 `GuatemalaTimeTests`
contra stubs de xUnit · build del frontend sin avisos · 20 pruebas de lógica · E2E de la Fase 1 y `e2e-real` contra un **backend simulado fiel al contrato** · `seed-demo.mjs` idempotente contra ese simulador.

**NO verificado (por eso existe el Paso 10):** backend .NET real + PostgreSQL + Docker · tests xUnit/Moq reales · `PersonasController` (solo atributos, sin compilar el proyecto Api) · cámara en un celular físico · el túnel de Cloudflare.

## ANEXO B — Decisiones pendientes del usuario (no implementadas)

1. **«Un solo ingreso por persona y día»** (índice `uq_ingreso_diario`, DERCAS CU-04 A5): quien entra a una **segunda zona** el mismo día, o **sale y vuelve a entrar**, recibe 409.
   Es lo que dice la especificación, por eso no se cambió. Si el usuario quiere reingresos y multi-zona hay que rediseñar esa regla (índice + lógica de `RegistrosAccesoService` + tests + `verify-*`).
2. **Gerencia lee personas** (Paso 4.2): ya aplicado; revertible.
3. **JWT en `localStorage`** (el DERCAS pide memoria; en campo se prefiere persistir al recargar): sin cambios.
4. **Modo sin conexión / cola de escaneos (RSK-01):** no implementado.
