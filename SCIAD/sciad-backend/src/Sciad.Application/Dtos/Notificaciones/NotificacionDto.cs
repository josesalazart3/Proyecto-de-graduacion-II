using Sciad.Domain.Entities;

namespace Sciad.Application.Dtos.Notificaciones;

/// <summary>
/// Notificación automática por evento anómalo (CU-09, lectura/gestión). Divergencia de contrato con el
/// mock del frontend (que espera un campo <c>timestamp</c>): la tabla <c>notificaciones</c> no tiene
/// columna de fecha (DERCAS §7.2 no la define), así que este DTO no la expone — se reconcilia en Fase 3.
/// </summary>
public sealed record NotificacionDto(
    string Id,
    int? UsuarioId,
    string Tipo,
    string Mensaje,
    bool Leida,
    int? PersonaId,
    string? PersonaNombre)
{
    public static NotificacionDto From(Notificacion n)
    {
        return new NotificacionDto(
            Id: n.Id.ToString(),
            UsuarioId: n.UsuarioId,
            Tipo: n.Tipo,
            Mensaje: n.Mensaje,
            Leida: n.Leida,
            PersonaId: n.PersonaId,
            PersonaNombre: n.Persona?.Nombre);
    }
}