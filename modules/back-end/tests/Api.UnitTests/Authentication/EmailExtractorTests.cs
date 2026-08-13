using System.Text.Json;
using Api.Authentication.OAuth;

namespace Api.UnitTests.Authentication;

public class EmailExtractorTests
{
    [Fact]
    public void Extract_Google_ReturnsEmailField()
    {
        var json = JsonDocument.Parse("""{ "email": "alice@example.com", "name": "Alice" }""");

        var email = EmailExtractor.Extract(OAuthProviders.Google, json);

        Assert.Equal("alice@example.com", email);
    }

    [Fact]
    public void Extract_GitHub_ReturnsPrimaryEmail()
    {
        // GitHub /user/emails returns an array with a primary flag
        var json = JsonDocument.Parse("""
            [
                { "email": "secondary@example.com", "primary": false, "verified": true },
                { "email": "primary@example.com",   "primary": true,  "verified": true }
            ]
        """);

        var email = EmailExtractor.Extract(OAuthProviders.GitHub, json);

        Assert.Equal("primary@example.com", email);
    }

    [Fact]
    public void Extract_UnknownProvider_ReturnsEmpty()
    {
        var json = JsonDocument.Parse("""{ "email": "alice@example.com" }""");

        var email = EmailExtractor.Extract("unsupported", json);

        Assert.Equal(string.Empty, email);
    }

    [Fact]
    public void Extract_GitHub_WithNoPrimary_ReturnsEmpty()
    {
        // When no primary email is flagged, extractor should return empty.
        var json = JsonDocument.Parse("""
            [
                { "email": "a@example.com", "primary": false },
                { "email": "b@example.com", "primary": false }
            ]
        """);

        var email = EmailExtractor.Extract(OAuthProviders.GitHub, json);

        Assert.Equal(string.Empty, email);
    }
}
