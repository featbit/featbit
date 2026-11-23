using System.Text.Json;
using Application.Bases.Exceptions;
using Application.ReleaseMetricSourceConnections;
using Application.Services;
using Domain.Environments;
using Domain.ReleaseMetricSourceConnections;

namespace Application.UnitTests.Handlers;

public class UpdateReleaseMetricSourceConnectionHandlerTests
{
    private readonly ResourceDescriptor _scope = new()
    {
        Organization = new IdNameKeyProps { Id = Guid.NewGuid() },
        Project = new IdNameKeyProps { Id = Guid.NewGuid() },
        Environment = new IdNameKeyProps { Id = Guid.NewGuid() }
    };

    private readonly Mock<IReleaseMetricSourceConnectionService> _service = new(MockBehavior.Strict);
    private readonly Mock<IReleaseMetricSourceCredentialProtector> _protector = new(MockBehavior.Strict);
    private readonly ReleaseMetricSourceConnection _connection;
    private readonly UpdateReleaseMetricSourceConnectionHandler _handler;

    public UpdateReleaseMetricSourceConnectionHandlerTests()
    {
        var settings = new ReleaseMetricSourceConnectionSettings(
            JsonSerializer.SerializeToElement(new { endpoint = "https://metrics.example.com" }),
            JsonSerializer.SerializeToElement(new { type = "basic", username = "reader" }));
        _connection = new ReleaseMetricSourceConnection(_scope.Environment.Id, "Metrics", "prometheus-compatible", settings)
        {
            ProtectedCredential = "original-ciphertext"
        };
        _service.Setup(x => x.FindAsync(_connection.EnvId, _connection.Id, CancellationToken.None))
            .ReturnsAsync(_connection);
        _handler = new UpdateReleaseMetricSourceConnectionHandler(
            _service.Object, _protector.Object, new ReleaseMetricSourceConnectionBaseValidator());
    }

    [Fact]
    public async Task Handle_RenameWithoutSecretUpdate_PreservesStoredCredential()
    {
        var result = await UpdateAsync(new() { Name = "Renamed" }, "original-ciphertext");

        Assert.Equal("Renamed", result.Name);
        Assert.Equal("configured", result.SecretState);
        _protector.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Handle_Replace_ProtectsNewPasswordWithoutDecryptingOldCredential()
    {
        ExpectProtectedPassword("new-password", "replacement-ciphertext");

        await UpdateAsync(new()
        {
            SecretUpdate = JsonSerializer.SerializeToElement(new { operation = "replace", password = "new-password" })
        }, "replacement-ciphertext");
    }

    [Fact]
    public async Task Handle_ExplicitKeep_ReprotectsTheExistingPassword()
    {
        var credential = JsonSerializer.SerializeToElement(new { password = "old-password" });
        _protector.Setup(x => x.Unprotect(_scope, _connection)).Returns(credential);
        ExpectProtectedPassword("old-password", "rewrapped-ciphertext");

        await UpdateAsync(new() { SecretUpdate = JsonSerializer.SerializeToElement(new { operation = "keep" }) },
            "rewrapped-ciphertext");

        _protector.Verify(x => x.Unprotect(_scope, _connection), Times.Once);
    }

    [Fact]
    public async Task Handle_LegacyBasicConnection_CanBeRenamedAndConfiguredForTheFirstTime()
    {
        _connection.ConnectionConfiguration = _connection.ConnectionConfiguration with
        {
            Authentication = JsonSerializer.SerializeToElement(new { type = "basic" })
        };
        _connection.ProtectedCredential = null;

        var renamed = await UpdateAsync(new() { Name = "Legacy metrics" }, expectedCiphertext: null);
        Assert.Equal("Legacy metrics", renamed.Name);
        Assert.Equal("not_configured", renamed.SecretState);

        ExpectProtectedPassword("first-password", "first-ciphertext");
        var configured = await UpdateAsync(new()
        {
            Authentication = JsonSerializer.SerializeToElement(new { type = "basic", username = "first-reader" }),
            SecretUpdate = JsonSerializer.SerializeToElement(new { operation = "replace", password = "first-password" })
        }, "first-ciphertext");

        Assert.Equal("configured", configured.SecretState);
        Assert.Equal("first-reader", configured.Authentication.GetProperty("username").GetString());
    }

    [Theory]
    [InlineData(true, typeof(ConflictException))]
    [InlineData(false, typeof(EntityNotFoundException))]
    public async Task Handle_ConcurrentUpdateFails_ReportsWhetherConnectionStillExists(
        bool connectionStillExists, Type expectedException)
    {
        var request = new UpdateReleaseMetricSourceConnection
        {
            Id = _connection.Id, EnvId = _connection.EnvId, Scope = _scope, Name = "Renamed"
        };
        var previousUpdatedAt = _connection.UpdatedAt;
        _service.SetupSequence(x => x.FindAsync(request.EnvId, request.Id, CancellationToken.None))
            .ReturnsAsync(_connection)
            .ReturnsAsync(connectionStillExists ? _connection : null);
        _service.Setup(x => x.UpdateAsync(_connection, previousUpdatedAt, CancellationToken.None))
            .ReturnsAsync(false);

        await Assert.ThrowsAsync(expectedException, () => _handler.Handle(request, CancellationToken.None));

        _service.Verify(x => x.UpdateAsync(_connection, previousUpdatedAt, CancellationToken.None), Times.Once);
        _service.Verify(x => x.FindAsync(request.EnvId, request.Id, CancellationToken.None), Times.Exactly(2));
    }

    private void ExpectProtectedPassword(string password, string ciphertext)
    {
        var expected = JsonSerializer.SerializeToElement(new { password });
        _protector.Setup(x => x.Protect(_scope, _connection, It.Is<JsonElement>(c => JsonElement.DeepEquals(c, expected))))
            .Returns(ciphertext);
    }

    private async Task<ReleaseMetricSourceConnectionVm> UpdateAsync(
        UpdateReleaseMetricSourceConnection request, string? expectedCiphertext)
    {
        request.Id = _connection.Id;
        request.EnvId = _connection.EnvId;
        request.Scope = _scope;
        var previousUpdatedAt = _connection.UpdatedAt;
        _service.Setup(x => x.UpdateAsync(_connection, previousUpdatedAt, CancellationToken.None))
            .Callback<ReleaseMetricSourceConnection, DateTime, CancellationToken>(
                (saved, _, _) => Assert.Equal(expectedCiphertext, saved.ProtectedCredential))
            .ReturnsAsync(true);

        var result = await _handler.Handle(request, CancellationToken.None);

        _service.Verify(x => x.UpdateAsync(_connection, previousUpdatedAt, CancellationToken.None), Times.Once);
        return result;
    }
}
