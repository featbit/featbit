using Domain.Shared;

namespace Streaming.Connections;

/// <summary>
/// Validation result with three states:
/// - Valid: Credentials verified, secrets retrieved from store
/// - Invalid: Credentials malformed, expired, or failed to verify (client error, should not retry with same credentials)
/// - Unavailable: Store lookup failed (server issue, transient, client should retry)
/// </summary>
public sealed class ValidationResult
{
    public ValidationResultStatus Status { get; set; }

    public string Reason { get; set; } = string.Empty;

    public Secret[] Secrets { get; set; } = [];

    public static ValidationResult Ok(Secret[] secrets)
    {
        return new ValidationResult
        {
            Status = ValidationResultStatus.Valid,
            Secrets = secrets,
            Reason = string.Empty
        };
    }

    public static ValidationResult Failed(string reason)
    {
        return new ValidationResult
        {
            Status = ValidationResultStatus.Invalid,
            Secrets = [],
            Reason = reason
        };
    }

    public static ValidationResult Unavailable(string reason)
    {
        return new ValidationResult
        {
            Status = ValidationResultStatus.Unavailable,
            Secrets = [],
            Reason = reason
        };
    }
}

public enum ValidationResultStatus
{
    Valid,
    Invalid,
    Unavailable
}
