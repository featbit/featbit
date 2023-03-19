using Application.Bases.Models;
using Application.Users;

namespace Application.AccessTokens;

public class GetAccessTokenList : IRequest<PagedResult<AccessTokenVm>>
{
    public Guid OrganizationId { get; set; }

    public AccessTokenFilter Filter { get; set; }
}

public class GetAccessTokenListHandler : IRequestHandler<GetAccessTokenList, PagedResult<AccessTokenVm>>
{
    private readonly IAccessTokenService _accessTokenService;
    private readonly IUserService _userService;
    private readonly IMapper _mapper;

    public GetAccessTokenListHandler(IAccessTokenService accessTokenService, IUserService userService, IMapper mapper)
    {
        _accessTokenService = accessTokenService;
        _userService = userService;
        _mapper = mapper;
    }

    public async Task<PagedResult<AccessTokenVm>> Handle(GetAccessTokenList request, CancellationToken cancellationToken)
    {
        var accessTokens =
            await _accessTokenService.GetListAsync(request.OrganizationId, request.Filter);

        var creatorIds = accessTokens.Items.Select(x => x.CreatorId);
        var creators = await _userService.GetListAsync(creatorIds);

        var accessTokenVms = _mapper.Map<PagedResult<AccessTokenVm>>(accessTokens);
        foreach (var accessToken in accessTokens.Items)
        {
            var accessTokenVm = accessTokenVms.Items.First(x => x.Id == accessToken.Id);
            accessTokenVm.Creator = _mapper.Map<UserVm>(creators.FirstOrDefault(x => x.Id == accessToken.CreatorId));
            accessTokenVm.Token = accessTokenVm.Token[..15] + "**************";
        }

        return accessTokenVms;
    }
}