using Application.Bases.Models;
using Application.Users;

namespace Application.AccessTokens;

public class GetAccessTokenList : IRequest<PagedResult<AccessTokenVm>>
{
    public Guid OrganizationId { get; set; }

    public AccessTokenFilter Filter { get; set; }
}

public class GetAccessTokenListHandler(IAccessTokenService accessTokenService, IUserService userService)
    : IRequestHandler<GetAccessTokenList, PagedResult<AccessTokenVm>>
{
    public async ValueTask<PagedResult<AccessTokenVm>> Handle(GetAccessTokenList request, CancellationToken cancellationToken)
    {
        var accessTokens =
            await accessTokenService.GetListAsync(request.OrganizationId, request.Filter);

        var creatorIds = accessTokens.Items.Select(x => x.CreatorId);
        var creators = await userService.GetListAsync(creatorIds);

        var accessTokenVms = AccessTokenMapper.ToVm(accessTokens);
        foreach (var accessToken in accessTokens.Items)
        {
            var accessTokenVm = accessTokenVms.Items.First(x => x.Id == accessToken.Id);
            accessTokenVm.Creator = UserMapper.ToVm(creators.FirstOrDefault(x => x.Id == accessToken.CreatorId));
            accessTokenVm.Token = accessTokenVm.Token[..15] + "**************";
        }

        return accessTokenVms;
    }
}