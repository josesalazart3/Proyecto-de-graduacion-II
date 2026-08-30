using Sciad.Domain.Entities;

namespace Sciad.Application.Dtos.Credenciales;

public sealed record CredencialDto(
    string Id,
    string PersonaId,
    string PersonaNombre,
    string DpiCodigo,
    string Token,
    string Estado,
    DateOnly Emitido,
    int? ReemitidoDe)
{
    public static CredencialDto From(CredencialQr c) => new(
        c.Id.ToString(),
        c.PersonaId.ToString(),
        c.Persona?.Nombre ?? "",
        c.Persona?.DpiCodigo ?? "",
        c.Token,
        c.Estado,
        c.Emitido,
        c.ReemitidoDe);
}