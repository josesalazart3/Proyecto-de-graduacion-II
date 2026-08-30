namespace Sciad.Domain.Entities;

/// <summary>
/// Zona / punto de acceso físico. Referencia DERCAS §7.2 — tabla `zonas_acceso`.
/// </summary>
public class ZonaAcceso
{
    public int Id { get; set; }

    /// <summary>Nombre de la zona. VARCHAR(80) NOT NULL.</summary>
    public string Nombre { get; set; } = null!;

    /// <summary>Nivel de seguridad: bajo | medio | alto (p. ej. "CRITICO" para datacenter).</summary>
    public string NivelSeguridad { get; set; } = null!;

    public ICollection<PerfilAcceso> Perfiles { get; set; } = new List<PerfilAcceso>();
    public ICollection<RegistroAcceso> Registros { get; set; } = new List<RegistroAcceso>();
}
