using Application.Bases;

namespace Application.Groups;

public class UpdateGroup : IRequest<GroupVm>
{
    /// <summary>
    /// The ID of the group to update. Retrieved from the URL path.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// The new name for the group
    /// </summary>
    public string Name { get; set; }

    /// <summary>
    /// The new description for the group
    /// </summary>
    public string Description { get; set; }
}

public class UpdateGroupValidator : AbstractValidator<UpdateGroup>
{
    public UpdateGroupValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"));
    }
}

public class UpdateGroupHandler : IRequestHandler<UpdateGroup, GroupVm>
{
    private readonly IGroupService _service;
    private readonly IMapper _mapper;

    public UpdateGroupHandler(IGroupService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<GroupVm> Handle(UpdateGroup request, CancellationToken cancellationToken)
    {
        var group = await _service.GetAsync(request.Id);

        group.Update(request.Name, request.Description);

        await _service.UpdateAsync(group);

        return _mapper.Map<GroupVm>(group);
    }
}