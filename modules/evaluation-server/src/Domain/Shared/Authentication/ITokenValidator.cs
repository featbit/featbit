namespace Domain.Shared.Authentication;

/// <summary>
/// Single source of truth for token validation. v1 implementation is structural-only (Secret.TryParse);
/// v2/HMAC validation with store lookup is added in a future PR.
/// </summary>
public interface ITokenValidator
{
    /// <summary>
    /// Validates the credential (HTTP Authorization header or streaming token secret string).
    /// v1: performs structural check only (Secret.TryParse). No I/O, no store lookup.
    /// </summary>
    Task<TokenValidationResult> ValidateAsync(string? token, CancellationToken cancellationToken = default);
}
