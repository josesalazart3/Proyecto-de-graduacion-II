using Microsoft.AspNetCore.Mvc;

namespace Sciad.Api.Common;

/// <summary>
/// Fábrica de respuestas de error consistentes (RFC 7807 Problem Details).
/// Se incluye <c>code</c> y <c>message</c> para mantener compatibilidad con el
/// contrato de error que el frontend ya esperaba del mock (<c>{ message }</c>).
/// </summary>
public static class ApiProblem
{
    public static ObjectResult Unauthorized(string message) =>
        Problem(StatusCodes.Status401Unauthorized, "No autorizado", message, "UNAUTHORIZED");

    public static ObjectResult Forbidden(string message) =>
        Problem(StatusCodes.Status403Forbidden, "Acceso denegado", message, "FORBIDDEN");

    public static ObjectResult NotFound(string message) =>
        Problem(StatusCodes.Status404NotFound, "No encontrado", message, "NOT_FOUND");

    public static ObjectResult BadRequest(string message, string code) =>
        Problem(StatusCodes.Status400BadRequest, "Solicitud inválida", message, code);

    private static ObjectResult Problem(int status, string title, string detail, string code)
    {
        var problem = new ProblemDetails
        {
            Status = status,
            Title = title,
            Detail = detail,
        };
        problem.Extensions["code"] = code;
        problem.Extensions["message"] = detail;
        return new ObjectResult(problem) { StatusCode = status };
    }
}
