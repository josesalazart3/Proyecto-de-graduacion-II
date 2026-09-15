using Microsoft.Extensions.Logging;
using Moq;
using Sciad.Domain.Entities;

namespace Sciad.Tests.Support;

/// <summary>
/// Fábricas de entidades de dominio para las pruebas unitarias. Centralizan la construcción
/// de estados válidos de <see cref="Persona"/>, <see cref="ZonaAcceso"/>,
/// <see cref="PerfilAcceso"/>, <see cref="CredencialQr"/> y <see cref="Usuario"/> para que
/// cada test declare solo lo que varía, no todo el objeto.
/// </summary>
public static class TestData
{
    // ---------------- Persona ----------------
    public static Persona PersonaActiva(int id = 1, string nombre = "Ana López") =>
        new() { Id = id, Nombre = nombre, DpiCodigo = $"DPI-{id:D4}", Tipo = Persona.TipoColaborador, Estado = "activo" };

    public static Persona PersonaInactiva(int id = 1) =>
        new() { Id = id, Nombre = "Inactiva", DpiCodigo = $"DPI-{id:D4}", Tipo = Persona.TipoVisitante, Estado = "inactivo" };

    // ---------------- Zona ----------------
    public static ZonaAcceso ZonaActiva(int id = 1, string nombre = "Oficinas") =>
        new() { Id = id, Nombre = nombre, NivelSeguridad = "MEDIO", Capacidad = 50, NivelRiesgo = "MEDIO", Estado = "activo" };

    public static ZonaAcceso ZonaInactiva(int id = 1) =>
        new() { Id = id, Nombre = "Clausurada", NivelSeguridad = "ALTO", NivelRiesgo = "ALTO", Estado = "inactivo" };

    // ---------------- Perfil de acceso ----------------
    public static PerfilAcceso PerfilVigente(int id = 1, int personaId = 1, int zonaId = 1) =>
        new()
        {
            Id = id,
            PersonaId = personaId,
            ZonaId = zonaId,
            VigenciaInicio = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30)),
            VigenciaFin = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(+30)),
        };

    public static PerfilAcceso PerfilVencido(int id = 1, int personaId = 1, int zonaId = 1) =>
        new()
        {
            Id = id,
            PersonaId = personaId,
            ZonaId = zonaId,
            VigenciaInicio = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-60)),
            VigenciaFin = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)),
        };

    public static PerfilAcceso PerfilFuturo(int id = 1, int personaId = 1, int zonaId = 1) =>
        new()
        {
            Id = id,
            PersonaId = personaId,
            ZonaId = zonaId,
            VigenciaInicio = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(+10)),
            VigenciaFin = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(+40)),
        };

    // ---------------- Credencial ----------------
    public static CredencialQr CredencialActiva(int id = 1, int personaId = 1, Persona? persona = null) => new()
    {
        Id = id,
        PersonaId = personaId,
        Persona = persona ?? PersonaActiva(personaId),
        Token = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
        Estado = "activa",
        Emitido = DateOnly.FromDateTime(DateTime.UtcNow),
    };

    public static CredencialQr CredencialEnEstado(string estado, int id = 1, int personaId = 1, Persona? persona = null) =>
        new()
        {
            Id = id,
            PersonaId = personaId,
            Persona = persona ?? PersonaActiva(personaId),
            Token = $"token-{estado}-{id}".PadRight(64, '0'),
            Estado = estado,
            Emitido = DateOnly.FromDateTime(DateTime.UtcNow),
        };

    // ---------------- Usuario / rol ----------------
    public static Usuario UsuarioGerencia(int id = 1) =>
        new()
        {
            Id = id,
            Nombre = "Gerente",
            Correo = "gerencia@sciad.gt",
            PasswordHash = "$2a$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ012345",
            RolId = 3,
            Rol = new Rol { Id = 3, Nombre = "Gerencia", Codigo = "GERENCIA" },
            Estado = "activo",
        };

    public static Usuario UsuarioRol(string codigo, int id = 1) =>
        new()
        {
            Id = id,
            Nombre = $"Usuario {codigo}",
            Correo = $"{codigo.ToLowerInvariant()}@sciad.gt",
            PasswordHash = "$2a$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ012345",
            RolId = id,
            Rol = new Rol { Id = id, Nombre = codigo, Codigo = codigo },
            Estado = "activo",
        };

    // ---------------- Registro de acceso ----------------
    public static RegistroAcceso Registro(
        int personaId, int zonaId, string tipo, DateOnly? fecha = null, TimeOnly? hora = null, Persona? persona = null, ZonaAcceso? zona = null) =>
        new()
        {
            Id = personaId * 1000 + zonaId,
            PersonaId = personaId,
            Persona = persona ?? PersonaActiva(personaId),
            ZonaId = zonaId,
            Zona = zona ?? ZonaActiva(zonaId),
            Fecha = fecha ?? DateOnly.FromDateTime(DateTime.UtcNow),
            Hora = hora ?? TimeOnly.FromDateTime(DateTime.UtcNow),
            Tipo = tipo,
            UsuarioId = 1,
        };

    // ---------------- Logger no-op para servicios ----------------
    public static ILogger<T> LoggerNulo<T>() => Mock.Of<ILogger<T>>();
}