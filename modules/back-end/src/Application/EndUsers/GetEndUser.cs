using Domain.EndUsers;

namespace Application.EndUsers;

public class GetEndUser : IRequest<EndUser>
{
    public Guid Id { get; set; }
}

public class GetEndUserHandler : IRequestHandler<GetEndUser, EndUser>
{
    private readonly IEndUserService _service;

    public GetEndUserHandler(IEndUserService service)
    {
        _service = service;
    }

    public async Task<EndUser> Handle(GetEndUser request, CancellationToken cancellationToken)
    {
        return await _service.GetAsync(request.Id);
    }
}