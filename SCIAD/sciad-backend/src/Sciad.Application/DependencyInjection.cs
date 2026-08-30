using Microsoft.Extensions.DependencyInjection;
using Sciad.Application.Interfaces;
using Sciad.Application.Services;

namespace Sciad.Application;

/// <summary>Registro de dependencias de la capa Application.</summary>
public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddSingleton<ITokenService, TokenService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IUsuariosService, UsuariosService>();
        services.AddScoped<IPersonasService, PersonasService>();
        services.AddScoped<IZonasService, ZonasService>();
        services.AddScoped<IPerfilesAccesoService, PerfilesAccesoService>();
        services.AddScoped<ICredencialesService, CredencialesService>();
        return services;
    }
}
