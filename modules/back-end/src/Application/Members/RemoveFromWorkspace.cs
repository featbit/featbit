namespace Application.Members;

public class RemoveFromWorkspace : IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public Guid MemberId { get; set; }
}

public class RemoveFromWorkspaceHandler : IRequestHandler<RemoveFromWorkspace, bool>
{
    private readonly IUserService _userService;
    private readonly IOrganizationService _organizationService;
    private readonly IMemberService _memberService;

    public RemoveFromWorkspaceHandler(
        IUserService userService,
        IOrganizationService organizationService,
        IMemberService memberService)
    {
        _userService = userService;
        _organizationService = organizationService;
        _memberService = memberService;
    }

    public async Task<bool> Handle(RemoveFromWorkspace request, CancellationToken cancellationToken)
    {
        // remove member from all organizations
        var organizations = await _organizationService.GetListAsync(request.MemberId);
        foreach (var organization in organizations)
        {
            await _memberService.DeleteAsync(organization.Id, request.MemberId);
        }

        // remove member from workspace
        await _userService.DeleteAsync(request.MemberId);

        return true;
    }
}