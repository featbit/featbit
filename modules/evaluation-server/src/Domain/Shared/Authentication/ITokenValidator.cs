namespace Domain.Shared.Authentication;

/// <summary>
/// Shared structural parsing for v1 secrets (Secret.TryParse).
/// Callers must additionally verify the complete secret against IStore.
/// </summary>
public interface ITokenValidator
{
    /// <summary>
    /// Validates the credential (HTTP Authorization header or streaming token secret string).
    /// v1: performs structural check only (Secret.TryParse). No I/O, no store lookup.
    /// </summary>
    Task<TokenValidationResult> ValidateAsync(string? token, CancellationToken cancellationToken = default);
}
