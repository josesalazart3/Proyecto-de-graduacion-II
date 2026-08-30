using Microsoft.Extensions.Logging;
using Sciad.Application.Dtos.Auth;
using Sciad.Application.Interfaces;
using Sciad.Domain.Entities;

namespace Sciad.Application.Services;

/// <summary>
/// Lógica de autenticación: valida credenciales (bcrypt), emite el JWT y resuelve el usuario actual.
/// </summary>
public sealed class AuthService : IAuthService
{
    private readonly IUsuarioRepository _usuarios;
    private readonly ITokenService _token;
    private readonly ILogger<AuthService> _logger;

    public AuthService(IUsuarioRepository usuarios, ITokenService token, ILogger<AuthService> logger)
    {
        _usuarios = usuarios;
        _token = token;
        _logger = logger;
    }

    public async Task<LoginResult> LoginAsync(string email, string password, CancellationToken ct = default)
    {
        // Respuesta genérica: no revelar si el correo existe.
        var fallo = LoginResult.Fallo(LoginResult.CredencialesInvalidas);

        var usuario = await _usuarios.FindByCorreoAsync(email, ct);
        if (usuario is null)
        {
            _logger.LogInformation("Intento de login con correo desconocido.");
            return fallo;
        }

        if (!string.Equals(usuario.Estado, "activo", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogInformation("Intento de login de usuario inactivo (id={UsuarioId}).", usuario.Id);
            return LoginResult.Fallo(LoginResult.UsuarioInactivo);
        }

        if (!BCrypt.Net.BCrypt.Verify(password, usuario.PasswordHash))
        {
            return fallo;
        }

        var token = _token.GenerarToken(usuario.Id, usuario.Nombre, usuario.Rol.Codigo);
        var dto = UsuarioDto.From(usuario);

        _logger.LogInformation("Login correcto (id={UsuarioId}, rol={Rol}).", usuario.Id, usuario.Rol.Codigo);
        return LoginResult.Ok(new LoginResponse(dto, token));
    }

    public async Task<UsuarioDto?> ObtenerPorIdAsync(int usuarioId, CancellationToken ct = default)
    {
        var usuario = await _usuarios.FindByIdAsync(usuarioId, ct);
        return usuario is null ? null : UsuarioDto.From(usuario);
    }
}
