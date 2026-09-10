using Domain.Observability;

namespace FeatBit.Observability.Tests;

public class RedactionTests
{
    private const string Token = "ZWQwMy1jYTQzLTQ1ZDgtOTU2MC1lZDViOTNiZGRjNTY=";

    [Fact]
    public void Token_ForAnySecret_DoesNotContainTheRawValue()
    {
        var redacted = Redaction.Token(Token);

        Assert.DoesNotContain(Token, redacted);
        Assert.StartsWith("tok_", redacted);
    }

    [Fact]
    public void Token_ForTheSameInput_IsStableWithinAProcess()
    {
        // Stability is the whole point of hashing rather than dropping: two log lines produced by
        // the same caller must be joinable.
        Assert.Equal(Redaction.Token(Token), Redaction.Token(Token));
    }

    [Fact]
    public void Token_ForDifferentInputs_ProducesDifferentHashes()
    {
        Assert.NotEqual(Redaction.Token("a"), Redaction.Token("b"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void Token_EmptyInput_ReturnsNonePlaceholder(string? value)
    {
        Assert.Equal(Redaction.None, Redaction.Token(value));
    }

    [Fact]
    public void Hash_ForAnyInput_IsTruncatedToAFixedWidth()
    {
        Assert.Equal("tok_".Length + 16, Redaction.Token(Token).Length);
    }

    #region query strings

    [Fact]
    public void QueryString_WithNoCredentialParameters_KeepsValuesRaw()
    {
        // Everything except a credential is diagnostic data and is deliberately left legible.
        var redacted = Redaction.QueryString("?type=client&version=2");

        Assert.Equal("?type=client&version=2", redacted);
    }

    [Fact]
    public void QueryString_WithATokenParameter_HashesOnlyThatValue()
    {
        var redacted = Redaction.QueryString("?type=client&token=abc123&version=2");

        Assert.Equal($"?type=client&token={Redaction.Token("abc123")}&version=2", redacted);
        Assert.DoesNotContain("abc123", redacted);
    }

    [Theory]
    [InlineData("token")]
    [InlineData("Token")]
    [InlineData("clientToken")]
    [InlineData("access_token")]
    [InlineData("secret")]
    [InlineData("apiKey")]
    [InlineData("authorization")]
    public void QueryString_WithACredentialNamedKey_HashesTheValue(string key)
    {
        var redacted = Redaction.QueryString($"?{key}=leak-me");

        Assert.DoesNotContain("leak-me", redacted);
        Assert.Contains(key, redacted);
    }

    [Fact]
    public void QueryString_ValuelessKey_IsPreserved()
    {
        Assert.Equal("?debug", Redaction.QueryString("?debug"));
    }

    [Fact]
    public void QueryString_WithOrWithoutALeadingQuestionMark_ProducesTheSameResult()
    {
        Assert.Equal(Redaction.QueryString("?a=1"), Redaction.QueryString("a=1"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("?")]
    public void QueryString_EmptyInput_ReturnsNonePlaceholder(string? value)
    {
        Assert.Equal(Redaction.None, Redaction.QueryString(value));
    }

    #endregion

    #region message payloads

    [Fact]
    public void HideCredentials_WithNoCredentialProperties_LeavesThePayloadIntact()
    {
        // The whole point of unredacting payloads: a malformed flag rule must be readable in full.
        const string payload = """{"envId":"e1","key":"my-flag","variations":[{"id":"v1","value":"on"}]}""";

        Assert.Equal(payload, Redaction.HideCredentials(payload));
    }

    [Fact]
    public void HideCredentials_WithAConnectionMessage_HashesTheSecret()
    {
        // ConnectionMessage carries the client's SDK secret. This is the back door that would
        // otherwise leak every credential the rest of this class protects.
        const string secret = "gpnOV3wI3kKAO9q9viC0wQWdKZrVAf2U6gAnxl4lSH3w";
        var payload = $$"""{"id":"c1","envId":"e1","secret":"{{secret}}","heartbeatId":"h1"}""";

        var hidden = Redaction.HideCredentials(payload);

        Assert.DoesNotContain(secret, hidden);
        Assert.Contains(Redaction.Token(secret), hidden);
        // Everything else survives.
        Assert.Contains("\"id\":\"c1\"", hidden);
        Assert.Contains("\"envId\":\"e1\"", hidden);
        Assert.Contains("\"heartbeatId\":\"h1\"", hidden);
    }

    [Theory]
    [InlineData("secret")]
    [InlineData("Secret")]
    [InlineData("token")]
    [InlineData("accessToken")]
    [InlineData("api_key")]
    [InlineData("authorization")]
    public void HideCredentials_WithACredentialNamedProperty_HashesTheValue(string property)
    {
        var payload = $$"""{"{{property}}":"leak-me"}""";

        Assert.DoesNotContain("leak-me", Redaction.HideCredentials(payload));
    }

    [Fact]
    public void HideCredentials_WithWhitespaceAroundTheColon_StillHashesTheValue()
    {
        var hidden = Redaction.HideCredentials("""{ "secret" : "leak-me" }""");

        Assert.DoesNotContain("leak-me", hidden);
    }

    [Fact]
    public void HideCredentials_WithMultipleCredentials_HashesEveryOccurrence()
    {
        var hidden = Redaction.HideCredentials("""{"a":{"secret":"one"},"b":{"token":"two"}}""");

        Assert.DoesNotContain("one", hidden);
        Assert.DoesNotContain("two", hidden);
    }

    [Fact]
    public void HideCredentials_NonJsonPayload_IsUnchanged()
    {
        // The Postgres consumer's notification payload is a bare message id.
        Assert.Equal("128773", Redaction.HideCredentials("128773"));
    }

    [Fact]
    public void HideCredentials_ForTheSamePayload_IsStableAcrossLogLines()
    {
        const string payload = """{"secret":"abc"}""";

        Assert.Equal(Redaction.HideCredentials(payload), Redaction.HideCredentials(payload));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void HideCredentials_EmptyInput_ReturnsNonePlaceholder(string? value)
    {
        Assert.Equal(Redaction.None, Redaction.HideCredentials(value));
    }

    #endregion

    #region salt configuration

    /// <summary>
    /// The salt used to be a <c>static readonly</c> field initializer, which runs at type load —
    /// potentially before the composition root. Configuring it then would have silently done
    /// nothing, leaving a random per-process salt while the configuration said otherwise. These
    /// tests pin the replacement contract: blank input is ignored, and a conflicting reconfiguration
    /// after first use fails loudly instead of being dropped.
    /// </summary>
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void ConfigureSalt_WithNoValue_IsIgnored(string? salt)
    {
        var before = Redaction.Token("connection-secret");

        Redaction.ConfigureSalt(salt);

        Assert.Equal(before, Redaction.Token("connection-secret"));
    }

    [Fact]
    public void ConfigureSalt_AfterTheSaltIsInUse_ThrowsRatherThanSilentlyNoOp()
    {
        // Force the salt to materialize, exactly as the first redacted log line would.
        var before = Redaction.Token("connection-secret");

        var error = Assert.Throws<InvalidOperationException>(
            () => Redaction.ConfigureSalt($"conflicting-salt-{Guid.NewGuid()}"));

        Assert.Contains(nameof(Redaction.ConfigureSalt), error.Message);

        // A rejected reconfiguration must not corrupt the salt already in use.
        Assert.Equal(before, Redaction.Token("connection-secret"));
    }

    #endregion
}
