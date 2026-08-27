using Domain.EndUsers;

namespace Application.EndUsers;

public class GetEndUserByKeyIds : IRequest<IEnumerable<EndUser>>
{
    public Guid WorkspaceId { get; set; }

    public Guid EnvId { get; set; }

    public string[] KeyIds { get; set; }
}

public class GetEndUserByKeyIdsHandler(IEndUserService service)
    : IRequestHandler<GetEndUserByKeyIds, IEnumerable<EndUser>>
{
    public async Task<IEnumerable<EndUser>> Handle(GetEndUserByKeyIds request, CancellationToken cancellationToken)
    {
        var users = await service.FindManyAsync(x =>
            (x.EnvId == request.EnvId || (x.EnvId == null && x.WorkspaceId == request.WorkspaceId)) &&
            request.KeyIds.Contains(x.KeyId)
        );

        return users
            .GroupBy(x => x.KeyId)
            .Select(group => group.FirstOrDefault(x => x.EnvId == request.EnvId) ?? group.First())
            .ToArray();
    }
}
