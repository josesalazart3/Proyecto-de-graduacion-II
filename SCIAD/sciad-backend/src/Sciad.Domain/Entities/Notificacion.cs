namespace Sciad.Domain.Entities;

/// <summary>
/// Notificación automática por eventos anómalos. Referencia DERCAS §7.2 — tabla `notificaciones`.
/// </summary>
public class Notificacion
{
    public int Id { get; set; }

    public int? UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }

    public int? PersonaId { get; set; }
    public Persona? Persona { get; set; }

    /// <summary>fuera_horario | suplantacion | concentracion | token_revocado. VARCHAR(30) NOT NULL.</summary>
    public string Tipo { get; set; } = null!;

    public string Mensaje { get; set; } = null!;

    public bool Leida { get; set; }
}
