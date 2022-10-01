namespace Application.Groups;

public class AddGroupPolicy : IRequest<bool>
{
    public Guid GroupId { get; set; }

    public Guid PolicyId { get; set; }
}

public class AddGroupPolicyHandler : IRequestHandler<AddGroupPolicy, bool>
{
    private readonly IGroupService _service;

    public AddGroupPolicyHandler(IGroupService service)
    {
        _service = service;
    }
    
    public async Task<bool> Handle(AddGroupPolicy request, CancellationToken cancellationToken)
    {
        await _service.AddPolicyAsync(request.GroupId, request.PolicyId);

        return true;
    }
}