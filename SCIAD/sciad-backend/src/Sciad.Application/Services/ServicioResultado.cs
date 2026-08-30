namespace Sciad.Application.Services;

/// <summary>Códigos de error de dominio mapeables a respuestas HTTP consistentes.</summary>
public static class CodigosError
{
    /// <summary>→ 404 Not Found.</summary>
    public const string NoEncontrado = "NO_ENCONTRADO";

    /// <summary>→ 409 Conflict (unicidad, estado ya ocupado, etc.).</summary>
    public const string Conflicto = "CONFLICTO";

    /// <summary>→ 400 Bad Request (validación de negocio).</summary>
    public const string Validacion = "VALIDACION";
}

/// <summary>
/// Resultado de una operación de servicio: <see cref="Exitoso"/> con <see cref="Dato"/>
/// en el caso feliz, o <see cref="CodigoError"/> + <see cref="Mensaje"/> en el fallo.
/// El controlador mapea el código a una respuesta RFC 7807 vía <c>ApiProblem.FromServicio</c>.
/// </summary>
public sealed record ServicioResultado<T>(bool Exitoso, T? Dato = default, string? CodigoError = null, string? Mensaje = null)
{
    public static ServicioResultado<T> Ok(T dato) => new(true, dato);
    public static ServicioResultado<T> Fallo(string codigo, string mensaje) => new(false, default, codigo, mensaje);
}