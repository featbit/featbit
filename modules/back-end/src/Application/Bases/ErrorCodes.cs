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
    public const string EmailPasswordMismatch = nameof(EmailPasswordMismatch);
    public const string ExternalUserCannotChangePassword = nameof(ExternalUserCannotChangePassword);
    public const string PasswordTooShort = nameof(PasswordTooShort);

    // common
    public const string NameIsRequired = nameof(NameIsRequired);
    public const string KeyIsRequired = nameof(KeyIsRequired);
    public const string KeyHasBeenUsed = nameof(KeyHasBeenUsed);

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

    // relay proxies
    public const string InvalidRelayProxyScope = nameof(InvalidRelayProxyScope);
    public const string InvalidRelayProxyAgent = nameof(InvalidRelayProxyAgent);

    public static string Required(string parameterName) => $"{parameterName}_is_required";
    public static string Invalid(string parameterName) => $"{parameterName}_is_invalid";
}