using System.Linq.Expressions;
using Application.AccessTokens;
using Application.Bases.Models;
using Application.Services;
using Domain.AccessTokens;
using Domain.Policies;
using Domain.Resources;

namespace Application.IntegrationTests.Stubs;

public class TestAccessTokenService : NullServiceBase<AccessToken>, IAccessTokenService
{
    public const string PersonalToken = "api-release-decision-test";

    public override Task<AccessToken?> FindOneAsync(Expression<Func<AccessToken, bool>> predicate)
    {
        var accessToken = new AccessToken(
            TestWorkspace.OrganizationId,
            TestUser.Id,
            "Release decision test token",
            AccessTokenTypes.Personal,
            [
                new PolicyStatement
                {
                    Id = "release-decision-test",
                    ResourceType = ResourceTypes.Env,
                    Effect = "allow",
                    Actions = [Permissions.CanAccessEnv],
                    Resources = ["env/*"]
                }
            ])
        {
            Id = new Guid("40000000-0000-0000-0000-000000000001"),
            Token = PersonalToken
        };

        var matches = predicate.Compile().Invoke(accessToken);
        return Task.FromResult(matches ? accessToken : null);
    }

    public Task<PagedResult<AccessToken>> GetListAsync(Guid organizationId, AccessTokenFilter filter)
    {
        return Task.FromResult(new PagedResult<AccessToken>(0, []));
    }

    public Task<bool> IsNameUsedAsync(Guid organizationId, string name)
    {
        return Task.FromResult(false);
    }
}
