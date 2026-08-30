using Microsoft.Extensions.Logging;
using Sciad.Application.Dtos.Auth;
using Sciad.Application.Dtos.Common;
using Sciad.Application.Dtos.Usuarios;
using Sciad.Application.Interfaces;
using Sciad.Domain.Entities;

namespace Sciad.Application.Services;

/// <summary>
/// CRUD administrativo de usuarios (CU-01, rol Administrador): alta/baja lógica vía
/// <c>estado</c>, unicidad de correo y resolución del rol por código (ADMIN/SEGURIDAD/GERENCIA).
/// </summary>
public sealed class UsuariosService : IUsuariosService
{
    private readonly IUsuarioRepository _usuarios;
    private readonly ILogger<UsuariosService> _logger;

    public UsuariosService(IUsuarioRepository usuarios, ILogger<UsuariosService> logger)
    {
        _usuarios = usuarios;
        _logger = logger;
    }

    public async Task<ServicioResultado<PaginadoDto<UsuarioDto>>> ListarAsync(
        int pagina, int tamanoPagina, CancellationToken ct = default)
    {
        var (items, total) = await _usuarios.ListarPaginadoAsync(pagina, tamanoPagina, ct);
        var totalPaginas = CalcularTotalPaginas(total, tamanoPagina);
        var dtos = items.Select(UsuarioDto.From).ToList();
        return ServicioResultado<PaginadoDto<UsuarioDto>>.Ok(
            new PaginadoDto<UsuarioDto>(dtos, total, pagina, tamanoPagina, totalPaginas));
    }

    public async Task<ServicioResultado<UsuarioDto>> CrearAsync(CrearUsuarioRequest req, CancellationToken ct = default)
    {
        if (await _usuarios.ExisteCorreoAsync(req.Correo, null, ct))
        {
            return ServicioResultado<UsuarioDto>.Fallo(CodigosError.Conflicto, "Ya existe un usuario con ese correo.");
        }

        var rol = await _usuarios.FindRolByCodigoAsync(req.Rol, ct);
        if (rol is null)
        {
            return ServicioResultado<UsuarioDto>.Fallo(
                CodigosError.Validacion, "El rol no existe. Valores válidos: ADMIN, SEGURIDAD, GERENCIA.");
        }

        var usuario = new Usuario
        {
            Nombre = req.Nombre.Trim(),
            Correo = req.Correo.Trim().ToLowerInvariant(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password, workFactor: 10),
            Rol = rol,
            Estado = "activo",
            Puesto = req.Puesto?.Trim() ?? string.Empty,
            FechaCreacion = DateTime.UtcNow,
        };

        var creado = await _usuarios.AgregarAsync(usuario, ct);
        _logger.LogInformation("Usuario creado (id={UsuarioId}, rol={Rol}).", creado.Id, rol.Codigo);
        return ServicioResultado<UsuarioDto>.Ok(UsuarioDto.From(creado));
    }

    public async Task<ServicioResultado<UsuarioDto>> ActualizarAsync(
        int id, ActualizarUsuarioRequest req, CancellationToken ct = default)
    {
        var existente = await _usuarios.FindByIdAsync(id, ct);
        if (existente is null)
        {
            return ServicioResultado<UsuarioDto>.Fallo(CodigosError.NoEncontrado, "Usuario no encontrado.");
        }

        if (await _usuarios.ExisteCorreoAsync(req.Correo, id, ct))
        {
            return ServicioResultado<UsuarioDto>.Fallo(CodigosError.Conflicto, "Ya existe un usuario con ese correo.");
        }

        var rol = await _usuarios.FindRolByCodigoAsync(req.Rol, ct);
        if (rol is null)
        {
            return ServicioResultado<UsuarioDto>.Fallo(
                CodigosError.Validacion, "El rol no existe. Valores válidos: ADMIN, SEGURIDAD, GERENCIA.");
        }

        existente.Nombre = req.Nombre.Trim();
        existente.Correo = req.Correo.Trim().ToLowerInvariant();
        existente.Puesto = req.Puesto?.Trim() ?? string.Empty;
        existente.Rol = rol;
        if (!string.IsNullOrWhiteSpace(req.Password))
        {
            existente.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password, workFactor: 10);
        }

        var actualizado = await _usuarios.ActualizarAsync(existente, ct);
        _logger.LogInformation("Usuario actualizado (id={UsuarioId}).", actualizado.Id);
        return ServicioResultado<UsuarioDto>.Ok(UsuarioDto.From(actualizado));
    }

    public async Task<ServicioResultado<UsuarioDto>> CambiarEstadoAsync(
        int id, CambiarEstadoRequest req, CancellationToken ct = default)
    {
        var existente = await _usuarios.FindByIdAsync(id, ct);
        if (existente is null)
        {
            return ServicioResultado<UsuarioDto>.Fallo(CodigosError.NoEncontrado, "Usuario no encontrado.");
        }

        var estado = req.Estado.Trim().ToLowerInvariant();
        if (estado is not ("activo" or "inactivo"))
        {
            return ServicioResultado<UsuarioDto>.Fallo(
                CodigosError.Validacion, "El estado debe ser 'activo' o 'inactivo'.");
        }

        existente.Estado = estado;
        var actualizado = await _usuarios.ActualizarAsync(existente, ct);
        _logger.LogInformation("Estado de usuario cambiado (id={UsuarioId}, estado={Estado}).", id, estado);
        return ServicioResultado<UsuarioDto>.Ok(UsuarioDto.From(actualizado));
    }

    private static int CalcularTotalPaginas(int total, int tamanoPagina)
        => total == 0 ? 0 : (int)Math.Ceiling(total / (double)tamanoPagina);
}