using System.Net;

namespace Application.IntegrationTests.Controllers;

/// <summary>
/// Smoke-level coverage that every authorize-by-default controller actually rejects
/// unauthenticated requests. Catches regressions where a class-level [Authorize] is
/// dropped or a route is exposed by accident.
/// </summary>
[Collection(nameof(TestApp))]
public class AuthorizationSmokeTests
{
    private static readonly Guid EnvId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid ProjectId = Guid.Parse("22222222-2222-2222-2222-222222222222");

    private readonly TestApp _app;

    public AuthorizationSmokeTests(TestApp app)
    {
        _app = app;
    }

    public static IEnumerable<object[]> AuthorizedGetEndpoints()
    {
        yield return new object[] { "/api/v1/access-tokens" };
        yield return new object[] { $"/api/v1/envs/{EnvId}/audit-logs" };
        yield return new object[] { "/api/v1/billing/subscription" };
        yield return new object[] { $"/api/v1/envs/{EnvId}/end-users/{Guid.Empty}" };
        yield return new object[] { $"/api/v1/envs/{EnvId}/end-user-properties" };
        yield return new object[] { $"/api/v1/projects/{ProjectId}/envs/{Guid.Empty}" };
        yield return new object[] { $"/api/v1/envs/{EnvId}/experiments" };
        yield return new object[] { $"/api/v1/envs/{EnvId}/experiment-metrics" };
        yield return new object[] { $"/api/v1/envs/{EnvId}/feature-flags" };
        yield return new object[] { "/api/v1/global-users" };
        yield return new object[] { "/api/v1/groups" };
        yield return new object[] { "/api/v1/members" };
        yield return new object[] { "/api/v1/organizations" };
        yield return new object[] { "/api/v1/policies" };
        yield return new object[] { "/api/v1/projects" };
        yield return new object[] { "/api/v1/relay-proxies" };
        yield return new object[] { "/api/v1/resources" };
        yield return new object[] { $"/api/v1/envs/{EnvId}/segments" };
        yield return new object[] { "/api/v1/triggers" };
        yield return new object[] { "/api/v1/user/profile" };
        yield return new object[] { "/api/v1/webhooks" };
        yield return new object[] { "/api/v1/workspaces" };
    }

    [Theory]
    [MemberData(nameof(AuthorizedGetEndpoints))]
    public async Task AuthorizedEndpoint_UnauthenticatedRequest_Returns401(string url)
    {
        var response = await _app.GetAsync(url, authenticated: false);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.True(
            response.Headers.WwwAuthenticate.Count > 0,
            $"Expected WWW-Authenticate header on 401 response from {url}");
    }

    public static IEnumerable<object[]> AnonymousEndpoints()
    {
        yield return new object[] { HttpMethod.Get, "/api/v1/basic/allow-anonymous" };
        yield return new object[] { HttpMethod.Get, "/api/v1/sso/pre-check" };
        yield return new object[] { HttpMethod.Get, "/api/v1/social/providers?redirectUri=https://example.com" };
    }

    [Theory]
    [MemberData(nameof(AnonymousEndpoints))]
    public async Task AnonymousEndpoint_UnauthenticatedRequest_NotRejectedByAuth(HttpMethod method, string url)
    {
        var client = _app.CreateClient();
        var response = await client.SendAsync(new HttpRequestMessage(method, url));

        Assert.NotEqual(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.NotEqual(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
