using System.ComponentModel.DataAnnotations;

namespace Sciad.Application.Dtos.Zonas;

public sealed class ActualizarZonaRequest
{
    [Required(ErrorMessage = "El nombre es obligatorio.")]
    [StringLength(80, ErrorMessage = "El nombre no puede superar 80 caracteres.")]
    public string Nombre { get; set; } = null!;

    [Required(ErrorMessage = "El nivel de seguridad es obligatorio.")]
    [StringLength(20, ErrorMessage = "El nivel de seguridad no puede superar 20 caracteres.")]
    public string NivelSeguridad { get; set; } = null!;
}