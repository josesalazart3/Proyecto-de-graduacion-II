using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

namespace Sciad.Api.Common;

/// <summary>
/// Middleware central de manejo de excepciones no controladas: las convierte en
/// Problem Details (RFC 7807) sin filtrar detalles internos, y loguea la excepción completa.
/// </summary>
public sealed class ErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ErrorHandlingMiddleware> _logger;

    public ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Excepción no controlada en {Method} {Path}", context.Request.Method, context.Request.Path);

            if (context.Response.HasStarted)
            {
                throw; // No se puede reescribir una respuesta ya iniciada.
            }

            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = JsonDefaults.ContentType;

            var problem = new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "Error interno del servidor",
                Detail = "Ocurrió un error inesperado. Intente nuevamente.",
            };
            problem.Extensions["traceId"] = context.TraceIdentifier;
            problem.Extensions["code"] = "INTERNAL_ERROR";
            problem.Extensions["message"] = "Ocurrió un error inesperado.";

            await context.Response.WriteAsJsonAsync(problem, (JsonSerializerOptions)JsonDefaults.Web, context.RequestAborted);
        }
    }
}
