using System.Linq.Expressions;
using Application.ChangeRequests;
using Application.Services;
using Application.Users;
using Domain.FeatureFlags;
using Domain.FlagChangeRequests;
using Domain.FlagDrafts;
using Domain.Members;
using Domain.Users;

namespace Application.UnitTests.Handlers;

public class GetChangeRequestListHandlerTests
{
    [Fact]
    public async Task Handle_EnrichesRequestsAndExposesReviewerCapabilities()
    {
        var orgId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var currentUserId = Guid.NewGuid();
        var creatorId = Guid.NewGuid();
        var flagId = Guid.NewGuid();
        var draftId = Guid.NewGuid();
        var filter = new ChangeRequestFilter { PageIndex = 0, PageSize = 20 };
        var changeRequest = new FlagChangeRequest(
            orgId,
            envId,
            draftId,
            flagId,
            [currentUserId],
            creatorId,
            reason: "Ready after QA");
        changeRequest.Id = Guid.NewGuid();
        var approvedChangeRequest = new FlagChangeRequest(
            orgId,
            envId,
            draftId,
            flagId,
            [currentUserId],
            creatorId,
            reason: "Approved after QA");
        approvedChangeRequest.Approve(currentUserId);
        approvedChangeRequest.Id = Guid.NewGuid();
        var flag = new FeatureFlag
        {
            Id = flagId,
            EnvId = envId,
            Name = "Checkout V2",
            Key = "checkout-v2"
        };
        var creator = new User(creatorId, "maya@example.com", "password", "Maya Chen");
        var updator = new User(currentUserId, "jon@example.com", "password", "Jon Bell");
        var reviewer = new Member
        {
            Id = currentUserId,
            Name = "Jon Bell",
            Email = "jon@example.com"
        };

        var changeRequestService = new Mock<IFlagChangeRequestService>();
        changeRequestService
            .Setup(service => service.GetListAsync(orgId, envId, currentUserId, filter))
            .ReturnsAsync(new FlagChangeRequestPage(2, 1, [changeRequest, approvedChangeRequest]));
        var flagService = new Mock<IFeatureFlagService>();
        flagService
            .Setup(service => service.FindManyAsync(It.IsAny<Expression<Func<FeatureFlag, bool>>>()))
            .ReturnsAsync([flag]);
        var resourceService = new Mock<IResourceService>();
        resourceService
            .Setup(service => service.GetEnvRnAsync(envId))
            .ReturnsAsync("project/game-runner:env/dev");
        var draftService = new Mock<IFlagDraftService>();
        draftService
            .Setup(service => service.FindManyAsync(It.IsAny<Expression<Func<FlagDraft, bool>>>()))
            .ReturnsAsync([]);
        var userService = new Mock<IUserService>();
        userService
            .Setup(service => service.GetListAsync(It.IsAny<IEnumerable<Guid>>()))
            .ReturnsAsync([creator, updator]);
        var memberService = new Mock<IMemberService>();
        memberService
            .Setup(service => service.GetListAsync(orgId, It.IsAny<Guid[]>()))
            .ReturnsAsync([reviewer]);
        var currentUser = new Mock<ICurrentUser>();
        currentUser.SetupGet(user => user.Id).Returns(currentUserId);
        var handler = new GetChangeRequestListHandler(
            changeRequestService.Object,
            draftService.Object,
            flagService.Object,
            resourceService.Object,
            userService.Object,
            memberService.Object,
            currentUser.Object);

        var result = await handler.Handle(
            new GetChangeRequestList { OrgId = orgId, EnvId = envId, Filter = filter },
            CancellationToken.None);

        Assert.Equal(2, result.TotalCount);
        Assert.Equal(1, result.NeedsReviewCount);
        var pendingItem = result.Items.Single(item => item.Id == changeRequest.Id);
        Assert.Equal("Checkout V2", pendingItem.FlagName);
        Assert.Equal("checkout-v2", pendingItem.FlagKey);
        Assert.Equal("project/game-runner:env/dev", pendingItem.ScopeRn);
        Assert.Equal("Maya Chen", pendingItem.CreatorName);
        Assert.Equal("Maya Chen", pendingItem.UpdatorName);
        Assert.True(pendingItem.CanReview);
        Assert.False(pendingItem.CanApply);
        Assert.Equal("Jon Bell", Assert.Single(pendingItem.Reviewers).Name);

        var approvedItem = result.Items.Single(item => item.Id == approvedChangeRequest.Id);
        Assert.Equal(currentUserId, approvedItem.UpdatorId);
        Assert.Equal("Jon Bell", approvedItem.UpdatorName);
        Assert.Equal("jon@example.com", approvedItem.UpdatorEmail);
        Assert.False(approvedItem.CanReview);
        Assert.True(approvedItem.CanApply);
    }
}
