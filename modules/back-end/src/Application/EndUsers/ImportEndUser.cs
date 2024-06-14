using Domain.EndUsers;

namespace Application.EndUsers;

public class ImportEndUser : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public EndUser[] Users { get; set; }

    public string[] UserProperties { get; set; }

    public ImportEndUser(Guid envId, ImportUserData data)
    {
        EnvId = envId;
        Users = data.Users.Select(x => x.AsEndUser(workspaceId: null, envId)).ToArray();
        UserProperties = data.UserProperties;
    }
}

public class ImportEndUserHandler : IRequestHandler<ImportEndUser, bool>
{
    private readonly IEndUserService _service;

    public ImportEndUserHandler(IEndUserService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(ImportEndUser request, CancellationToken cancellationToken)
    {
        // upsert end users
        await _service.UpsertAsync(workspaceId: null, request.EnvId, request.Users);

        // add new user properties
        await _service.AddNewPropertiesAsync(request.EnvId, request.UserProperties);

        return true;
    }
}