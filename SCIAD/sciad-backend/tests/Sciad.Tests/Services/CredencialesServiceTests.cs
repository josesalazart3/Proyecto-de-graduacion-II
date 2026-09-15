using System.Text.RegularExpressions;
using Moq;
using Sciad.Application.Dtos.Credenciales;
using Sciad.Application.Interfaces;
using Sciad.Application.Services;
using Sciad.Domain.Entities;
using Sciad.Tests.Support;

namespace Sciad.Tests.Services;

/// <summary>
/// Credenciales QR (CU-03): generación, reemisión y revocación. Aquí se cubren las reglas de
/// bloqueo (persona inactiva, credencial activa duplicada, reemisión de una revocada), la
/// trazabilidad <c>reemitido_de</c> y el formato del token (64 hex, SEC-06).
/// </summary>
public sealed class CredencialesServiceTests
{
    private static readonly Regex TokenHex64 = new("^[a-f0-9]{64}$", RegexOptions.Compiled);

    private readonly Mock<ICredencialRepository> _credenciales = new();
    private readonly Mock<IPersonaRepository> _personas = new();

    private CredencialesService Servicio() =>
        new(_credenciales.Object, _personas.Object, TestData.LoggerNulo<CredencialesService>());

    // ========== Generar ==========
    [Fact]
    public async Task Generar_PersonaNoExiste_DevuelveNoEncontrado()
    {
        _personas.Setup(m => m.FindByIdAsync(9, It.IsAny<CancellationToken>())).ReturnsAsync((Persona?)null);

        var resultado = await Servicio().GenerarAsync(9);

        Assert.False(resultado.Exitoso);
        Assert.Equal(CodigosError.NoEncontrado, resultado.CodigoError);
    }

    [Fact]
    public async Task Generar_PersonaInactiva_DevuelveValidacion()
    {
        _personas.Setup(m => m.FindByIdAsync(9, It.IsAny<CancellationToken>())).ReturnsAsync(TestData.PersonaInactiva(9));

        var resultado = await Servicio().GenerarAsync(9);

        Assert.False(resultado.Exitoso);
        Assert.Equal(CodigosError.Validacion, resultado.CodigoError);
    }

    [Fact]
    public async Task Generar_PersonaConCredencialActiva_DevuelveConflicto()
    {
        _personas.Setup(m => m.FindByIdAsync(9, It.IsAny<CancellationToken>())).ReturnsAsync(TestData.PersonaActiva(9));
        _credenciales.Setup(m => m.ObtenerActivaPorPersonaAsync(9, It.IsAny<CancellationToken>()))
            .ReturnsAsync(TestData.CredencialActiva(5, 9));

        var resultado = await Servicio().GenerarAsync(9);

        Assert.False(resultado.Exitoso);
        Assert.Equal(CodigosError.Conflicto, resultado.CodigoError);
    }

