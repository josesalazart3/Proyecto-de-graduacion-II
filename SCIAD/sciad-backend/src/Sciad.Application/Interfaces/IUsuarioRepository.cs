using Sciad.Domain.Entities;

namespace Sciad.Application.Interfaces;

/// <summary>
/// Acceso de lectura a usuarios para autenticación. Implementado en Infrastructure (EF Core).
/// </summary>
public interface IUsuarioRepository
{
    /// <summary>Busca por correo (insensible a mayúsculas), incluyendo el rol.</summary>
    Task<Usuario?> FindByCorreoAsync(string correo, CancellationToken ct = default);

    /// <summary>Busca por id incluyendo el rol.</summary>
    Task<Usuario?> FindByIdAsync(int id, CancellationToken ct = default);
}
