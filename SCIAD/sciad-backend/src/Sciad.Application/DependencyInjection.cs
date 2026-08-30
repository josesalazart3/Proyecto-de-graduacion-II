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
        return services;
    }
}
