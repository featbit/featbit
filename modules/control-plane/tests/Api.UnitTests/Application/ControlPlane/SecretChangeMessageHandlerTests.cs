using System.Text.Json;
using Api.Application.ControlPlane;
using Application.Caches;
using Domain.Environments;
using Domain.Utils;
using Microsoft.Extensions.Logging.Testing;
using Moq;

namespace Api.UnitTests.Application.ControlPlane;

public class SecretChangeMessageHandlerTests
{
    private readonly Mock<ICacheService> _cache = new();
    private readonly FakeLogger<SecretChangeMessageHandler> _logger = new();

    private SecretChangeMessageHandler CreateSut()
        => new(_cache.Object, _logger);
    
    [Fact]
    public async Task HandleAsync_WhenOperationMissing_Throws()
    {
        var sut = CreateSut();

        var payload = """{"secret":{}}""";

        await Assert.ThrowsAsync<InvalidDataException>(() => sut.HandleAsync(payload));
    }

    [Fact]
    public async Task HandleAsync_WhenOperationInvalid_Throws()
    {
        var sut = CreateSut();

        var payload = """{"operation":"NotARealOp","resourceDescriptor":{},"secret":{}}""";

        await Assert.ThrowsAsync<InvalidDataException>(() => sut.HandleAsync(payload));
    }

    [Fact]
    public async Task HandleAsync_WhenAdd_WithValidBody_CallsUpsertSecretAsync()
    {
        var sut = CreateSut();
        
        var resourceDescriptorJson = JsonSerializer.Serialize(new ResourceDescriptor(), ReusableJsonSerializerOptions.Web);
        var secretJson = JsonSerializer.Serialize(new Secret(), ReusableJsonSerializerOptions.Web);

        var payload = $$"""
        {
          "operation": "{{SecretChangeOperations.Add}}",
          "resourceDescriptor": {{resourceDescriptorJson}},
          "secret": {{secretJson}}
        }
        """;

        await sut.HandleAsync(payload);

        _cache.Verify(x => x.UpsertSecretAsync(It.IsAny<ResourceDescriptor>(), It.IsAny<Secret>()), Times.Once);
        _cache.Verify(x => x.DeleteSecretAsync(It.IsAny<Secret>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_WhenDelete_WithNullSecret_DoesNotCallDelete()
    {
        var sut = CreateSut();

        var payload = $$"""
        {
          "operation": "{{SecretChangeOperations.Delete}}",
          "secret": null
        }
        """;

        await sut.HandleAsync(payload);

        _cache.Verify(x => x.DeleteSecretAsync(It.IsAny<Secret>()), Times.Never);
        _cache.Verify(x => x.UpsertSecretAsync(It.IsAny<ResourceDescriptor>(), It.IsAny<Secret>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_WhenDelete_WithValidSecret_CallsDeleteSecretAsync()
    {
        var sut = CreateSut();

        var secretJson = JsonSerializer.Serialize(new Secret(), ReusableJsonSerializerOptions.Web);

        var payload = $$"""
        {
          "operation": "{{SecretChangeOperations.Delete}}",
          "secret": {{secretJson}}
        }
        """;

        await sut.HandleAsync(payload);

        _cache.Verify(x => x.DeleteSecretAsync(It.IsAny<Secret>()), Times.Once);
        _cache.Verify(x => x.UpsertSecretAsync(It.IsAny<ResourceDescriptor>(), It.IsAny<Secret>()), Times.Never);
    }
}