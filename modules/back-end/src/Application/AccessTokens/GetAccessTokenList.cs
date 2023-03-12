using Application.Bases.Models;
using Application.Members;

namespace Application.AccessTokens;

public class GetAccessTokenList : IRequest<PagedResult<AccessTokenVm>>
{
    public Guid OrganizationId { get; set; }

    public AccessTokenFilter Filter { get; set; }
}

public class GetAccessTokenListHandler : IRequestHandler<GetAccessTokenList, PagedResult<AccessTokenVm>>
{
    private readonly IMemberService _memberService;
    private readonly IAccessTokenService _service;
    private readonly IMapper _mapper;

    public GetAccessTokenListHandler(IAccessTokenService service, IMemberService memberService, IMapper mapper)
    {
        _service = service;
        _memberService = memberService;
        _mapper = mapper;
    }
    
    public async Task<PagedResult<AccessTokenVm>> Handle(GetAccessTokenList request, CancellationToken cancellationToken)
    {
        var accessTokens = await _service.GetListAsync(request.OrganizationId, request.Filter);
        var creatorIds = accessTokens.Items.Select(x => x.CreatorId);
        var creators = await _memberService.GetListByIds(creatorIds);
        var accessTokenVms = _mapper.Map<PagedResult<AccessTokenVm>>(accessTokens);
        foreach (var accessTokenItem in accessTokens.Items)
        {
            var accessTokenVm = accessTokenVms.Items.First(x => x.Id == accessTokenItem.Id);
            accessTokenVm.Creator = _mapper.Map<MemberVm>(creators.First(x => x.Id == accessTokenItem.CreatorId));
            accessTokenVm.Token = accessTokenVm.Token[..15] + "**************";
        }

        return accessTokenVms;
    }
}