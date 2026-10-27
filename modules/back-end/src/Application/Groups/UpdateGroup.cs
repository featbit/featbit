using Application.AuditLogs;
using Application.Users;
using Domain.AuditLogs;
using Application.Bases;

namespace Application.Groups;

public class UpdateGroup : IRequest<GroupVm>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrganizationId { get; set; }

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
    private readonly IPublisher _auditPublisher;
    private readonly ICurrentUser _auditActor;

    private readonly IGroupService _service;
    private readonly IMapper _mapper;

    public UpdateGroupHandler(IGroupService service, IMapper mapper, IPublisher auditPublisher, ICurrentUser auditActor)
    {
        _auditPublisher = auditPublisher;
        _auditActor = auditActor;
        _service = service;
        _mapper = mapper;
    }

    public async Task<GroupVm> Handle(UpdateGroup request, CancellationToken cancellationToken)
    {
        var previous = await _service.GetAuditSnapshotAsync(request.Id);
        var change = new DataChange(previous);

        var group = await _service.GetAsync(request.Id);

        group.Update(request.Name, request.Description);

        await _service.UpdateAsync(group);

        var current = await _service.GetAuditSnapshotAsync(request.Id);
        await _auditPublisher.Publish(new OnIamResourceChanged(request.WorkspaceId, request.OrganizationId,
            AuditLogRefTypes.Group, Operations.UpdateGroup, current ?? previous, change.To(current), _auditActor.Id), cancellationToken);

        return _mapper.Map<GroupVm>(group);
    }
}