using Application.Bases;
using Application.RelayProxies;
using Domain.RelayProxies;

namespace Application.UnitTests.Validators;

public class RelayProxyValidatorTests
{
    private static Agent ValidAgent() => new() { Id = "a1", Name = "agent", Host = "http://x" };

    [Fact]
    public void RpAgentBase_EmptyHost_HasFailure()
    {
        var result = new RpAgentBaseValidator().Validate(new RpAgentBase { Host = "" });

        Assert.False(result.IsValid);
    }

    [Fact]
    public void RpAgentBase_HostWithoutScheme_HasFailure()
    {
        var result = new RpAgentBaseValidator().Validate(new RpAgentBase { Host = "example.com" });

        Assert.False(result.IsValid);
    }

    [Theory]
    [InlineData("http://x")]
    [InlineData("https://example.com:8080/path")]
    public void RpAgentBase_HttpOrHttpsHost_IsValid(string host)
    {
        var result = new RpAgentBaseValidator().Validate(new RpAgentBase { Host = host });

        Assert.True(result.IsValid);
    }

    [Fact]
    public void SyncToAgent_BadHost_ReportsError()
    {
        var result = new SyncToAgentValidator().Validate(new SyncToAgent { Host = "ftp://x" });

        Assert.False(result.IsValid);
    }

    [Fact]
    public void CheckAgentAvailability_GoodHost_NoErrors()
    {
        var result = new CheckAgentAvailabilityValidator().Validate(new CheckAgentAvailability { Host = "http://x" });

        Assert.True(result.IsValid);
    }

    [Fact]
    public void RelayProxyBaseValidator_AllValid_NoErrors()
    {
        var proxy = new RelayProxyBase
        {
            Name = "rp",
            IsAllEnvs = true,
            Scopes = Array.Empty<string>(),
            Agents = new[] { ValidAgent() }
        };

        var result = new RelayProxyBaseValidator().Validate(proxy);

        Assert.True(result.IsValid);
    }

    [Fact]
    public void RelayProxyBaseValidator_EmptyName_NameRequiredError()
    {
        var proxy = new RelayProxyBase
        {
            Name = "",
            IsAllEnvs = true,
            Agents = new[] { ValidAgent() }
        };

        var result = new RelayProxyBaseValidator().Validate(proxy);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required("name"));
    }

    [Fact]
    public void RelayProxyBaseValidator_NotAllEnvsAndEmptyScopes_ScopesInvalidError()
    {
        var proxy = new RelayProxyBase
        {
            Name = "rp",
            IsAllEnvs = false,
            Scopes = Array.Empty<string>(),
            Agents = new[] { ValidAgent() }
        };

        var result = new RelayProxyBaseValidator().Validate(proxy);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("scopes"));
    }

    [Fact]
    public void RelayProxyBaseValidator_NonGuidScope_ScopesInvalidError()
    {
        var proxy = new RelayProxyBase
        {
            Name = "rp",
            IsAllEnvs = false,
            Scopes = new[] { "not-a-guid" },
            Agents = new[] { ValidAgent() }
        };

        var result = new RelayProxyBaseValidator().Validate(proxy);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("scopes"));
    }

    [Fact]
    public void RelayProxyBaseValidator_InvalidAgent_AgentsInvalidError()
    {
        var proxy = new RelayProxyBase
        {
            Name = "rp",
            IsAllEnvs = true,
            Agents = new[] { new Agent { Id = "", Name = "", Host = "" } }
        };

        var result = new RelayProxyBaseValidator().Validate(proxy);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("agents"));
    }

    [Fact]
    public void CreateRelayProxy_DelegatesToBaseValidator()
    {
        var request = new CreateRelayProxy
        {
            Name = "",
            IsAllEnvs = true,
            Agents = new[] { ValidAgent() }
        };

        var result = new CreateRelayProxyValidator().Validate(request);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required("name"));
    }

    [Fact]
    public void UpdateRelayProxy_DelegatesToBaseValidator()
    {
        var request = new UpdateRelayProxy
        {
            Name = "rp",
            IsAllEnvs = false,
            Scopes = new[] { "not-a-guid" },
            Agents = new[] { ValidAgent() }
        };

        var result = new UpdateRelayProxyValidator().Validate(request);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("scopes"));
    }
}
