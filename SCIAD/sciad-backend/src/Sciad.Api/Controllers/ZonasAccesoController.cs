using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sciad.Api.Common;
using Sciad.Application.Dtos.Zonas;
using Sciad.Application.Interfaces;

namespace Sciad.Api.Controllers;

/// <summary>CRUD de zonas de acceso. Solo rol Administrador.</summary>
[ApiController]
[Authorize(Policy = "RequireAdmin")]
[Route("api/zonas-acceso")]
public sealed class ZonasAccesoController : ControllerBase
{
    private readonly IZonasService _zonas;

    public ZonasAccesoController(IZonasService zonas)
    {
        _zonas = zonas;
    }

    /// <summary>Lista todas las zonas de acceso.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<ZonaDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Listar(CancellationToken ct)
    {
        var resultado = await _zonas.ListarAsync(ct);
        return Ok(resultado.Dato);
    }

    [HttpPost]
    [ProducesResponseType(typeof(ZonaDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Crear([FromBody] CrearZonaRequest request, CancellationToken ct)
    {
        var resultado = await _zonas.CrearAsync(request, ct);
        return resultado.Exitoso
            ? Created($"/api/zonas-acceso/{resultado.Dato!.Id}", resultado.Dato)
            : ApiProblem.FromServicio(resultado);
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(ZonaDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Actualizar(int id, [FromBody] ActualizarZonaRequest request, CancellationToken ct)
    {
        var resultado = await _zonas.ActualizarAsync(id, request, ct);
        return resultado.Exitoso ? Ok(resultado.Dato) : ApiProblem.FromServicio(resultado);
    }
}
