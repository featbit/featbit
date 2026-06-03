namespace Application.ReleaseDecisions;

public class ReleaseDecisionExperimentMessageCreation
{
    public string Role { get; set; }

    public string Content { get; set; }

    public string Metadata { get; set; }
}

public class CreateReleaseDecisionExperimentMessage : IRequest<ReleaseDecisionExperimentDetailVm>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }

    public ReleaseDecisionExperimentMessageCreation Message { get; set; }
}

public class CreateReleaseDecisionExperimentMessageHandler(
    IReleaseDecisionExperimentService service)
    : IRequestHandler<CreateReleaseDecisionExperimentMessage, ReleaseDecisionExperimentDetailVm>
{
    public async Task<ReleaseDecisionExperimentDetailVm> Handle(
        CreateReleaseDecisionExperimentMessage request,
        CancellationToken cancellationToken)
    {
        return await service.AddMessageAsync(request.EnvId, request.Id, request.Message);
    }
}
