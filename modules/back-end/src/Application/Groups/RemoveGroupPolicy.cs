namespace Application.Groups;

public class RemoveGroupPolicy : IRequest<bool>
{
    public Guid GroupId { get; set; }

    public Guid PolicyId { get; set; }
}

public class RemoveGroupPolicyHandler : IRequestHandler<RemoveGroupPolicy, bool>
{
    private readonly IGroupService _service;

    public RemoveGroupPolicyHandler(IGroupService service)
    {
        _service = service;
    }
    
    public async Task<bool> Handle(RemoveGroupPolicy request, CancellationToken cancellationToken)
    {
        await _service.RemovePolicyAsync(request.GroupId, request.PolicyId);

        return true;
    }
}