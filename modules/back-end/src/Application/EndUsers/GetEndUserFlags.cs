namespace Application.EndUsers;

public class GetEndUserFlags : IRequest<IEnumerable<EndUserFlag>>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class GetEndUserFlagsHandler : IRequestHandler<GetEndUserFlags, IEnumerable<EndUserFlag>>
{
    private readonly IFeatureFlagService _flagService;
    private readonly IEndUserService _endUserService;
    private readonly IEvaluator _evaluator;

    public GetEndUserFlagsHandler(
        IFeatureFlagService flagService,
        IEndUserService endUserService,
        IEvaluator evaluator)
    {
        _flagService = flagService;
        _endUserService = endUserService;
        _evaluator = evaluator;
    }

    public async Task<IEnumerable<EndUserFlag>> Handle(GetEndUserFlags request, CancellationToken cancellationToken)
    {
        var endUser = await _endUserService.GetAsync(request.Id);
        var flags = await _flagService.FindManyAsync(x => x.EnvId == request.EnvId && !x.IsArchived);

        var result = new List<EndUserFlag>();
        foreach (var flag in flags)
        {
            var variation = await _evaluator.EvaluateAsync(flag, endUser);
            result.Add(new EndUserFlag(flag, variation));
        }

        return result;
    }
}