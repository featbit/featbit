using Application.Bases;
using Application.Bases.Exceptions;
using Application.Caches;

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
    private readonly ILicenseService _licenseService;
    private readonly ICacheService _cacheService;
    private readonly IMapper _mapper;

    public UpdateOrganizationLicenseHandler(
        IOrganizationService service,
        ILicenseService licenseService,
        ICacheService cacheService,
        IMapper mapper)
    {
        _service = service;
        _licenseService = licenseService;
        _cacheService = cacheService;
        _mapper = mapper;
    }

    public async Task<OrganizationVm> Handle(UpdateOrganizationLicense request, CancellationToken cancellationToken)
    {
        var organization = await _service.GetAsync(request.Id);
        if (organization == null)
        {
            return null;
        }
        
        var licenseData = _licenseService.VerifyLicenseAsync(organization.Id, request.License);
        
        if (licenseData == null)
        {
            throw new BusinessException(ErrorCodes.InvalidLicense);
        }

        // save to database
        organization.UpdateLicense(request.License);
        await _cacheService.UpsertLicenseAsync(organization.Id, organization.License);
        
        // save to cache
        await _service.UpdateAsync(organization);
        
        return _mapper.Map<OrganizationVm>(organization);
    }
}