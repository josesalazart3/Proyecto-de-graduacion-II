using Sciad.Domain.Entities;

namespace Sciad.Application.Dtos.Zonas;

public sealed record ZonaDto(
    string Id,
    string Nombre,
    string NivelSeguridad)
{
    public static ZonaDto From(ZonaAcceso z) => new(
        z.Id.ToString(),
        z.Nombre,
        z.NivelSeguridad);
}