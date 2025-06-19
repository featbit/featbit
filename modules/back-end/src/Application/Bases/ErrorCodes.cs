namespace Application.Bases;

public static class ErrorCodes
{
    // general
    public const string InternalServerError = nameof(InternalServerError);
    public const string Unauthorized = nameof(Unauthorized);
    public const string Forbidden = nameof(Forbidden);

    // application
    public const string ResourceNotFound = nameof(ResourceNotFound);
    public const string InvalidJson = nameof(InvalidJson);
    public const string NameHasBeenUsed = nameof(NameHasBeenUsed);
    public const string KeyHasBeenUsed = nameof(KeyHasBeenUsed);
    public const string InconsistentData = nameof(InconsistentData);

    // identity error codes
    public const string EmailPasswordMismatch = nameof(EmailPasswordMismatch);
    public const string ExternalUserCannotChangePassword = nameof(ExternalUserCannotChangePassword);
    public const string PasswordTooShort = nameof(PasswordTooShort);

    // policy
    public const string CannotModifySysManagedPolicy = nameof(CannotModifySysManagedPolicy);

    // end user
    public const string CannotModifyBuiltInProperty = nameof(CannotModifyBuiltInProperty);

    // segment
    public const string CannotDeleteUnArchivedSegment = nameof(CannotDeleteUnArchivedSegment);
    public const string SegmentIsBeingUsed = nameof(SegmentIsBeingUsed);

    // feature flag
    public const string CannotDeleteUnArchivedFeatureFlag = nameof(CannotDeleteUnArchivedFeatureFlag);

    // triggers
    public const string InvalidTriggerToken = nameof(InvalidTriggerToken);
    public const string TriggerTokenNotMatchOrHasExpired = nameof(TriggerTokenNotMatchOrHasExpired);

    // experiment metrics
    public const string MetricIsBeingUsedByExperiment = nameof(MetricIsBeingUsedByExperiment);

    public static string Required(string parameterName) => $"{parameterName}_is_required";
    public static string Invalid(string parameterName) => $"{parameterName}_is_invalid";
}