using Sciad.Application.Dtos.Auth;
using Sciad.Application.Dtos.Common;
using Sciad.Application.Dtos.Usuarios;
using Sciad.Application.Services;

namespace Sciad.Application.Interfaces;

public interface IUsuariosService
{
    Task<ServicioResultado<PaginadoDto<UsuarioDto>>> ListarAsync(int pagina, int tamanoPagina, CancellationToken ct = default);
    Task<ServicioResultado<UsuarioDto>> CrearAsync(CrearUsuarioRequest req, CancellationToken ct = default);
    Task<ServicioResultado<UsuarioDto>> ActualizarAsync(int id, ActualizarUsuarioRequest req, CancellationToken ct = default);
    Task<ServicioResultado<UsuarioDto>> CambiarEstadoAsync(int id, CambiarEstadoRequest req, CancellationToken ct = default);
}