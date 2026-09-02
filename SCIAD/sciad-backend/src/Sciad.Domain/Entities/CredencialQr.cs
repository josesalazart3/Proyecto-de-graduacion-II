namespace Sciad.Domain.Entities;

/// <summary>
/// Credencial QR cifrada. Referencia DERCAS §7.2 — tabla `credenciales_qr`.
/// </summary>
public class CredencialQr
{
    public int Id { get; set; }

    public int PersonaId { get; set; }
    public Persona Persona { get; set; } = null!;

    /// <summary>Token cifrado CHAR(64) hex (SHA-256 + salt). UNIQUE.</summary>
    public string Token { get; set; } = null!;

    /// <summary>"activa" | "revocada" | "vencida" (soft delete).</summary>
    public string Estado { get; set; } = "activa";

    public DateOnly Emitido { get; set; }

    /// <summary>FK a la credencial anterior en caso de reemisión (nullable).</summary>
    public int? ReemitidoDe { get; set; }
    public CredencialQr? ReemitidaDeCredencial { get; set; }

    /// <summary>Motivo de revocación (si aplica). Agregado en Fase 3 para dar trazabilidad al revocar.</summary>
    public string? Motivo { get; set; }
}
