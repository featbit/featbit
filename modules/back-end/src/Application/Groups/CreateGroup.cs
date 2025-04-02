using Application.Bases;
using Domain.Groups;

namespace Application.Groups;

public class CreateGroup : IRequest<GroupVm>
{
    public Guid OrganizationId { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }
}

public class CreateGroupValidator : AbstractValidator<CreateGroup>
{
    public CreateGroupValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"));
    }
}

public class CreateGroupHandler : IRequestHandler<CreateGroup, GroupVm>
{
    private readonly IGroupService _service;
    private readonly IMapper _mapper;

    public CreateGroupHandler(IGroupService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<GroupVm> Handle(CreateGroup request, CancellationToken cancellationToken)
    {
        var group = new Group(request.OrganizationId, request.Name, request.Description);

        await _service.AddOneAsync(group);

        return _mapper.Map<GroupVm>(group);
    }
}