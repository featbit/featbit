using Application.Bases;
using Application.Caches;
using Domain.Workspaces;

namespace Application.Workspaces;

public class UpdateLicense : IRequest<WorkspaceVm>
{
    /// <summary>
    /// The ID of the workspace. Retrieved from the request header.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// The license key to apply to the workspace
    /// </summary>
    public string License { get; set; }
}

public class UpdateLicenseValidator : AbstractValidator<UpdateLicense>
{
    public UpdateLicenseValidator()
    {
        RuleFor(x => x.License)
            .Must((request, license) => LicenseVerifier.TryParse(request.Id, license, out _))
            .WithErrorCode(ErrorCodes.Invalid("license"));
    }
}

public class UpdateLicenseHandler : IRequestHandler<UpdateLicense, WorkspaceVm>
{
    private readonly IWorkspaceService _service;
    private readonly ICacheService _cacheService;
    private readonly IMapper _mapper;

    public UpdateLicenseHandler(IWorkspaceService service, ICacheService cacheService, IMapper mapper)
    {
        _service = service;
        _cacheService = cacheService;
        _mapper = mapper;
    }

    public async Task<WorkspaceVm> Handle(UpdateLicense request, CancellationToken cancellationToken)
    {
        var workspace = await _service.GetAsync(request.Id);

        // save to database
        workspace.UpdateLicense(request.License);
        await _service.UpdateAsync(workspace);

        // update license cache
        await _cacheService.UpsertLicenseAsync(workspace);

        return _mapper.Map<WorkspaceVm>(workspace);
    }
}