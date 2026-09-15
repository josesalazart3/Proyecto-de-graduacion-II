using System.Net;
using System.Text;
using System.Text.Json;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Sciad.Api.Common;
using Sciad.Application;
using Sciad.Application.Options;
using Sciad.Infrastructure;
using Sciad.Infrastructure.Persistence;
using Serilog;
using Serilog.Events;

var builder = WebApplication.CreateBuilder(args);

// ---------- Logging estructurado (Serilog → JSON en consola) ----------
builder.Host.UseSerilog((context, cfg) => cfg
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console(new Serilog.Formatting.Json.JsonFormatter()));

// ---------- Configuración JWT (fail-fast si falta el secreto) ----------
var jwt = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
jwt.Validar(); // lanza en arranque si SCIAD_JWT_SECRET falta o es < 32 chars
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// Respuesta 400 de validación de modelo también con Problem Details consistente (code + message).
builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(o => o.InvalidModelStateResponseFactory = context =>
    {
        var mensaje = context.ModelState.Values
            .SelectMany(v => v.Errors)
            .FirstOrDefault()?.ErrorMessage ?? "Solicitud inválida.";
        var pd = new Microsoft.AspNetCore.Mvc.ProblemDetails
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "Solicitud inválida",
            Detail = mensaje,
        };
        pd.Extensions["code"] = "VALIDACION";
        pd.Extensions["message"] = mensaje;
        return new Microsoft.AspNetCore.Mvc.BadRequestObjectResult(pd)
        {
            ContentTypes = { JsonDefaults.ContentType },
        };
    })
    .AddJsonOptions(o => o.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);

builder.Services.AddProblemDetails();

// ---------- Autenticación JWT (HS256, issuer/audience sciad, 8h) ----------
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false; // TLS se termina en el reverse proxy (producción)
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Emisor,
            ValidateAudience = true,
            ValidAudience = jwt.Audiencia,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Secreto)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = System.Security.Claims.ClaimTypes.Name,
            RoleClaimType = System.Security.Claims.ClaimTypes.Role,
        };
        options.Events = new JwtBearerEvents
        {
            OnChallenge = async context =>
            {
                context.HandleResponse();
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.ContentType = JsonDefaults.ContentType;
                var pd = new Microsoft.AspNetCore.Mvc.ProblemDetails
                {
                    Status = 401,
                    Title = "No autorizado",
                    Detail = "Token ausente, inválido o expirado.",
                };
                pd.Extensions["code"] = "UNAUTHORIZED";
                pd.Extensions["message"] = pd.Detail;
                await context.Response.WriteAsJsonAsync(pd, (JsonSerializerOptions)JsonDefaults.Web, context.HttpContext.RequestAborted);
            },
            OnForbidden = async context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                context.Response.ContentType = JsonDefaults.ContentType;
                var pd = new Microsoft.AspNetCore.Mvc.ProblemDetails
                {
                    Status = 403,
                    Title = "Acceso denegado",
                    Detail = "El rol no tiene permiso para esta operación.",
                };
                pd.Extensions["code"] = "FORBIDDEN";
                pd.Extensions["message"] = pd.Detail;
                await context.Response.WriteAsJsonAsync(pd, (JsonSerializerOptions)JsonDefaults.Web, context.HttpContext.RequestAborted);
            },
        };
    });

// ---------- Autorización por rol (RBAC, 3 roles) ----------
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("RequireAdmin", p => p.RequireRole("ADMIN"));
    options.AddPolicy("RequireSeguridad", p => p.RequireRole("SEGURIDAD"));
    options.AddPolicy("RequireGerencia", p => p.RequireRole("GERENCIA"));
    // Escaneo QR (CU-04) y accesos del día (CU-05): Personal de Seguridad O Administrador.
    options.AddPolicy("RequireSeguridadOAdmin", p => p.RequireRole("SEGURIDAD", "ADMIN"));
    // Trazabilidad (CU-06), auditoría (CU-08) y reportes (CU-07): Administrador O Gerencia/Auditoría.
    options.AddPolicy("RequireAdminOGerencia", p => p.RequireRole("ADMIN", "GERENCIA"));
    // Lectura de zonas (CU-05 escaneo): cualquier rol — Seguridad necesita el desplegable de
    // zonas para escanear y Gerencia/Admin lo consultan. La escritura queda Admin-only.
    options.AddPolicy("RequireZonaLectura", p => p.RequireRole("ADMIN", "SEGURIDAD", "GERENCIA"));
});

