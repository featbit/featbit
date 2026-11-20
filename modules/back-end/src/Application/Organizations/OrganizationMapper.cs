using Application.Bases.Mapping;
using Domain.Organizations;
using Riok.Mapperly.Abstractions;

namespace Application.Organizations;

[Mapper]
public static partial class OrganizationMapper
{
    // An organization without stored permissions or settings reads as the defaults.
    [MapProperty(nameof(Organization.DefaultPermissions), nameof(OrganizationVm.DefaultPermissions), Use = nameof(PermissionsOrDefault))]
    [MapProperty(nameof(Organization.Settings), nameof(OrganizationVm.Settings), Use = nameof(SettingsOrDefault))]
    public static partial OrganizationVm ToVm(Organization organization);

    public static List<OrganizationVm> ToVm(IEnumerable<Organization> organizations) =>
        MapperConventions.MapList(organizations, ToVm);

    private static OrganizationPermissions PermissionsOrDefault(OrganizationPermissions permissions) =>
        permissions ?? new OrganizationPermissions();

    private static OrganizationSetting SettingsOrDefault(OrganizationSetting settings) =>
        settings ?? new OrganizationSetting();
}
