using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authorization;

namespace Api.Authentication;

public class ApiKeyAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    private const string _apiKeyHeaderName = "X-API-Key";
    private readonly string _apiKey;

    public ApiKeyAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        IConfiguration configuration)
        : base(options, logger, encoder)
    {
        _apiKey = configuration.GetValue<string>("Api:ApiKey") ?? string.Empty;
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var endpoint = Context.GetEndpoint();
        if (endpoint?.Metadata?.GetMetadata<IAllowAnonymous>() != null || string.IsNullOrWhiteSpace(_apiKey) ||
            !Request.Headers.TryGetValue(_apiKeyHeaderName, out var providedApiKeyValues))
            return Task.FromResult(AuthenticateResult.NoResult());

        var providedApiKey = providedApiKeyValues.ToString();
        if (string.IsNullOrWhiteSpace(providedApiKey))
            return Task.FromResult(AuthenticateResult.NoResult());

        if (!_apiKey.Equals(providedApiKey, StringComparison.OrdinalIgnoreCase))
            return Task.FromResult(AuthenticateResult.Fail("Invalid API Key."));

        var claims = new[]
        {
            new Claim(ClaimTypes.Name, "API User"),
        };

        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}