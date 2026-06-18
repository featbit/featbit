namespace Domain.Shared.Authentication;

public sealed class TokenValidationResult
{
    public TokenValidationStatus Status { get; }
    public Guid EnvId { get; }
    public string Reason { get; }

    private TokenValidationResult(TokenValidationStatus status, Guid envId, string reason)
    {
        Status = status;
        EnvId = envId;
        Reason = reason;
    }

    public static TokenValidationResult Valid(Guid envId) =>
        new(TokenValidationStatus.Valid, envId, string.Empty);

    public static TokenValidationResult Invalid(string reason) =>
        new(TokenValidationStatus.Invalid, Guid.Empty, reason);
}
