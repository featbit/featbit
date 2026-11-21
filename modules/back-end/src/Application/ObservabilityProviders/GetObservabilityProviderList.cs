namespace Application.ObservabilityProviders;

public class GetObservabilityProviderList : IRequest<IEnumerable<ObservabilityProviderVm>>
{
    public Guid EnvId { get; set; }
}

public class GetObservabilityProviderListHandler(IObservabilityProviderService service)
    : IRequestHandler<GetObservabilityProviderList, IEnumerable<ObservabilityProviderVm>>
{
    public async Task<IEnumerable<ObservabilityProviderVm>> Handle(GetObservabilityProviderList request, CancellationToken cancellationToken)
    {
        var providers = await service.GetListAsync(request.EnvId, cancellationToken);
        return providers.Select(ObservabilityProviderVm.From);
    }
}
