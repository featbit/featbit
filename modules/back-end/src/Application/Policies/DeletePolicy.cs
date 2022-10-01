namespace Application.Policies;

public class DeletePolicy : IRequest<bool>
{
    public Guid PolicyId { get; set; }
}

public class DeletePolicyHandler : IRequestHandler<DeletePolicy, bool>
{
    private readonly IPolicyService _service;

    public DeletePolicyHandler(IPolicyService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(DeletePolicy request, CancellationToken cancellationToken)
    {
        await _service.DeleteAsync(request.PolicyId);

        return true;
    }
}