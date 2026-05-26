using Application.Bases;
using Application.Bases.Exceptions;
using Domain.EndUsers;

namespace Application.EndUsers;

public class DownloadEndUsers : IRequest<ImportUserData>
{
    public Guid EnvId { get; set; }
}

public class DownloadEndUsersHandler(IEndUserService service) : IRequestHandler<DownloadEndUsers, ImportUserData>
{
    public async Task<ImportUserData> Handle(DownloadEndUsers request, CancellationToken cancellationToken)
    {
        var envId = request.EnvId;

        var total = await service.CountAsync(x => x.EnvId == envId);
        if (total > 50_000)
        {
            throw new BusinessException(ErrorCodes.BusinessRuleViolated);
        }

        var users = await service.FindManyAsync(x => x.EnvId == envId);
        var properties = await service.GetPropertiesAsync(envId);

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