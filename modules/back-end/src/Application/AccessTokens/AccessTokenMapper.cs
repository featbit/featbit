using Application.Bases.Mapping;
using Application.Bases.Models;
using Domain.AccessTokens;
using Domain.Policies;
using Riok.Mapperly.Abstractions;

namespace Application.AccessTokens;

[Mapper]
public static partial class AccessTokenMapper
{
    // The creator is looked up and attached by GetAccessTokenListHandler.
    [MapperIgnoreTarget(nameof(AccessTokenVm.Creator))]
    [MapProperty(nameof(AccessToken.Token), nameof(AccessTokenVm.Token), Use = nameof(MaskToken))]
    public static partial AccessTokenVm ToVm(AccessToken accessToken);

    public static PagedResult<AccessTokenVm> ToVm(PagedResult<AccessToken> accessTokens) =>
        MapperConventions.MapPage(accessTokens, ToVm);

    // Only the first 10 characters of a token are ever shown.
    private static string MaskToken(string token) =>
        token == null ? null : $"{token.Substring(0, 10)}**************";

    [UserMapping(Default = true)]
    private static IEnumerable<PolicyStatement> CopyPermissions(PolicyStatement[] permissions) =>
        MapperConventions.CopyList(permissions);
}
