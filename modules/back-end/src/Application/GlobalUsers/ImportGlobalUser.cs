using Domain.EndUsers;

namespace Application.GlobalUsers;

public class ImportGlobalUser : IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public GlobalUser[] Users { get; }

    public string[] UserProperties { get; }

    public ImportGlobalUser(Guid workspaceId, ImportUserData data)
    {
        WorkspaceId = workspaceId;
        Users = data.Users.Select(x => x.AsGlobalUser(workspaceId)).ToArray();
        UserProperties = data.UserProperties;
    }
}

public class ImportGlobalUserHandler : IRequestHandler<ImportGlobalUser, bool>
{
    private readonly IGlobalUserService _globalUserService;
    private readonly IEndUserService _endUserService;
    private readonly IWorkspaceService _workspaceService;

    public ImportGlobalUserHandler(
        IGlobalUserService globalUserService,
        IWorkspaceService workspaceService,
        IEndUserService endUserService)
    {
        _globalUserService = globalUserService;
        _workspaceService = workspaceService;
        _endUserService = endUserService;
    }

    public async Task<bool> Handle(ImportGlobalUser request, CancellationToken cancellationToken)
    {
        // upsert global users
        await _globalUserService.UpsertAsync(request.WorkspaceId, request.Users);

        // add new user properties
        var envIds = await _workspaceService.GetAllEnvIdsAsync(request.WorkspaceId);
        foreach (var envId in envIds)
        {
            await _endUserService.AddNewPropertiesAsync(
                envId,
                request.UserProperties,
                remark: "Imported from global users"
            );
        }

        return true;
    }
}