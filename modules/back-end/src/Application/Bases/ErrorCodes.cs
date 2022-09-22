namespace Application.Bases;

public static class ErrorCodes
{
    // general
    public const string InternalServerError = nameof(InternalServerError);
    
    // identity error codes
    public const string EmailIsRequired = nameof(EmailIsRequired);
    public const string EmailIsInvalid = nameof(EmailIsInvalid);
    public const string EmailNotExist = nameof(EmailNotExist);
    public const string PasswordIsRequired = nameof(PasswordIsRequired);
    public const string PasswordMismatch = nameof(PasswordMismatch);
}