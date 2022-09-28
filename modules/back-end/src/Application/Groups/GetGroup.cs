namespace Application.Groups;

public class GetGroup : IRequest<GroupVm>
{
    public Guid Id { get; set; }
}

public class GetGroupHandler : IRequestHandler<GetGroup, GroupVm>
{
    private readonly IGroupService _service;
    private readonly IMapper _mapper;

    public GetGroupHandler(IGroupService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }
    
    public async Task<GroupVm> Handle(GetGroup request, CancellationToken cancellationToken)
    {
        var group = await _service.GetAsync(request.Id);

        return _mapper.Map<GroupVm>(group);
    }
}