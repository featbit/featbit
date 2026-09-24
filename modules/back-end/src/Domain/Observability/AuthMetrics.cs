#nullable enable

using System.Diagnostics.Metrics;

namespace Domain.Observability;

/// <summary>
/// Authentication, authorization, and licensing instrumentation for the API server.
/// </summary>
/// <remarks>
/// <para>
/// This is the security-relevant blind spot the audit found. All three paths it covers fail by
/// <b>returning a value</b> rather than by throwing: <c>DefaultPermissionChecker.IsGrantedAsync</c>
/// returns <c>false</c> from four different places, <c>LicenseService.IsFeatureGrantedAsync</c>
/// returns <c>false</c> from two, and the OAuth and OIDC login endpoints return an error-shaped
/// <c>200 OK</c>. Nothing throws, so nothing is logged as an error, and no HTTP status-code metric
/// distinguishes any of it from success.
/// </para>
/// <para>
/// The practical consequence is that the two questions asked most often during a real incident —
/// "is someone brute-forcing us?" and "why is this customer suddenly getting 403s?" — had no
/// answer at all. A misconfigured OIDC provider and a working one produced identical telemetry.
/// </para>
/// <para>
/// <b>No user, email, IP, workspace, or resource identifier is recorded.</b> Those belong in logs,
/// which are access-controlled and expire; a metric dimension is neither. <c>reason</c> is what
/// carries the diagnosis, and it is drawn from the fixed <see cref="AuthReasons"/> vocabulary.
/// </para>
/// <para>
/// <b>Provider and feature names are only tagged once they have been resolved.</b> Both arrive from
/// the request body, so tagging them as received would let an unauthenticated caller mint unbounded
/// metric series — on endpoints that are deliberately <c>[AllowAnonymous]</c>. An unresolved value
/// is recorded as <c>unknown</c>.
/// </para>
/// </remarks>
public sealed class AuthMetrics
{
    private AuthMetrics(Meter meter, string instrumentPrefix)
    {
        Meter = meter;

        Logins = meter.CreateCounter<long>(
            $"{instrumentPrefix}auth.logins",
            unit: "{login}",
            description:
            "Login attempts by method and outcome. Covers password, OAuth and OIDC, all of which " +
            "signal failure with a 200 OK error body rather than an error status code.");

        AuthorizationDecisions = meter.CreateCounter<long>(
            $"{instrumentPrefix}auth.authorization_decisions",
            unit: "{decision}",
            description:
            "Permission checks by resource type and outcome. reason separates a genuine policy " +
            "denial from a malformed request and from a permission with no resource mapping.");

        LicenseChecks = meter.CreateCounter<long>(
            $"{instrumentPrefix}auth.license_checks",
            unit: "{check}",
            description:
            "License feature checks by feature and outcome. A denial here presents to the user as a " +
            "missing feature rather than as an error, so it is otherwise silent.");
    }

    /// <summary>The instrumentation in use for the running service.</summary>
    public static AuthMetrics Current { get; } =
        new(new Meter(FeatBitMeters.Api), FeatBitInstruments.ApiPrefix);

    /// <summary>The owning meter. Exposed so tests can listen to this instance specifically.</summary>
    public Meter Meter { get; }

    /// <summary>Counter of login attempts.</summary>
    public Counter<long> Logins { get; }

    /// <summary>Counter of permission-check decisions.</summary>
    public Counter<long> AuthorizationDecisions { get; }

    /// <summary>Counter of license feature checks.</summary>
    public Counter<long> LicenseChecks { get; }

    /// <summary>Records one login attempt.</summary>
    /// <param name="operation">One of <see cref="AuthMethods"/>.</param>
    /// <param name="outcome">One of <see cref="Outcomes"/>.</param>
    /// <param name="reason">One of <see cref="AuthReasons"/>.</param>
    public void RecordLogin(string operation, string outcome, string reason) =>
        Logins.Add(
            1,
            new KeyValuePair<string, object?>(ObservabilityTags.Operation, operation),
            new KeyValuePair<string, object?>(ObservabilityTags.Outcome, outcome),
            new KeyValuePair<string, object?>(ObservabilityTags.Reason, reason));