// ---------- CORS (solo el origen del frontend) ----------
var corsOrigins = (builder.Configuration["Cors:Origins"] ?? "http://localhost:8080,http://localhost:4200")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
builder.Services.AddCors(o => o.AddPolicy("frontend", p =>
    p.WithOrigins(corsOrigins).AllowAnyHeader().AllowAnyMethod()));

// ---------- Swagger / OpenAPI (desarrollo) ----------
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ---------- Rate limiting (SEC-04): mitigación de fuerza bruta en login ----------
// Ventana fija por IP sobre /api/auth/login. Configurable vía sección "RateLimit"
// (LoginPermitLimit / LoginWindowSeconds) con defaults 5 intentos / 5 minutos.
// Al exceder el límite responde 429 como Problem Details, consistente con la API.
var rateLimitSection = builder.Configuration.GetSection("RateLimit");
var loginPermitLimit = rateLimitSection.GetValue<int>("LoginPermitLimit", 5);
var loginWindowSeconds = rateLimitSection.GetValue<int>("LoginWindowSeconds", 300);

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("login", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "anon",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = loginPermitLimit,
                Window = TimeSpan.FromSeconds(loginWindowSeconds),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
            }));

    options.OnRejected = async (context, ct) =>
    {
        context.HttpContext.Response.ContentType = JsonDefaults.ContentType;
        var pd = new Microsoft.AspNetCore.Mvc.ProblemDetails
        {
            Status = StatusCodes.Status429TooManyRequests,
            Title = "Demasiadas solicitudes",
            Detail = "Demasiados intentos de inicio de sesión desde esta IP. Espere unos minutos e intente nuevamente.",
        };
        pd.Extensions["code"] = "RATE_LIMITED";
        pd.Extensions["message"] = pd.Detail;
        await context.HttpContext.Response.WriteAsJsonAsync(pd, (JsonSerializerOptions)JsonDefaults.Web, ct);
    };
});

// ---------- Forwarded headers (SEC-04/SEC-07): confía solo en proxies listados ----------
// En producción el tráfico llega vía nginx (reverse proxy del frontend), que inyecta
// X-Forwarded-For/X-Forwarded-Proto. Sin esta pieza, el rate limiter de login vería la IP
// del contenedor nginx (una sola partición para todos los clientes). Por defecto NO se
// confía en ningún proxy (KnownProxies vacío) → comportamiento idéntico en desarrollo y
// sin riesgo de spoofing de X-Forwarded-For. En producción se lista la IP estática del
// proxy vía `ForwardedHeaders__KnownProxies` (ver DESPLIEGUE.md).
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    var proxies = (builder.Configuration["ForwardedHeaders:KnownProxies"] ?? string.Empty)
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    foreach (var ip in proxies)
    {
        if (IPAddress.TryParse(ip, out var addr))
        {
            options.KnownProxies.Add(addr);
        }
    }
});

var app = builder.Build();

app.UseForwardedHeaders();

// ---------- Migraciones + seed al arranque (idempotente) ----------
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<SciadDbContext>();
    await db.Database.MigrateAsync();
    await scope.ServiceProvider.GetRequiredService<DbSeeder>().SeedAsync();
}

app.UseMiddleware<ErrorHandlingMiddleware>();

app.UseCors("frontend");

app.UseRateLimiter();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

// Referencia explícita para las pruebas de integración/xUnit.
public partial class Program;
