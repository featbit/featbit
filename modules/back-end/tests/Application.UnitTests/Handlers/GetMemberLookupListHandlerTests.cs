using Application.Bases.Exceptions;
using Application.Bases.Models;
using Application.Members;
using Application.Services;
using Application.Users;
using AutoMapper;
using Domain.Members;

namespace Application.UnitTests.Handlers;

public class GetMemberLookupListHandlerTests
{
    [Fact]
    public async Task Handle_CurrentOrganizationMember_ReturnsOnlyLookupFields()
    {
        var organizationId = Guid.NewGuid();
        var currentUserId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var filter = new MemberFilter
        {
            SearchText = "maya",
            PageIndex = 1,
            PageSize = 20
        };
        var memberService = new Mock<IMemberService>();
        memberService
            .Setup(service => service.GetLookupListAsync(organizationId, filter))
            .ReturnsAsync(new PagedResult<Member>(3,
            [
                new Member
                {
                    Id = memberId,
                    Name = "Maya Chen",
                    Email = "maya@example.com",
                    InitialPassword = "must-not-be-returned"
                }
            ]));
        var organizationService = new Mock<IOrganizationService>();
        organizationService
            .Setup(service => service.ContainsUserAsync(organizationId, currentUserId))
            .ReturnsAsync(true);
        var currentUser = new Mock<ICurrentUser>();
        currentUser.SetupGet(user => user.Id).Returns(currentUserId);
        var handler = new GetMemberLookupListHandler(
            memberService.Object,
            organizationService.Object,
            currentUser.Object,
            CreateMapper());

        var result = await handler.Handle(
            new GetMemberLookupList
            {
                OrganizationId = organizationId,
                Filter = filter
            },
            CancellationToken.None);

        Assert.Equal(3, result.TotalCount);
        var item = Assert.Single(result.Items);
        Assert.Equal(memberId.ToString(), item.Id);
        Assert.Equal("Maya Chen", item.Name);
        Assert.Equal("maya@example.com", item.Email);
        Assert.Equal(
            [nameof(MemberLookupVm.Email), nameof(MemberLookupVm.Id), nameof(MemberLookupVm.Name)],
            typeof(MemberLookupVm).GetProperties().Select(property => property.Name).Order());
    }

    [Fact]
    public async Task Handle_UserOutsideOrganization_ThrowsForbidden()
    {
        var organizationId = Guid.NewGuid();
        var currentUserId = Guid.NewGuid();
        var memberService = new Mock<IMemberService>(MockBehavior.Strict);
        var organizationService = new Mock<IOrganizationService>();
        organizationService
            .Setup(service => service.ContainsUserAsync(organizationId, currentUserId))
            .ReturnsAsync(false);
        var currentUser = new Mock<ICurrentUser>();
        currentUser.SetupGet(user => user.Id).Returns(currentUserId);
        var handler = new GetMemberLookupListHandler(
            memberService.Object,
            organizationService.Object,
            currentUser.Object,
            CreateMapper());

        await Assert.ThrowsAsync<ForbiddenException>(() => handler.Handle(
            new GetMemberLookupList
            {
                OrganizationId = organizationId,
                Filter = new MemberFilter()
            },
            CancellationToken.None));
    }

    private static IMapper CreateMapper()
    {
        var configuration = new MapperConfiguration(config => config.AddProfile<Members.MapperProfile>());
        configuration.AssertConfigurationIsValid();
        return configuration.CreateMapper();
    }
}
