using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Sciad.Domain.Entities;

namespace Sciad.Infrastructure.Persistence;

/// <summary>
/// Siembra datos base: los 3 roles (RBAC) y los 3 usuarios demo que ya usa el frontend
/// (correos <c>*.sciad.gt</c>, contraseña <c>sciad123</c>). Idempotente.
/// </summary>
public sealed class DbSeeder
{
    private readonly SciadDbContext _db;
    private readonly ILogger<DbSeeder> _logger;

    public DbSeeder(SciadDbContext db, ILogger<DbSeeder> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task SeedAsync(CancellationToken ct = default)
    {
        await SeedRolesAsync(ct);
        // Persistir roles ANTES de consultarlos: los roles recién agregados están en estado
        // "Added" y un SingleAsync() ejecuta una consulta contra la BD, no contra el tracker;
        // sin este SaveChanges la consulta no los encontraba y lanzaba "Sequence contains no elements".
        await _db.SaveChangesAsync(ct);

        await SeedUsuariosAsync(ct);
        await _db.SaveChangesAsync(ct);
    }

    private async Task SeedRolesAsync(CancellationToken ct)
    {
        var rolesExistentes = await _db.Roles.Select(r => r.Codigo).ToListAsync(ct);
        var roles = new[]
        {
            new Rol { Nombre = "Administrador", Codigo = "ADMIN" },
            new Rol { Nombre = "Personal de Seguridad", Codigo = "SEGURIDAD" },
            new Rol { Nombre = "Gerencia / Auditoría", Codigo = "GERENCIA" },
        };

        var nuevos = 0;
        foreach (var rol in roles)
        {
            if (!rolesExistentes.Contains(rol.Codigo))
            {
                _db.Roles.Add(rol);
                nuevos++;
            }
        }

        if (nuevos > 0)
        {
            _logger.LogInformation("Se sembraron {Nuevos} rol(es) base.", nuevos);
        }
    }

    private async Task SeedUsuariosAsync(CancellationToken ct)
    {
        var adminRol = await _db.Roles.SingleAsync(r => r.Codigo == "ADMIN", ct);
        var seguridadRol = await _db.Roles.SingleAsync(r => r.Codigo == "SEGURIDAD", ct);
        var gerenciaRol = await _db.Roles.SingleAsync(r => r.Codigo == "GERENCIA", ct);

        // Mismas credenciales que el mock del frontend (mock-db.ts).
        const string passwordDemo = "sciad123";
        var hash = BCrypt.Net.BCrypt.HashPassword(passwordDemo, workFactor: 10);

        var usuarios = new[]
        {
            new Usuario
            {
                Nombre = "Lic. Marco Antonio Ortíz",
                Correo = "admin@sciad.gt",
                Rol = adminRol,
                Puesto = "Administrador del Sistema",
                Estado = "activo",
                PasswordHash = hash,
            },
            new Usuario
            {
                Nombre = "Carlos Gómez Rivera",
                Correo = "seguridad@sciad.gt",
                Rol = seguridadRol,
                Puesto = "Jefe de Seguridad — Turno Diurno",
                Estado = "activo",
                PasswordHash = hash,
            },
            new Usuario
            {
                Nombre = "Ing. Sofía Herrera",
                Correo = "gerencia@sciad.gt",
                Rol = gerenciaRol,
                Puesto = "Gerente de Operaciones y Auditoría",
                Estado = "activo",
                PasswordHash = hash,
            },
        };

        var correosExistentes = await _db.Usuarios.Select(u => u.Correo).ToListAsync(ct);
        foreach (var u in usuarios)
        {
            if (!correosExistentes.Contains(u.Correo))
            {
                _db.Usuarios.Add(u);
            }
        }
    }
}
