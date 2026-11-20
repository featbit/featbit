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

    public GetPolicyListHandler(IPolicyService service)
    {
        _service = service;
    }
    
    public async Task<PagedResult<PolicyVm>> Handle(GetPolicyList request, CancellationToken cancellationToken)
    {
        var policies = await _service.GetListAsync(request.OrganizationId, request.Filter);

        return PolicyMapper.ToVm(policies);
    }
}