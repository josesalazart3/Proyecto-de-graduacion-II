using Microsoft.EntityFrameworkCore;
using Sciad.Application.Interfaces;
using Sciad.Domain.Entities;
using Sciad.Infrastructure.Persistence;

namespace Sciad.Infrastructure.Repositories;

/// <summary>Implementación EF Core de <see cref="IUsuarioRepository"/>.</summary>
public sealed class UsuarioRepository : IUsuarioRepository
{
    private readonly SciadDbContext _db;

    public UsuarioRepository(SciadDbContext db)
    {
        _db = db;
    }

    public Task<Usuario?> FindByCorreoAsync(string correo, CancellationToken ct = default)
    {
        return _db.Usuarios
            .Include(u => u.Rol)
            .FirstOrDefaultAsync(u => u.Correo.ToLower() == correo.ToLower(), ct);
    }

    public Task<Usuario?> FindByIdAsync(int id, CancellationToken ct = default)
    {
        return _db.Usuarios
            .Include(u => u.Rol)
            .FirstOrDefaultAsync(u => u.Id == id, ct);
    }
}
