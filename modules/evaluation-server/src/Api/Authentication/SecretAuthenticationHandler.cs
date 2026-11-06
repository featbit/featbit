using System.Security.Claims;
using System.Text.Encodings.Web;
using Domain.Secrets;
using Domain.Shared;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Api.Authentication;

public class SecretAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IStore store,
    TrackSecretCache trackSecretCache,
    AuthenticationUnavailableReporter unavailableReporter)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    private bool _validationUnavailable;

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var secretString = Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(secretString))
        {
            return AuthenticateResult.NoResult();
        }

        if (!Secret.TryParse(secretString, out var envId))
        {
            return AuthenticateResult.Fail("Invalid secret format");
        }

        Secret? secret;
        try
        {
            secret = Context.GetEndpoint()?.Metadata.GetMetadata<CacheSecretAuthenticationAttribute>() is not null
                ? await trackSecretCache.GetAsync(secretString, envId)
                : await store.GetSecretAsync(secretString);
        }
        catch (Exception)
        {
            _validationUnavailable = true;
            unavailableReporter.Report(Scheme.Name, Request.Path.Value, Context.TraceIdentifier);

            return AuthenticateResult.Fail("Secret authentication unavailable");
        }

        if (secret is null || secret.EnvId != envId)
        {
            return AuthenticateResult.Fail("Invalid environment secret");
        }

        var claims = new[]
        {
            new Claim(SecretClaims.EnvId, secret.EnvId.ToString()),
            new Claim(SecretClaims.SecretType, secret.Type)
        };
        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);

        return AuthenticateResult.Success(ticket);
    }

    protected override Task HandleChallengeAsync(AuthenticationProperties properties)
    {
        if (!_validationUnavailable)
        {
            return base.HandleChallengeAsync(properties);
        }

        Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        return Task.CompletedTask;
    }
}
