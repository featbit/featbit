namespace Application.Bases;

public static class ErrorCodes
{
    // general
    public const string InternalServerError = nameof(InternalServerError);
    public const string Unauthorized = nameof(Unauthorized);
    
    // application
    public const string ResourceNotFound = nameof(ResourceNotFound);
    
    // identity error codes
    public const string EmailIsRequired = nameof(EmailIsRequired);
    public const string EmailIsInvalid = nameof(EmailIsInvalid);
    public const string EmailNotExist = nameof(EmailNotExist);
    public const string PasswordIsRequired = nameof(PasswordIsRequired);
    public const string PasswordMismatch = nameof(PasswordMismatch);
    
    // common
    public const string NameIsRequired = nameof(NameIsRequired);
    
    // onboarding
    public const string OrganizationNameRequired = nameof(OrganizationNameRequired);
    public const string ProjectNameRequired = nameof(ProjectNameRequired);
    public const string EnvironmentsRequired = nameof(EnvironmentsRequired);
}