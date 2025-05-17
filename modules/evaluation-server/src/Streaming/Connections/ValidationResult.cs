using Domain.Shared;

namespace Streaming.Connections;

public sealed class ValidationResult
{
    public bool IsValid { get; set; }

    public string Reason { get; set; } = string.Empty;

    public Secret[] Secrets { get; set; } = [];

    public static ValidationResult Ok(Secret[] secrets)
    {
        return new ValidationResult
        {
            IsValid = true,
            Secrets = secrets,
            Reason = string.Empty
        };
    }

    public static ValidationResult Failed(string reason)
    {
        return new ValidationResult
        {
            IsValid = false,
            Secrets = [],
            Reason = reason
        };
    }
}