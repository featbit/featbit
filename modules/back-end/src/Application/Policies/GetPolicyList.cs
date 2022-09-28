using Application.Bases.Models;

namespace Application.Policies;

public class GetPolicyList : IRequest<PagedResult<PolicyVm>>
{
    public Guid OrganizationId { get; set; }

    public PolicyFilter Filter { get; set; }
}

public class GetPolicyListHandler : IRequestHandler<GetPolicyList, PagedResult<PolicyVm>>
{
    private readonly IPolicyService _service;
    private readonly IMapper _mapper;

    public GetPolicyListHandler(IPolicyService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }
    
    public async Task<PagedResult<PolicyVm>> Handle(GetPolicyList request, CancellationToken cancellationToken)
    {
        var policies = await _service.GetListAsync(request.OrganizationId, request.Filter);

        return _mapper.Map<PagedResult<PolicyVm>>(policies);
    }
}