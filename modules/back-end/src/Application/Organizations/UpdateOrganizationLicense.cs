using Application.Bases;
using Application.Caches;
using Domain.Workspaces;

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
            .Must((request, license) => LicenseVerifier.TryParse(request.Id, license, out _))
            .WithErrorCode(ErrorCodes.Invalid("license"));
    }
}

public class UpdateOrganizationLicenseHandler : IRequestHandler<UpdateOrganizationLicense, OrganizationVm>
{
    private readonly IOrganizationService _service;
    private readonly ICacheService _cacheService;
    private readonly IMapper _mapper;

    public UpdateOrganizationLicenseHandler(IOrganizationService service, ICacheService cacheService, IMapper mapper)
    {
        _service = service;
        _cacheService = cacheService;
        _mapper = mapper;
    }

    public async Task<OrganizationVm> Handle(UpdateOrganizationLicense request, CancellationToken cancellationToken)
    {
        var organization = await _service.GetAsync(request.Id);

        // save to database
        organization.UpdateLicense(request.License);
        await _service.UpdateAsync(organization);

        // update license cache
        await _cacheService.UpsertLicenseAsync(organization);

        return _mapper.Map<OrganizationVm>(organization);
    }
}