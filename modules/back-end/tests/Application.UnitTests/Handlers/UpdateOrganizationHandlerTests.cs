using Application.Bases.Exceptions;
using Application.Organizations;
using Application.Services;
using AutoMapper;
using Domain.Organizations;
using Domain.Policies;
using Domain.Resources;

namespace Application.UnitTests.Handlers;

public class UpdateOrganizationHandlerTests
{
    private static PolicyStatement Allow(string permission) => new()
    {
        Id = Guid.NewGuid().ToString(),
        ResourceType = ResourceTypes.Organization,
        Effect = EffectType.Allow,
        Actions = [permission],
        Resources = [RN.ForOrganization()]
    };

    private static Organization BuildOrganization()
    {
        return new Organization(Guid.NewGuid(), "Original", "original")
        {
            Id = Guid.NewGuid(),
            DefaultPermissions = new OrganizationPermissions
            {
                PolicyIds = [BuiltInPolicy.Developer],
                GroupIds = []
            }
        };
    }

    private static UpdateOrganization BuildRequest(Organization organization) => new()
    {
        Id = organization.Id,
        Name = organization.Name,
        Settings = new OrganizationSetting
        {
            FlagSortedBy = organization.Settings.FlagSortedBy
        },
        DefaultPermissions = new OrganizationPermissions
        {
            PolicyIds = organization.DefaultPermissions.PolicyIds.ToArray(),
            GroupIds = organization.DefaultPermissions.GroupIds.ToArray()
        }
    };

    private static (UpdateOrganizationHandler sut, Mock<IOrganizationService> service) BuildSut(
        Organization organization)
    {
        var service = new Mock<IOrganizationService>();
        service.Setup(x => x.GetAsync(organization.Id)).ReturnsAsync(organization);
        var mapper = new Mock<IMapper>();
        mapper.Setup(x => x.Map<OrganizationVm>(It.IsAny<Organization>()))
            .Returns(new OrganizationVm());

        return (new UpdateOrganizationHandler(service.Object, mapper.Object), service);
    }

    [Fact]
    public async Task Handle_NameChange_WithNamePermission_UpdatesOrganization()
    {
        var organization = BuildOrganization();
        var request = BuildRequest(organization);
        request.Name = "Updated";
        request.CurrentUserPermissions = [Allow(Permissions.UpdateOrgName)];
        var (sut, service) = BuildSut(organization);

        await sut.Handle(request, CancellationToken.None);

        Assert.Equal("Updated", organization.Name);
        service.Verify(x => x.UpdateAsync(organization), Times.Once);
    }

    [Fact]
    public async Task Handle_SortingChange_WithoutSortingPermission_ThrowsForbidden()
    {
        var organization = BuildOrganization();
        var request = BuildRequest(organization);
        request.Settings.FlagSortedBy = "key";
        request.CurrentUserPermissions = [Allow(Permissions.UpdateOrgName)];
        var (sut, service) = BuildSut(organization);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            sut.Handle(request, CancellationToken.None));

        service.Verify(x => x.UpdateAsync(It.IsAny<Organization>()), Times.Never);
    }

    [Fact]
    public async Task Handle_DefaultPermissionsChange_WithPermission_UpdatesOrganization()
    {
        var organization = BuildOrganization();
        var request = BuildRequest(organization);
        request.DefaultPermissions.PolicyIds = [Guid.NewGuid()];
        request.CurrentUserPermissions =
            [Allow(Permissions.UpdateOrgDefaultUserPermissions)];
        var (sut, service) = BuildSut(organization);

        await sut.Handle(request, CancellationToken.None);

        Assert.Equal(request.DefaultPermissions.PolicyIds, organization.DefaultPermissions.PolicyIds);
        service.Verify(x => x.UpdateAsync(organization), Times.Once);
    }

    [Fact]
    public async Task Handle_MultipleChanges_RequiresEveryChangedFieldPermission()
    {
        var organization = BuildOrganization();
        var request = BuildRequest(organization);
        request.Name = "Updated";
        request.Settings.FlagSortedBy = "key";
        request.CurrentUserPermissions = [Allow(Permissions.UpdateOrgName)];
        var (sut, service) = BuildSut(organization);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            sut.Handle(request, CancellationToken.None));

        service.Verify(x => x.UpdateAsync(It.IsAny<Organization>()), Times.Never);
    }

    [Fact]
    public async Task Handle_NoChanges_WithoutPermissions_DoesNotWrite()
    {
        var organization = BuildOrganization();
        var request = BuildRequest(organization);
        var (sut, service) = BuildSut(organization);

        await sut.Handle(request, CancellationToken.None);

        service.Verify(x => x.UpdateAsync(It.IsAny<Organization>()), Times.Never);
    }
}
