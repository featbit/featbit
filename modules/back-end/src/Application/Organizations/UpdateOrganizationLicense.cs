using Application.Bases;

namespace Application.Organizations;

public class UpdateOrganizationLicense : IRequest<OrganizationVm>
{
    public Guid Id { get; set; }

    public string License { get; set; }
}

public class UpdateOrganizationLicenseValidator : AbstractValidator<UpdateOrganizationLicense>
{
    public UpdateOrganizationLicenseValidator()
    {
        RuleFor(x => x.License)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("License"));
    }
}

public class UpdateOrganizationLicenseHandler : IRequestHandler<UpdateOrganizationLicense, OrganizationVm>
{
    private readonly IOrganizationService _service;
    private readonly IMapper _mapper;

    public UpdateOrganizationLicenseHandler(IOrganizationService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<OrganizationVm> Handle(UpdateOrganizationLicense request, CancellationToken cancellationToken)
    {
        var organization = await _service.GetAsync(request.Id);
        if (organization == null)
        {
            return null;
        }

        organization.UpdateLicense(request.License);

        await _service.UpdateAsync(organization);

        return _mapper.Map<OrganizationVm>(organization);
    }
}