using Application.Bases;

namespace Application.Resources;

public class GetResourceList : IRequest<IEnumerable<ResourceVm>>
{
    public Guid OrganizationId { get; set; }

    public ResourceFilter Filter { get; set; }
}

public class GetResourceListValidator : AbstractValidator<GetResourceList>
{
    public GetResourceListValidator()
    {
        RuleFor(x => x.Filter.Type)
            .NotEmpty().WithErrorCode(ErrorCodes.TypeIsRequired);
    }
}

public class GetResourceListHandler : IRequestHandler<GetResourceList, IEnumerable<ResourceVm>>
{
    private readonly IResourceService _service;
    private readonly IMapper _mapper;

    public GetResourceListHandler(IResourceService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<IEnumerable<ResourceVm>> Handle(GetResourceList request, CancellationToken cancellationToken)
    {
        var resources = await _service.GetResourcesAsync(request.OrganizationId, request.Filter);

        return _mapper.Map<IEnumerable<ResourceVm>>(resources);
    }
}