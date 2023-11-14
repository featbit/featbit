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
        var user = await _userService.GetAsync(request.MemberId);
        var organizations = await _organizationService.GetListAsync(request.MemberId);
        foreach (var organization in organizations)
        {
            await _memberService.DeleteAsync(organization.Id, request.MemberId);
        }

        await _userService.DeleteAsync(user.Id);
        return true;
    }
}