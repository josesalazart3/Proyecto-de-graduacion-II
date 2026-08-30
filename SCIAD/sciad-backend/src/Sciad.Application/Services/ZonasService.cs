using Microsoft.Extensions.Logging;
using Sciad.Application.Dtos.Zonas;
using Sciad.Application.Interfaces;
using Sciad.Domain.Entities;

namespace Sciad.Application.Services;

/// <summary>
/// CRUD de zonas de acceso. Nota: según DERCAS §7.2, <c>zonas_acceso</c> NO tiene columna
/// <c>estado</c> — las zonas siempre están vigentes (ver bitácora 2B).
/// </summary>
public sealed class ZonasService : IZonasService
{
    private readonly IZonaRepository _zonas;
    private readonly ILogger<ZonasService> _logger;

    public ZonasService(IZonaRepository zonas, ILogger<ZonasService> logger)
    {
        _zonas = zonas;
        _logger = logger;
    }

    public async Task<ServicioResultado<IReadOnlyList<ZonaDto>>> ListarAsync(CancellationToken ct = default)
    {
        var zonas = await _zonas.ListarAsync(ct);
        return ServicioResultado<IReadOnlyList<ZonaDto>>.Ok(zonas.Select(ZonaDto.From).ToList());
    }

    public async Task<ServicioResultado<ZonaDto>> CrearAsync(CrearZonaRequest req, CancellationToken ct = default)
    {
        var zona = new ZonaAcceso
        {
            Nombre = req.Nombre.Trim(),
            NivelSeguridad = req.NivelSeguridad.Trim(),
        };

        var creada = await _zonas.AgregarAsync(zona, ct);
        _logger.LogInformation("Zona creada (id={ZonaId}).", creada.Id);
        return ServicioResultado<ZonaDto>.Ok(ZonaDto.From(creada));
    }

    public async Task<ServicioResultado<ZonaDto>> ActualizarAsync(
        int id, ActualizarZonaRequest req, CancellationToken ct = default)
    {
        var existente = await _zonas.FindByIdAsync(id, ct);
        if (existente is null)
        {
            return ServicioResultado<ZonaDto>.Fallo(CodigosError.NoEncontrado, "Zona no encontrada.");
        }

        existente.Nombre = req.Nombre.Trim();
        existente.NivelSeguridad = req.NivelSeguridad.Trim();

        var actualizada = await _zonas.ActualizarAsync(existente, ct);
        _logger.LogInformation("Zona actualizada (id={ZonaId}).", actualizada.Id);
        return ServicioResultado<ZonaDto>.Ok(ZonaDto.From(actualizada));
    }
}