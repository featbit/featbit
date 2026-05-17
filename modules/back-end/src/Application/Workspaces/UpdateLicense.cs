using Application.Bases;
using Application.Bases.Exceptions;
using Application.Caches;
using Domain.Workspaces;
using Microsoft.Extensions.Configuration;

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

public class UpdateLicenseHandler(
    IWorkspaceService service,
    ICacheService cacheService,
    IMapper mapper,
    IConfiguration configuration)
    : IRequestHandler<UpdateLicense, WorkspaceVm>
{
    public async Task<WorkspaceVm> Handle(UpdateLicense request, CancellationToken cancellationToken)
    {
        if (configuration.IsSaasHosting())
        {
            throw new BusinessException(ErrorCodes.Forbidden);
        }

        var workspace = await service.GetAsync(request.Id);

        // save to database
        workspace.UpdateLicense(request.License);
        await service.UpdateAsync(workspace);

        // update license cache
        await cacheService.UpsertLicenseAsync(workspace);

        return mapper.Map<WorkspaceVm>(workspace);
    }
}