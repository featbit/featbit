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
    public const string EntityExistsAlready = nameof(EntityExistsAlready);

    // identity error codes
    public const string MethodIsRequired = nameof(MethodIsRequired);
    public const string MethodIsInvalid = nameof(MethodIsInvalid);
    public const string EmailIsRequired = nameof(EmailIsRequired);
    public const string EmailIsInvalid = nameof(EmailIsInvalid);
    public const string EmailNotExist = nameof(EmailNotExist);
    public const string PasswordIsRequired = nameof(PasswordIsRequired);
    public const string PasswordMismatch = nameof(PasswordMismatch);
    public const string PasswordTooShort = nameof(PasswordTooShort);

    // common
    public const string NameIsRequired = nameof(NameIsRequired);
    public const string KeyIsRequired = nameof(KeyIsRequired);

    // onboarding
    public const string OrganizationNameRequired = nameof(OrganizationNameRequired);
    public const string ProjectNameRequired = nameof(ProjectNameRequired);
    public const string EnvironmentsRequired = nameof(EnvironmentsRequired);

    // policy
    public const string CannotModifySysManagedPolicy = nameof(CannotModifySysManagedPolicy);

    // resource
    public const string TypeIsRequired = nameof(TypeIsRequired);

    // end user
    public const string KeyIdIsRequired = nameof(KeyIdIsRequired);
    public const string CannotModifyBuiltInProperty = nameof(CannotModifyBuiltInProperty);

    // segment
    public const string SegmentCannotReferenceSegmentCondition = nameof(SegmentCannotReferenceSegmentCondition);
    public const string CannotDeleteUnArchivedSegment = nameof(CannotDeleteUnArchivedSegment);

    // feature flag
    public const string CannotDeleteUnArchivedFeatureFlag = nameof(CannotDeleteUnArchivedFeatureFlag);
    public const string InvalidVariationType = nameof(InvalidVariationType);
    public const string FeatureFlagIdIsRequired = nameof(FeatureFlagIdIsRequired);
    public const string FeatureFlagVariationIdIsRequired = nameof(FeatureFlagVariationIdIsRequired);
    public const string InvalidIntervalType = nameof(InvalidIntervalType);
    public const string InvalidFrom = nameof(InvalidFrom);
    public const string InvalidTo = nameof(InvalidTo);
    public const string InvalidFlagKeyFormat = nameof(InvalidFlagKeyFormat);
    public const string InvalidSecretType = nameof(InvalidSecretType);

    // triggers
    public const string InvalidTriggerType = nameof(InvalidTriggerType);
    public const string InvalidTriggerAction = nameof(InvalidTriggerAction);
    public const string InvalidTriggerToken = nameof(InvalidTriggerToken);
    public const string TriggerTokenNotMatchOrHasExpired = nameof(TriggerTokenNotMatchOrHasExpired);

    // experiment metrics
    public const string MaintainerIsRequired = nameof(MaintainerIsRequired);
    public const string EventTypeIsRequired = nameof(EventTypeIsRequired);
    public const string EventNameIsRequired = nameof(EventNameIsRequired);
    public const string MetricIsBeingUsedByExperiment = nameof(MetricIsBeingUsedByExperiment);

    // access tokens
    public const string InvalidAccessTokenType = nameof(InvalidAccessTokenType);
    public const string ServiceAccessTokenMustDefinePolicies = nameof(ServiceAccessTokenMustDefinePolicies);
}