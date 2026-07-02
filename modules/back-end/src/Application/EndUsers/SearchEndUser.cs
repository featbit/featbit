using Domain.EndUsers;

namespace Application.EndUsers;

public class EndUserSearchFilter
{
    public string SearchText { get; set; }

    public string[] ExcludedKeyIds { get; set; }

    public bool GlobalUserOnly { get; set; }

    public int Limit { get; set; }
}

public class SearchEndUser : IRequest<ICollection<EndUser>>
{
    public Guid WorkspaceId { get; set; }

    public Guid EnvId { get; set; }

    public EndUserSearchFilter Filter { get; set; }
}

public class SearchEndUserHandler(IEndUserService service) : IRequestHandler<SearchEndUser, ICollection<EndUser>>
{
    public async Task<ICollection<EndUser>> Handle(SearchEndUser request, CancellationToken cancellationToken) =>
        await service.SearchAsync(request.WorkspaceId, request.EnvId, request.Filter);
}