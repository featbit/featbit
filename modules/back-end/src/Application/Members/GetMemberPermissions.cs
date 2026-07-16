namespace Application.Members;

public class GetMemberPermissions : IRequest<IReadOnlyCollection<MemberPermissionVm>>
{
    public Guid OrganizationId { get; set; }

    public Guid MemberId { get; set; }
}

public class GetMemberPermissionsHandler(IMemberService service)
    : IRequestHandler<GetMemberPermissions, IReadOnlyCollection<MemberPermissionVm>>
{
    public async Task<IReadOnlyCollection<MemberPermissionVm>> Handle(
        GetMemberPermissions request,
        CancellationToken cancellationToken)
    {
        var assignments = await service.GetPermissionAssignmentsAsync(request.OrganizationId, request.MemberId);
        return MemberPermissionMapper.Map(assignments);
    }
}
