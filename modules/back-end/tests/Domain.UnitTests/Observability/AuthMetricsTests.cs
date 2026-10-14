using Domain.Observability;

namespace Domain.UnitTests.Observability;

/// <summary>
/// The auth, authorization, and license instruments.
/// </summary>
/// <remarks>
/// These sit on anonymous or near-anonymous endpoints, so every attribute value on them originates
/// with the caller. The tests here are mostly about what is <i>not</i> recorded.
/// </remarks>
[Collection(ObservabilityCollection.Name)]
public sealed class AuthMetricsTests
{
    /// <summary>
    /// <b>The security property that must not regress.</b> The login endpoint deliberately answers
    /// identically whether the email is unknown or the password is wrong, because distinguishing
    /// them turns the endpoint into a user-enumeration oracle. A metric is read by a far wider
    /// audience than the HTTP response, so splitting the reason here would reintroduce the oracle
    /// through telemetry.
    /// </summary>
    [Fact]
    public void AuthReasons_ForAFailedPasswordLogin_DoesNotDistinguishUnknownUserFromWrongPassword()
    {
        var reasons = typeof(AuthReasons)
            .GetFields()
            .Where(f => f.IsLiteral && f.FieldType == typeof(string))
            .Select(f => (string)f.GetRawConstantValue()!)
            .ToArray();

        Assert.Contains(AuthReasons.InvalidCredentials, reasons);
        Assert.DoesNotContain("user_not_found", reasons);
        Assert.DoesNotContain("wrong_password", reasons);
        Assert.DoesNotContain("unknown_email", reasons);
    }

    [Fact]
    public void RecordLogin_ForAnOidcLogin_CarriesMethodOutcomeAndReason()
    {
        var metrics = AuthMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordLogin(AuthMethods.Oidc, Outcomes.Failure, AuthReasons.WorkspaceNotFound);

        var login = Assert.Single(collector.For("auth.logins"));

        Assert.Equal(AuthMethods.Oidc, login.Tag(ObservabilityTags.Operation));
        Assert.Equal(Outcomes.Failure, login.Tag(ObservabilityTags.Outcome));
        Assert.Equal(AuthReasons.WorkspaceNotFound, login.Tag(ObservabilityTags.Reason));
    }

    /// <summary>
    /// The login method comes from a request body on an anonymous endpoint. Anything that does not
    /// resolve to a configured provider must land on the fixed <c>unknown</c> value, so the
    /// vocabulary has to contain one.
    /// </summary>
    [Fact]
    public void AuthMethods_ForAnUnresolvedProvider_ProvidesAnUnknownSentinel()
        => Assert.Equal("unknown", AuthMethods.Unknown);

    [Fact]
    public void RecordAuthorization_ForAFlagDecision_TagsTheResourceTypeNotTheResource()
    {
        var metrics = AuthMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordAuthorization(
            ChangeId.FlagResource, Outcomes.Rejected, AuthReasons.PolicyDenied);

        var decision = Assert.Single(collector.For("auth.authorization_decisions"));

        Assert.Equal(ChangeId.FlagResource, decision.Tag(ObservabilityTags.ResourceType));
        Assert.Equal(AuthReasons.PolicyDenied, decision.Tag(ObservabilityTags.Reason));
    }

    [Fact]
    public void RecordLicenseCheck_ForALicensedFeature_TagsTheFeatureAsTheOperation()
    {
        var metrics = AuthMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordLicenseCheck("multi_org", Outcomes.Rejected, AuthReasons.NotLicensed);

        var check = Assert.Single(collector.For("auth.license_checks"));

        Assert.Equal("multi_org", check.Tag(ObservabilityTags.Operation));
        Assert.Equal(AuthReasons.NotLicensed, check.Tag(ObservabilityTags.Reason));
    }
}
