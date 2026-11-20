namespace Application.Groups;

public class GetGroup : IRequest<GroupVm>
{
    public Guid Id { get; set; }
}

public class GetGroupHandler : IRequestHandler<GetGroup, GroupVm>
{
    private readonly IGroupService _service;

    public GetGroupHandler(IGroupService service)
    {
        _service = service;
    }
    
    public async Task<GroupVm> Handle(GetGroup request, CancellationToken cancellationToken)
    {
        var group = await _service.GetAsync(request.Id);

        return GroupMapper.ToVm(group);
    }
}