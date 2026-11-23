using System.Text.Json;
using Application.Bases.Exceptions;
using Application.ReleaseMetricSourceConnections;
using Application.Services;
using Domain.Environments;
using Domain.ReleaseMetricSourceConnections;
using FluentValidation;
using Microsoft.AspNetCore.Http;

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
        var environments = new Mock<IEnvironmentService>(MockBehavior.Strict);
        environments.Setup(x => x.GetResourceDescriptorAsync(_scope.Environment.Id)).ReturnsAsync(_scope);
        var accessGuard = new ReleaseMetricSourceConnectionAccessGuard(
            environments.Object, Mock.Of<IOrganizationService>(), new HttpContextAccessor());
        _handler = new UpdateReleaseMetricSourceConnectionHandler(
            _service.Object, _protector.Object, new ReleaseMetricSourceConnectionBaseValidator(), accessGuard);
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
    public async Task Handle_NewOriginWithReplacement_ProtectsNewPasswordWithoutDecryptingOldCredential()
    {
        ExpectProtectedPassword("new-password", "replacement-ciphertext");

        await UpdateAsync(new()
        {
            ProviderConfig = JsonSerializer.SerializeToElement(new { endpoint = "https://other.example.com" }),
            SecretUpdate = JsonSerializer.SerializeToElement(new { operation = "replace", password = "new-password" })
        }, "replacement-ciphertext");
    }

    [Theory]
    [InlineData("https://other.example.com", false)]
    [InlineData("https://other.example.com", true)]
    [InlineData("http://metrics.example.com", false)]
    [InlineData("https://metrics.example.com:8443", true)]
    public async Task Handle_NewOriginCannotReuseTheSavedPassword(string endpoint, bool explicitKeep)
    {
        var originalSettings = _connection.ConnectionConfiguration;
        var request = new UpdateReleaseMetricSourceConnection
        {
            Id = _connection.Id,
            OrgId = _scope.Organization.Id,
            EnvId = _connection.EnvId,
            ProviderConfig = JsonSerializer.SerializeToElement(new { endpoint })
        };
        if (explicitKeep)
        {
            request.SecretUpdate = JsonSerializer.SerializeToElement(new { operation = "keep" });
        }

        var error = await Assert.ThrowsAsync<ValidationException>(() => _handler.Handle(request, CancellationToken.None));

        Assert.Contains(error.Errors, failure => failure.ErrorCode == "secretUpdate_is_invalid");
        Assert.Same(originalSettings, _connection.ConnectionConfiguration);
        Assert.Equal("original-ciphertext", _connection.ProtectedCredential);
        _protector.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Handle_NewPathOnTheSameOrigin_ReusesTheSavedPassword()
    {
        var credential = JsonSerializer.SerializeToElement(new { password = "old-password" });
        _protector.Setup(x => x.Unprotect(_scope, _connection)).Returns(credential);
        ExpectProtectedPassword("old-password", "rebound-ciphertext");

        var result = await UpdateAsync(new()
        {
            ProviderConfig = JsonSerializer.SerializeToElement(new { endpoint = "https://METRICS.example.com:443/team-a" })
        }, "rebound-ciphertext");

        Assert.Equal("https://METRICS.example.com:443/team-a", result.ProviderConfig.GetProperty("endpoint").GetString());
        _protector.Verify(x => x.Unprotect(_scope, _connection), Times.Once);
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
            Id = _connection.Id, OrgId = _scope.Organization.Id, EnvId = _connection.EnvId, Name = "Renamed"
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
        request.OrgId = _scope.Organization.Id;
        request.EnvId = _connection.EnvId;
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
