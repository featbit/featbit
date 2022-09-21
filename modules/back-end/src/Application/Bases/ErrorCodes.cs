namespace Application.Bases;

public static class ErrorCodes
{
    // general
    public const string InternalServerError = nameof(InternalServerError);
    
    // identity error codes
    public const string IdentityIsRequired = nameof(IdentityIsRequired);
    public const string PasswordIsRequired = nameof(PasswordIsRequired);
    public const string IdentityNotExist = nameof(IdentityNotExist);
    public const string IdentityPasswordMismatch = nameof(IdentityPasswordMismatch);
}