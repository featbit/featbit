using Domain.RelayProxies;

namespace Application.RelayProxies;

public class UpdateRelayProxy : RelayProxyBase, IRequest<bool>
{
    public Guid Id { get; set; }

    public AutoAgent[] AutoAgents { get; set; } = [];
}

public class UpdateRelayProxyValidator : AbstractValidator<UpdateRelayProxy>
{
    public UpdateRelayProxyValidator()
    {
        Include(new WebhookBaseValidator());
    }
}

public class UpdateRelayProxyHandler(IRelayProxyService service) : IRequestHandler<UpdateRelayProxy, bool>
{
    public async Task<bool> Handle(UpdateRelayProxy request, CancellationToken cancellationToken)
    {
        var relayProxy = await service.GetAsync(request.Id);
        relayProxy.Update(
            request.Name,
            request.Description,
            request.IsAllEnvs,
            request.Scopes,
            request.Agents,
            request.AutoAgents
        );

        await service.UpdateAsync(relayProxy);

        return true;
    }
}