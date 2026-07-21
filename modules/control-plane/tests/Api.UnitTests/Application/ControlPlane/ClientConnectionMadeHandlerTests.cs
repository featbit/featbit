using System.Text.Json;
using Api.Application.ControlPlane;
using Application.Caches;
using Domain.Connections;
using Microsoft.Extensions.Logging.Testing;
using Moq;

namespace Api.UnitTests.Application.ControlPlane;

public class ClientConnectionMadeHandlerTests
{
    private readonly Mock<ICacheService> _cache = new();
    private readonly FakeLogger<ClientConnectionMadeHandler> _logger = new();

    private ClientConnectionMadeHandler CreateSut()
        => new(_cache.Object, _logger);

    [Fact]
    public async Task HandleAsync_WhenJsonInvalid_DoesNotCallCache()
    {
        var sut = CreateSut();

        await sut.HandleAsync("{not valid json");

        _cache.Verify(x => x.UpsertConnectionMadeAsync(It.IsAny<ConnectionMessage>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_WhenConnectionMissingId_DoesNotCallCache()
    {
        var sut = CreateSut();

        var payload = JsonSerializer.Serialize(new ConnectionMessage
        {
            Id = "",
            Secret = "s",
            EnvId = Guid.NewGuid()
        });

        await sut.HandleAsync(payload);

        _cache.Verify(x => x.UpsertConnectionMadeAsync(It.IsAny<ConnectionMessage>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_WhenValid_CallsUpsertConnectionMadeAsync()
    {
        var sut = CreateSut();

        var msg = new ConnectionMessage
        {
            Id = "conn-1",
            Secret = "secret",
            EnvId = Guid.NewGuid()
        };

        var payload = JsonSerializer.Serialize(msg);

        await sut.HandleAsync(payload);

        _cache.Verify(x => x.UpsertConnectionMadeAsync(It.Is<ConnectionMessage>(m =>
            m.Id == msg.Id && m.Secret == msg.Secret && m.EnvId == msg.EnvId)), Times.Once);
    }
}