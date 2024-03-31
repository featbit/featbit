using Application.Bases;
using Domain.Resources;

namespace Application.Resources;

public class GetResourceListV2 : IRequest<IEnumerable<ResourceV2>>
{
    public Guid SpaceId { get; set; }

    public ResourceFilterV2 Filter { get; set; }
}

public class GetResourceListV2Validator : AbstractValidator<GetResourceListV2>
{
    public GetResourceListV2Validator()
    {
        RuleFor(x => x.SpaceId)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("spaceId"));

        RuleFor(x => x.Filter.SpaceLevel)
            .Must(ResourceSpaceLevel.IsDefined)
            .WithErrorCode(ErrorCodes.Invalid("filter.spaceLevel"));
    }
}

public class GetResourceListV2Handler : IRequestHandler<GetResourceListV2, IEnumerable<ResourceV2>>
{
    private readonly IResourceServiceV2 _service;

    public GetResourceListV2Handler(IResourceServiceV2 service)
    {
        _service = service;
    }

    public async Task<IEnumerable<ResourceV2>> Handle(GetResourceListV2 request, CancellationToken cancellationToken)
    {
        var resources = await _service.GetResourcesAsync(request.SpaceId, request.Filter);
        return resources;
    }
}