    /// <summary>Records one permission-check decision.</summary>
    /// <param name="resourceType">The resource kind, or <c>unknown</c> when it could not be mapped.</param>
    /// <param name="outcome">One of <see cref="Outcomes"/>.</param>
    /// <param name="reason">One of <see cref="AuthReasons"/>.</param>
    public void RecordAuthorization(string resourceType, string outcome, string reason) =>
        AuthorizationDecisions.Add(
            1,
            new KeyValuePair<string, object?>(ObservabilityTags.ResourceType, resourceType),
            new KeyValuePair<string, object?>(ObservabilityTags.Outcome, outcome),
            new KeyValuePair<string, object?>(ObservabilityTags.Reason, reason));

    /// <summary>Records one license feature check.</summary>
    /// <param name="feature">
    /// The feature name, which the caller must already have confirmed is a defined feature.
    /// Otherwise pass <see cref="AuthMethods.Unknown"/>.
    /// </param>
    /// <param name="outcome">One of <see cref="Outcomes"/>.</param>
    /// <param name="reason">One of <see cref="AuthReasons"/>.</param>
    public void RecordLicenseCheck(string feature, string outcome, string reason) =>
        LicenseChecks.Add(
            1,
            new KeyValuePair<string, object?>(ObservabilityTags.Operation, feature),
            new KeyValuePair<string, object?>(ObservabilityTags.Outcome, outcome),
            new KeyValuePair<string, object?>(ObservabilityTags.Reason, reason));
}

/// <summary>The fixed vocabulary for the <c>operation</c> dimension of <see cref="AuthMetrics.Logins"/>.</summary>
public static class AuthMethods
{
    /// <summary>Not resolved — an unconfigured OAuth provider, or an undefined license feature.</summary>
    public const string Unknown = "unknown";

    /// <summary>Email and password.</summary>
    public const string Password = "password";

    /// <summary>A social OAuth provider.</summary>
    public const string OAuth = "oauth";

    /// <summary>An OpenID Connect provider configured for a workspace.</summary>
    public const string Oidc = "oidc";
}

/// <summary>
/// The fixed <c>reason</c> vocabulary shared by the three <see cref="AuthMetrics"/> instruments.
/// </summary>
/// <remarks>
/// These are the distinct ways an authentication, authorization, or license decision can come out,
/// enumerated from the code paths that produce them. They exist as constants rather than free text
/// so that a security dashboard can group by <c>reason</c> without the series count growing with
/// traffic.
/// </remarks>
public static class AuthReasons
{
    /// <summary>The request was allowed.</summary>
    public const string Granted = "granted";

    /// <summary>
    /// The email or the password did not match. Both cases share one reason on purpose: the
    /// response does not distinguish them, and a metric must not reintroduce the user-enumeration
    /// oracle that the response deliberately avoids.
    /// </summary>
    public const string InvalidCredentials = "invalid_credentials";

    /// <summary>The named OAuth provider is not configured on this deployment.</summary>
    public const string UnsupportedProvider = "unsupported_provider";

    /// <summary>The identity provider returned no usable email address.</summary>
    public const string NoEmail = "no_email";

    /// <summary>SSO is switched off for this deployment.</summary>
    public const string NotEnabled = "not_enabled";

    /// <summary>The workspace named in the request does not exist.</summary>
    public const string WorkspaceNotFound = "workspace_not_found";

    /// <summary>The workspace's license does not grant the requested feature.</summary>
    public const string NotLicensed = "not_licensed";

    /// <summary>The feature is licensed but has not been configured.</summary>
    public const string NotConfigured = "not_configured";

    /// <summary>The requested feature name is not one this build knows about.</summary>
    public const string UndefinedFeature = "undefined_feature";

    /// <summary>The permission has no entry in the resource map — a deployment or code defect.</summary>
    public const string UnmappedPermission = "unmapped_permission";

    /// <summary>The target resource could not be identified from the request, usually a bad route value.</summary>
    public const string InvalidResource = "invalid_resource";

    /// <summary>The caller's policies do not allow the action on the resource. The ordinary denial.</summary>
    public const string PolicyDenied = "policy_denied";

    /// <summary>The attempt threw.</summary>
    public const string Error = "error";
}
