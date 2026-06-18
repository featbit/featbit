namespace Domain.Shared.Authentication;

/// <summary>
/// v1 token validation: structural only (Secret.TryParse). No store lookup, no I/O.
/// v2/HMAC validation and store-backed verification are added in a future PR.
/// </summary>
public class TokenValidator : ITokenValidator
{
    public Task<TokenValidationResult> ValidateAsync(string? credential, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(credential))
        {
            return Task.FromResult(TokenValidationResult.Invalid("Missing or empty credential"));
        }

        if (Secret.TryParse(credential, out var envId))
        {
            return Task.FromResult(TokenValidationResult.Valid(envId));
        }

        return Task.FromResult(TokenValidationResult.Invalid("Invalid credential format"));
    }
}
