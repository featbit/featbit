using Application.Bases;
using Application.Members;
using Domain.ExperimentMetrics;

namespace Application.AccessTokens;

public class UpdateAccessToken : IRequest<AccessTokenVm>
{
    public Guid Id { get; set; }
    public string Name { get; set; }
}

public class UpdateAccessTokenValidator : AbstractValidator<UpdateAccessToken>
{
    public UpdateAccessTokenValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.NameIsRequired);
    }
}

public class UpdateAccessTokenHandler : IRequestHandler<UpdateAccessToken, AccessTokenVm>
{
    private readonly IAccessTokenService _service;
    private readonly IMemberService _memberService;
    private readonly IMapper _mapper;

    public UpdateAccessTokenHandler(
        IAccessTokenService service,
        IMemberService memberService,
        IMapper mapper)
    {
        _service = service;
        _memberService = memberService;
        _mapper = mapper;
    }

    public async Task<AccessTokenVm> Handle(UpdateAccessToken request, CancellationToken cancellationToken)
    {
        var accessToken = await _service.GetAsync(request.Id);
        accessToken.UpdateName(request.Name);
        
        await _service.UpdateAsync(accessToken);

        var creators = await _memberService.GetListByIds(new List<Guid>() { accessToken.CreatorId });
        var accessTokenVm = _mapper.Map<AccessTokenVm>(accessToken);
        accessTokenVm.Creator = _mapper.Map<MemberVm>(creators.First());

        return accessTokenVm;
    }
}