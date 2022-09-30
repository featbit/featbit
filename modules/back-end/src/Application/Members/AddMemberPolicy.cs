using Domain.Members;

namespace Application.Members;

public class AddMemberPolicy : IRequest<bool>
{
    public Guid OrganizationId { get; set; }

    public Guid MemberId { get; set; }

    public Guid PolicyId { get; set; }
}

public class AddMemberPolicyHandler : IRequestHandler<AddMemberPolicy, bool>
{
    private readonly IMemberService _service;

    public AddMemberPolicyHandler(IMemberService service)
    {
        _service = service;
    }
    
    public async Task<bool> Handle(AddMemberPolicy request, CancellationToken cancellationToken)
    {
        var policy = new MemberPolicy(request.OrganizationId, request.MemberId, request.PolicyId);

        await _service.AddPolicyAsync(policy);

        return true;
    }
}