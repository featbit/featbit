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

public class ImportGlobalUserHandler : IRequestHandler<ImportGlobalUser, bool>
{
    private readonly IEndUserService _endUserService;

    public ImportGlobalUserHandler(IEndUserService endUserService)
    {
        _endUserService = endUserService;
    }

    public async Task<bool> Handle(ImportGlobalUser request, CancellationToken cancellationToken)
    {
        await _endUserService.UpsertAsync(request.WorkspaceId, envId: null, request.Users);

        return true;
    }
}