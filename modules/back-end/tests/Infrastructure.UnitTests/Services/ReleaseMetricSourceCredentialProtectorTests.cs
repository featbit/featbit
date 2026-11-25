using System.Security.Cryptography;
using System.Text.Json;
using Application.Bases;
using Application.Bases.Exceptions;
using Domain.Environments;
using Domain.ReleaseMetricSourceConnections;
using Infrastructure.Services;

namespace Infrastructure.UnitTests.Services;

public class ReleaseMetricSourceCredentialProtectorTests
{
    private const string Token = "test-bearer-token";
    private readonly byte[] _v1 = RandomNumberGenerator.GetBytes(32);
    private readonly JsonElement _credential = JsonSerializer.SerializeToElement(new { token = Token });
    private readonly ResourceDescriptor _scope = new()
    {
        Organization = new IdNameKeyProps { Id = Guid.NewGuid() },
        Project = new IdNameKeyProps { Id = Guid.NewGuid() },
        Environment = new IdNameKeyProps { Id = Guid.NewGuid() }
    };

    [Fact]
    public void Protect_SameCredentialTwice_ProducesDifferentCiphertextsThatBothDecrypt()
    {
        var protector = CreateProtector("v1", new { v1 = _v1 });
        var connection = CreateConnection();

        var first = protector.Protect(_scope, connection, _credential);
        var second = protector.Protect(_scope, connection, _credential);

        Assert.NotEqual(first, second);
        foreach (var ciphertext in new[] { first, second })
        {
            connection.ProtectedCredential = ciphertext;
            Assert.Equal(Token, protector.Unprotect(_scope, connection)?.GetProperty("token").GetString());
        }
    }

    [Fact]
    public void Unprotect_CiphertextCopiedToAnotherConnection_RejectsIt()
    {
        var protector = CreateProtector("v1", new { v1 = _v1 });
        var source = CreateConnection();
        var other = CreateConnection();
        other.ProtectedCredential = protector.Protect(_scope, source, _credential);

        var error = Assert.Throws<BusinessException>(() => protector.Unprotect(_scope, other));

        Assert.Equal(ErrorCodes.CredentialUnavailable, error.Message);
    }

    [Fact]
    public void Unprotect_EndpointChanged_RejectsOriginalCiphertext()
    {
        var protector = CreateProtector("v1", new { v1 = _v1 });
        var connection = CreateConnection();
        connection.ProtectedCredential = protector.Protect(_scope, connection, _credential);
        connection.ConnectionConfiguration = connection.ConnectionConfiguration with
        {
            ProviderConfig = JsonSerializer.SerializeToElement(new { endpoint = "https://other.example.com" })
        };

        var error = Assert.Throws<BusinessException>(() => protector.Unprotect(_scope, connection));

        Assert.Equal(ErrorCodes.CredentialUnavailable, error.Message);
    }

    [Fact]
    public void Unprotect_ModifiedAuthenticationTag_RejectsIt()
    {
        var protector = CreateProtector("v1", new { v1 = _v1 });
        var connection = CreateConnection();
        var parts = protector.Protect(_scope, connection, _credential).Split('.');
        var tag = Convert.FromBase64String(parts[^1]);
        tag[0] ^= 1;
        parts[^1] = Convert.ToBase64String(tag);
        connection.ProtectedCredential = string.Join('.', parts);

        var error = Assert.Throws<BusinessException>(() => protector.Unprotect(_scope, connection));

        Assert.Equal(ErrorCodes.CredentialUnavailable, error.Message);
    }

    [Fact]
    public void RotateKey_ReprotectedCredentialRemainsReadableAfterOldKeyIsRetired()
    {
        var connection = CreateConnection();
        var original = CreateProtector("v1", new { v1 = _v1 });
        var oldCiphertext = original.Protect(_scope, connection, _credential);
        connection.ProtectedCredential = oldCiphertext;

        var v2 = RandomNumberGenerator.GetBytes(32);
        var overlap = CreateProtector("v2", new { v1 = _v1, v2 });
        var credential = Assert.IsType<JsonElement>(overlap.Unprotect(_scope, connection));
        Assert.Equal(Token, credential.GetProperty("token").GetString());
        connection.ProtectedCredential = overlap.Protect(_scope, connection, credential);

        var retired = CreateProtector("v2", new { v2 });
        Assert.Equal(Token, retired.Unprotect(_scope, connection)?.GetProperty("token").GetString());
        connection.ProtectedCredential = oldCiphertext;
        var error = Assert.Throws<BusinessException>(() => retired.Unprotect(_scope, connection));
        Assert.Equal(ErrorCodes.CredentialUnavailable, error.Message);
    }

    private ReleaseMetricSourceConnection CreateConnection() => new(
        _scope.Environment.Id, "Prometheus", "prometheus-compatible",
        new ReleaseMetricSourceConnectionSettings(
            JsonSerializer.SerializeToElement(new { endpoint = "https://prometheus.example.com" }),
            JsonSerializer.SerializeToElement(new { type = "bearer_token" })));

    private static ReleaseMetricSourceCredentialProtector CreateProtector(string active, object keys) =>
        new(JsonSerializer.Serialize(new { active, keys }));
}
