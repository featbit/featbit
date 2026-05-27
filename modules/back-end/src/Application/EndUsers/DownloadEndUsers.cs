using Domain.EndUsers;

namespace Application.EndUsers;

public class DownloadEndUsers : IRequest<ImportUserData>
{
    public Guid WorkspaceId { get; set; }

    public Guid EnvId { get; set; }

    public EndUserFilter Filter { get; set; }
}

public class DownloadEndUsersHandler(IEndUserService service) : IRequestHandler<DownloadEndUsers, ImportUserData>
{
    public async Task<ImportUserData> Handle(DownloadEndUsers request, CancellationToken cancellationToken)
    {
        var users = await service.LoadEndUsersAsync(request.WorkspaceId, request.EnvId, request.Filter);
        var properties = await service.GetPropertiesAsync(request.EnvId);

        var data = new ImportUserData
        {
            Users = users.Select(x => new ImportUser
            {
                KeyId = x.KeyId,
                Name = x.Name,
                CustomizedProperties = x.CustomizedProperties
            }).ToArray(),
            UserProperties = properties.Select(x => x.Name).ToArray()
        };

        return data;
    }
}