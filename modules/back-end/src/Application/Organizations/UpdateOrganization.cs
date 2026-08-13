using Application.Bases;
using Domain.Organizations;
using Domain.Policies;

namespace Application.Organizations;

public class UpdateOrganizationPayload
{
    public string Name { get; set; }

    public OrganizationPermissions DefaultPermissions { get; set; }

    public OrganizationSetting Settings { get; set; }
}

public class UpdateOrganization : UpdateOrganizationPayload, IRequest<OrganizationVm>
{
    public Guid Id { get; set; }

    public PolicyStatement[] CurrentUserPermissions { get; set; } = [];
}

public class UpdateOrganizationValidator : AbstractValidator<UpdateOrganization>
{
    public UpdateOrganizationValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"));

        RuleFor(x => x.DefaultPermissions)
            .NotNull().WithErrorCode(ErrorCodes.Required("defaultPermissions"))
            .Must(x => x.IsValid()).WithErrorCode(ErrorCodes.Invalid("defaultPermissions"));

        RuleFor(x => x.Settings)
            .NotNull().WithErrorCode(ErrorCodes.Required("settings"));
    }
}

public class UpdateOrganizationHandler(IOrganizationService service, IMapper mapper)
    : IRequestHandler<UpdateOrganization, OrganizationVm>
{
    public async Task<OrganizationVm> Handle(UpdateOrganization request, CancellationToken cancellationToken)
    {
        var organization = await service.GetAsync(request.Id);

        var nameChanged = !string.Equals(organization.Name, request.Name, StringComparison.Ordinal);
        var sortingChanged = !string.Equals(
            organization.Settings.FlagSortedBy,
            request.Settings.FlagSortedBy,
            StringComparison.Ordinal);
        var defaultPermissionsChanged =
            !organization.DefaultPermissions.PolicyIds.ToHashSet().SetEquals(request.DefaultPermissions.PolicyIds) ||
            !organization.DefaultPermissions.GroupIds.ToHashSet().SetEquals(request.DefaultPermissions.GroupIds);

        if (nameChanged)
        {
            OrganizationAuthorization.EnsureAllowed(
                request.CurrentUserPermissions,
                Permissions.UpdateOrgName
            );
        }

        if (sortingChanged)
        {
            OrganizationAuthorization.EnsureAllowed(
                request.CurrentUserPermissions,
                Permissions.UpdateOrgSortFlagsBy
            );
        }

        if (defaultPermissionsChanged)
        {
            OrganizationAuthorization.EnsureAllowed(
                request.CurrentUserPermissions,
                Permissions.UpdateOrgDefaultUserPermissions
            );
        }

        if (!nameChanged && !sortingChanged && !defaultPermissionsChanged)
        {
            return mapper.Map<OrganizationVm>(organization);
        }

        organization.Update(request.Name, request.Settings, request.DefaultPermissions);
        await service.UpdateAsync(organization);

        return mapper.Map<OrganizationVm>(organization);
    }
}
