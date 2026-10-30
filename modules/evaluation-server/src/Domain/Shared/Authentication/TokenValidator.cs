namespace Domain.Shared.Authentication;

/// <summary>
/// v1 token validation: structural only (Secret.TryParse). No store lookup, no I/O.
/// Callers must additionally verify the complete secret against IStore.
/// </summary>
public class TokenValidator : ITokenValidator
{
    public Task<TokenValidationResult> ValidateAsync(string? token, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return Task.FromResult(TokenValidationResult.Invalid("Missing or empty token"));
        }

        if (Secret.TryParse(token, out var envId))
        {
            return Task.FromResult(TokenValidationResult.Valid(envId));
        }

        return Task.FromResult(TokenValidationResult.Invalid("Invalid token format"));
    }
}
