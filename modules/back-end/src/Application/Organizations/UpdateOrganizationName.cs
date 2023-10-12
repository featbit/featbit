using Application.Bases;

namespace Application.Organizations;

public class UpdateOrganizationName : IRequest<OrganizationVm>
{
    public Guid Id { get; set; }

    public string Name { get; set; }
}

public class UpdateOrganizationNameValidator : AbstractValidator<UpdateOrganizationName>
{
    public UpdateOrganizationNameValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.NameIsRequired);
    }
}

public class UpdateOrganizationNameHandler : IRequestHandler<UpdateOrganizationName, OrganizationVm>
{
    private readonly IOrganizationService _service;
    private readonly IMapper _mapper;

    public UpdateOrganizationNameHandler(IOrganizationService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<OrganizationVm> Handle(UpdateOrganizationName request, CancellationToken cancellationToken)
    {
        var organization = await _service.GetAsync(request.Id);
        if (organization == null)
        {
            return null;
        }

        organization.UpdateName(request.Name);

        await _service.UpdateAsync(organization);

        return _mapper.Map<OrganizationVm>(organization);
    }
}