using Domain.EndUsers;

namespace Application.GlobalUsers;

public class ImportGlobalUser : IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public EndUser[] Users { get; }

    public ImportGlobalUser(Guid workspaceId, ImportUser[] users)
    {
        WorkspaceId = workspaceId;
        Users = users.Select(x => x.AsEndUser(workspaceId, envId: null)).ToArray();
    }
}

public class ImportGlobalUserHandler(IEndUserService endUserService) : IRequestHandler<ImportGlobalUser, bool>
{
    public async Task<bool> Handle(ImportGlobalUser request, CancellationToken cancellationToken)
    {
        await endUserService.UpsertAsync(request.WorkspaceId, envId: null, request.Users);

        return true;
    }
}