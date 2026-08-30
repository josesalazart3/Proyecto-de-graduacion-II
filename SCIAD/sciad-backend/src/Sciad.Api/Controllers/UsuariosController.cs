using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sciad.Api.Common;
using Sciad.Application.Dtos.Auth;
using Sciad.Application.Dtos.Common;
using Sciad.Application.Dtos.Usuarios;
using Sciad.Application.Interfaces;

namespace Sciad.Api.Controllers;

/// <summary>CRUD administrativo de usuarios (CU-01). Solo rol Administrador.</summary>
[ApiController]
[Authorize(Policy = "RequireAdmin")]
[Route("api/usuarios")]
public sealed class UsuariosController : ControllerBase
{
    private readonly IUsuariosService _usuarios;

    public UsuariosController(IUsuariosService usuarios)
    {
        _usuarios = usuarios;
    }

    /// <summary>Lista paginada de usuarios (cada página).</summary>
    [HttpGet]
    [ProducesResponseType(typeof(PaginadoDto<UsuarioDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Listar(
        [FromQuery] int pagina = 1,
        [FromQuery] int tamanoPagina = 20,
        CancellationToken ct = default)
    {
        var respuesta = await _usuarios.ListarAsync(pagina, tamanoPagina, ct);
        return Ok(respuesta.Dato);
    }

    /// <summary>Crea un usuario. 409 si el correo ya existe.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(UsuarioDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Crear([FromBody] CrearUsuarioRequest request, CancellationToken ct)
    {
        var resultado = await _usuarios.CrearAsync(request, ct);
        return resultado.Exitoso
            ? Created($"/api/usuarios/{resultado.Dato!.Id}", resultado.Dato)
            : ApiProblem.FromServicio(resultado);
    }

    /// <summary>Edita un usuario. La contraseña es opcional (solo se re-emite si se envía).</summary>
    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(UsuarioDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Actualizar(int id, [FromBody] ActualizarUsuarioRequest request, CancellationToken ct)
    {
        var resultado = await _usuarios.ActualizarAsync(id, request, ct);
        return resultado.Exitoso ? Ok(resultado.Dato) : ApiProblem.FromServicio(resultado);
    }

    /// <summary>Alta/baja lógica: <c>{"estado":"activo|inactivo"}</c>. Nunca borrado físico.</summary>
    [HttpPatch("{id:int}/estado")]
    [ProducesResponseType(typeof(UsuarioDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CambiarEstado(int id, [FromBody] CambiarEstadoRequest request, CancellationToken ct)
    {
        var resultado = await _usuarios.CambiarEstadoAsync(id, request, ct);
        return resultado.Exitoso ? Ok(resultado.Dato) : ApiProblem.FromServicio(resultado);
    }
}
