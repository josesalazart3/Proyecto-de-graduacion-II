using System.Security.Cryptography;
using Microsoft.Extensions.Logging;
using Sciad.Application.Dtos.Credenciales;
using Sciad.Application.Interfaces;
using Sciad.Domain.Entities;

namespace Sciad.Application.Services;

/// <summary>
/// Credenciales QR (CU-03): generación y reemisión de tokens cifrados de 64 caracteres hex
/// (RNF-01). Aparte del requisito mínimo del plan se bloquea la duplicidad de credencial activa
/// (409) — dos credenciales activas para una misma persona son una inconsistencia de auditoría
/// (ver bitácora 2B). Nunca se borra físicamente: solo cambia <c>estado</c>.
/// </summary>
public sealed class CredencialesService : ICredencialesService
{
    private readonly ICredencialRepository _credenciales;
    private readonly IPersonaRepository _personas;
    private readonly ILogger<CredencialesService> _logger;

    public CredencialesService(
        ICredencialRepository credenciales,
        IPersonaRepository personas,
        ILogger<CredencialesService> logger)
    {
        _credenciales = credenciales;
        _personas = personas;
        _logger = logger;
    }

    public async Task<ServicioResultado<CredencialDto>> GenerarAsync(
        int personaId, CancellationToken ct = default)
    {
        var persona = await _personas.FindByIdAsync(personaId, ct);
        if (persona is null)
        {
            return ServicioResultado<CredencialDto>.Fallo(CodigosError.NoEncontrado, "Persona no encontrada.");
        }

        if (!string.Equals(persona.Estado, "activo", StringComparison.OrdinalIgnoreCase))
        {
            return ServicioResultado<CredencialDto>.Fallo(
                CodigosError.Validacion, "No se puede generar una credencial para una persona inactiva.");
        }

        var existente = await _credenciales.ObtenerActivaPorPersonaAsync(personaId, ct);
        if (existente is not null)
        {
            return ServicioResultado<CredencialDto>.Fallo(
                CodigosError.Conflicto,
                "La persona ya tiene una credencial activa. Use la reemisión para reemplazarla.");
        }

        var creada = await _credenciales.AgregarAsync(new CredencialQr
        {
            PersonaId = personaId,
            Token = GenerarTokenHex64(),
            Estado = "activa",
            Emitido = Hoy(),
            ReemitidoDe = null,
        }, ct);

        _logger.LogInformation("Credencial generada (id={CredencialId}, persona={PersonaId}).", creada.Id, personaId);
        return ServicioResultado<CredencialDto>.Ok(CredencialDto.From(creada));
    }

    public async Task<ServicioResultado<CredencialDto>> ReemitirAsync(
        int id, CancellationToken ct = default)
    {
        var anterior = await _credenciales.FindByIdAsync(id, ct);
        if (anterior is null)
        {
            return ServicioResultado<CredencialDto>.Fallo(CodigosError.NoEncontrado, "Credencial no encontrada.");
        }

        if (string.Equals(anterior.Estado, "revocada", StringComparison.OrdinalIgnoreCase))
        {
            return ServicioResultado<CredencialDto>.Fallo(
                CodigosError.Validacion, "No se puede reemitir una credencial ya revocada.");
        }

        var persona = await _personas.FindByIdAsync(anterior.PersonaId, ct);
        if (persona is null)
        {
            return ServicioResultado<CredencialDto>.Fallo(CodigosError.NoEncontrado, "Persona no encontrada.");
        }

        if (!string.Equals(persona.Estado, "activo", StringComparison.OrdinalIgnoreCase))
        {
            return ServicioResultado<CredencialDto>.Fallo(
                CodigosError.Validacion, "No se puede reemitir una credencial para una persona inactiva.");
        }

        // Revoca la anterior y crea la nueva con la referencia de trazabilidad reemitido_de.
        anterior.Estado = "revocada";
        await _credenciales.ActualizarAsync(anterior, ct);

        var nueva = await _credenciales.AgregarAsync(new CredencialQr
        {
            PersonaId = anterior.PersonaId,
            Token = GenerarTokenHex64(),
            Estado = "activa",
            Emitido = Hoy(),
            ReemitidoDe = anterior.Id,
        }, ct);

        _logger.LogInformation(
            "Credencial reemitida (nueva={NuevaId}, anterior={AnteriorId}, persona={PersonaId}).",
            nueva.Id, anterior.Id, anterior.PersonaId);
        return ServicioResultado<CredencialDto>.Ok(CredencialDto.From(nueva));
    }

    public async Task<ServicioResultado<List<CredencialDto>>> ListarAsync(
        int? personaId, CancellationToken ct = default)
    {
        if (personaId.HasValue)
        {
            var persona = await _personas.FindByIdAsync(personaId.Value, ct);
            if (persona is null)
            {
                return ServicioResultado<List<CredencialDto>>.Fallo(
                    CodigosError.NoEncontrado, "Persona no encontrada.");
            }

            var historial = await _credenciales.ListarPorPersonaAsync(personaId.Value, ct);
            return ServicioResultado<List<CredencialDto>>.Ok(
                historial.Select(CredencialDto.From).ToList());
        }

        var todas = await _credenciales.ListarAsync(ct);
        return ServicioResultado<List<CredencialDto>>.Ok(todas.Select(CredencialDto.From).ToList());
    }

    private static DateOnly Hoy() => DateOnly.FromDateTime(DateTime.UtcNow);

    /// <summary>32 bytes aleatorios (CSPRNG) → 64 caracteres hex. RNF-01 / RNF-02.</summary>
    private static string GenerarTokenHex64()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}