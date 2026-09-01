using Microsoft.EntityFrameworkCore;
using Sciad.Application.Interfaces;
using Sciad.Domain.Entities;
using Sciad.Infrastructure.Persistence;

namespace Sciad.Infrastructure.Repositories;

/// <summary>Implementación EF Core de <see cref="IAuditoriaRepository"/>. Lecturas sin seguimiento.</summary>
public sealed class AuditoriaRepository : IAuditoriaRepository
{
    private readonly SciadDbContext _db;

    public AuditoriaRepository(SciadDbContext db)
    {
        _db = db;
    }

    public async Task<(IReadOnlyList<Auditoria> Items, int Total)> ListarAsync(
        string? tipo, string? estado, int pagina, int tamanoPagina, CancellationToken ct = default)
    {
        var query = _db.Auditorias.AsNoTracking()
            .Include(a => a.Persona)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(tipo)) query = query.Where(a => a.Tipo == tipo.Trim().ToLowerInvariant());
        if (!string.IsNullOrWhiteSpace(estado)) query = query.Where(a => a.Estado == estado.Trim().ToLowerInvariant());

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(a => a.Fecha).ThenByDescending(a => a.Id)
            .Skip((pagina - 1) * tamanoPagina).Take(tamanoPagina)
            .ToListAsync(ct);
        return (items, total);
    }

    public Task<Auditoria?> FindByIdAsync(int id, CancellationToken ct = default)
        => _db.Auditorias.FirstOrDefaultAsync(a => a.Id == id, ct);

    public async Task<List<Auditoria>> AgregarHallazgosAsync(List<Auditoria> hallazgos, CancellationToken ct = default)
    {
        _db.Auditorias.AddRange(hallazgos);
        await _db.SaveChangesAsync(ct);
        return hallazgos;
    }

    public async Task<Auditoria> ActualizarAsync(Auditoria hallazgo, CancellationToken ct = default)
    {
        await _db.SaveChangesAsync(ct);
        return hallazgo;
    }
}