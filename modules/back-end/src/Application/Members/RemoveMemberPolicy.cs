namespace Application.Members;

public class RemoveMemberPolicy : IRequest<bool>
{
    public Guid OrganizationId { get; set; }

    public Guid MemberId { get; set; }

    public Guid PolicyId { get; set; }
}

public class RemoveMemberPolicyHandler : IRequestHandler<RemoveMemberPolicy, bool>
{
    private readonly IMemberService _service;

    public RemoveMemberPolicyHandler(IMemberService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(RemoveMemberPolicy request, CancellationToken cancellationToken)
    {
        await _service.RemovePolicyAsync(request.OrganizationId, request.MemberId, request.PolicyId);

        return true;
    }
}