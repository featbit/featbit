using System.Text.Json;
using Api.Application.ControlPlane;
using Application.Caches;
using Domain.Utils;
using Domain.Workspaces;
using Microsoft.Extensions.Logging.Testing;
using Moq;

namespace Api.UnitTests.Application.ControlPlane;

public class LicenseChangeMessageHandlerTests
{
    private readonly Mock<ICacheService> _cache = new();
    private readonly FakeLogger<LicenseChangeMessageHandler> _logger = new();

    private LicenseChangeMessageHandler CreateSut()
        => new(_cache.Object, _logger);

    [Fact]
    public async Task HandleAsync_WhenDeserializesToNull_DoesNothing()
    {
        var sut = CreateSut();

        await sut.HandleAsync("null");

        _cache.Verify(x => x.UpsertLicenseAsync(It.IsAny<Workspace>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_WhenValid_UpsertsLicense()
    {
        var sut = CreateSut();

        var ws = new Workspace();
        var payload = JsonSerializer.Serialize(ws, ReusableJsonSerializerOptions.Web);

        await sut.HandleAsync(payload);

        _cache.Verify(x => x.UpsertLicenseAsync(It.IsAny<Workspace>()), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_WhenJsonInvalid_Rethrows()
    {
        var sut = CreateSut();

        await Assert.ThrowsAnyAsync<Exception>(() => sut.HandleAsync("{not valid json"));
    }
}