using Application.Bases.Models;
using Domain.EndUsers;

namespace Application.EndUsers;

public class GetEndUserList : IRequest<PagedResult<EndUser>>
{
    public Guid EnvId { get; set; }

    public EndUserFilter Filter { get; set; }
}

public class GetEndUserListHandler : IRequestHandler<GetEndUserList, PagedResult<EndUser>>
{
    private readonly IEndUserService _service;

    public GetEndUserListHandler(IEndUserService service)
    {
        _service = service;
    }

    public async Task<PagedResult<EndUser>> Handle(GetEndUserList request, CancellationToken cancellationToken)
    {
        return await _service.GetListAsync(request.EnvId, request.Filter);
    }
}