    [Fact]
    public async Task Generar_Exito_Token64HexYEstadoActiva()
    {
        _personas.Setup(m => m.FindByIdAsync(9, It.IsAny<CancellationToken>())).ReturnsAsync(TestData.PersonaActiva(9, "Ana López"));
        _credenciales.Setup(m => m.ObtenerActivaPorPersonaAsync(9, It.IsAny<CancellationToken>())).ReturnsAsync((CredencialQr?)null);
        _credenciales.Setup(m => m.AgregarAsync(It.IsAny<CredencialQr>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((CredencialQr c, CancellationToken _) => { c.Id = 77; return c; });

        var resultado = await Servicio().GenerarAsync(9);

        Assert.True(resultado.Exitoso);
        var dto = resultado.Dato!;
        Assert.Equal("77", dto.Id);
        Assert.Equal("activa", dto.Estado);
        Assert.Matches(TokenHex64, dto.Token);
        Assert.Null(dto.ReemitidoDe);
        Assert.DoesNotMatch(TokenHex64, "no-token");
        // El token generado debe diferir entre llamadas (CSPRNG).
        var otroToken = dto.Token;

        // Segundo escenario: otra persona sin credencial previa → nuevo token distinto.
        _personas.Setup(m => m.FindByIdAsync(10, It.IsAny<CancellationToken>())).ReturnsAsync(TestData.PersonaActiva(10));
        _credenciales.Setup(m => m.ObtenerActivaPorPersonaAsync(10, It.IsAny<CancellationToken>())).ReturnsAsync((CredencialQr?)null);
        _credenciales.Setup(m => m.AgregarAsync(It.IsAny<CredencialQr>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((CredencialQr c, CancellationToken _) => c);
        var segundo = await Servicio().GenerarAsync(10);
        Assert.True(segundo.Exitoso);
        Assert.NotEqual(otroToken, segundo.Dato!.Token);
    }

    // ========== Reemitir ==========
    [Fact]
    public async Task Reemitir_CredencialNoExiste_DevuelveNoEncontrado()
    {
        _credenciales.Setup(m => m.FindByIdAsync(5, It.IsAny<CancellationToken>())).ReturnsAsync((CredencialQr?)null);

        var resultado = await Servicio().ReemitirAsync(5);

        Assert.False(resultado.Exitoso);
        Assert.Equal(CodigosError.NoEncontrado, resultado.CodigoError);
    }

    [Fact]
    public async Task Reemitir_CredencialYaRevocada_DevuelveValidacion()
    {
        _credenciales.Setup(m => m.FindByIdAsync(5, It.IsAny<CancellationToken>()))
            .ReturnsAsync(TestData.CredencialEnEstado("revocada", 5, 9));

        var resultado = await Servicio().ReemitirAsync(5);

        Assert.False(resultado.Exitoso);
        Assert.Equal(CodigosError.Validacion, resultado.CodigoError);
    }

    [Fact]
    public async Task Reemitir_PersonaInactiva_DevuelveValidacion()
    {
        _credenciales.Setup(m => m.FindByIdAsync(5, It.IsAny<CancellationToken>()))
            .ReturnsAsync(TestData.CredencialActiva(5, 9));
        _personas.Setup(m => m.FindByIdAsync(9, It.IsAny<CancellationToken>())).ReturnsAsync(TestData.PersonaInactiva(9));

        var resultado = await Servicio().ReemitirAsync(5);

        Assert.False(resultado.Exitoso);
        Assert.Equal(CodigosError.Validacion, resultado.CodigoError);
    }

    [Fact]
    public async Task Reemitir_Exito_RevocaLaAnteriorYLigaLaNuevaConReemitidoDe()
    {
        var anterior = TestData.CredencialActiva(5, 9, persona: TestData.PersonaActiva(9));
        _credenciales.Setup(m => m.FindByIdAsync(5, It.IsAny<CancellationToken>())).ReturnsAsync(anterior);
        _personas.Setup(m => m.FindByIdAsync(9, It.IsAny<CancellationToken>())).ReturnsAsync(TestData.PersonaActiva(9));
        _credenciales.Setup(m => m.ActualizarAsync(anterior, It.IsAny<CancellationToken>())).ReturnsAsync(anterior);
        _credenciales.Setup(m => m.AgregarAsync(It.IsAny<CredencialQr>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((CredencialQr c, CancellationToken _) => { c.Id = 6; return c; });

        var resultado = await Servicio().ReemitirAsync(5);

        Assert.True(resultado.Exitoso);
        Assert.Equal("revocada", anterior.Estado); // la anterior se revoca
        _credenciales.Verify(m => m.ActualizarAsync(anterior, It.IsAny<CancellationToken>()), Times.Once);
        var nueva = resultado.Dato!;
        Assert.Matches(TokenHex64, nueva.Token);
        Assert.Equal(5, nueva.ReemitidoDe); // trazabilidad
        Assert.Equal("activa", nueva.Estado);
    }

    // ========== Revocar ==========
    [Fact]
    public async Task Revocar_CredencialNoExiste_DevuelveNoEncontrado()
    {
        _credenciales.Setup(m => m.FindByIdAsync(5, It.IsAny<CancellationToken>())).ReturnsAsync((CredencialQr?)null);

        var resultado = await Servicio().RevocarAsync(5, "perdida");

        Assert.False(resultado.Exitoso);
        Assert.Equal(CodigosError.NoEncontrado, resultado.CodigoError);
    }

    [Fact]
    public async Task Revocar_YaRevocada_DevuelveValidacion()
    {
        _credenciales.Setup(m => m.FindByIdAsync(5, It.IsAny<CancellationToken>()))
            .ReturnsAsync(TestData.CredencialEnEstado("revocada", 5, 9));

        var resultado = await Servicio().RevocarAsync(5, "otra vez");

        Assert.False(resultado.Exitoso);
        Assert.Equal(CodigosError.Validacion, resultado.CodigoError);
    }

    [Fact]
    public async Task Revocar_Exito_GuardaEstadoY_Motivo()
    {
        var credencial = TestData.CredencialActiva(5, 9);
        _credenciales.Setup(m => m.FindByIdAsync(5, It.IsAny<CancellationToken>())).ReturnsAsync(credencial);
        _credenciales.Setup(m => m.ActualizarAsync(credencial, It.IsAny<CancellationToken>())).ReturnsAsync(credencial);

        var resultado = await Servicio().RevocarAsync(5, "tarjeta extraviada");

        Assert.True(resultado.Exitoso);
        Assert.Equal("revocada", credencial.Estado);
        Assert.Equal("tarjeta extraviada", credencial.Motivo);
        Assert.Equal("revocada", resultado.Dato!.Estado);
    }

    // ========== Listar ==========
    [Fact]
    public async Task Listar_PorPersonaInexistente_DevuelveNoEncontrado()
    {
        _personas.Setup(m => m.FindByIdAsync(9, It.IsAny<CancellationToken>())).ReturnsAsync((Persona?)null);

        var resultado = await Servicio().ListarAsync(personaId: 9);

        Assert.False(resultado.Exitoso);
        Assert.Equal(CodigosError.NoEncontrado, resultado.CodigoError);
    }

    [Fact]
    public async Task Listar_PorPersona_DevuelveElHistorialDeLaPersona()
    {
        _personas.Setup(m => m.FindByIdAsync(9, It.IsAny<CancellationToken>())).ReturnsAsync(TestData.PersonaActiva(9));
        _credenciales.Setup(m => m.ListarPorPersonaAsync(9, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<CredencialQr>
            {
                TestData.CredencialActiva(5, 9),
                TestData.CredencialEnEstado("revocada", 6, 9),
            });

        var resultado = await Servicio().ListarAsync(personaId: 9);

        Assert.True(resultado.Exitoso);
        Assert.Equal(2, resultado.Dato!.Count);
        Assert.Contains(resultado.Dato, c => c.Estado == "revocada"); // incluye las revocadas (trazabilidad)
    }

    [Fact]
    public async Task Listar_Todas_CuandoNoSeFiltraPorPersona()
    {
        _credenciales.Setup(m => m.ListarAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<CredencialQr> { TestData.CredencialActiva(1, 1) });

        var resultado = await Servicio().ListarAsync(personaId: null);

        Assert.True(resultado.Exitoso);
        Assert.Single(resultado.Dato!);
        _credenciales.Verify(m => m.ListarAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}