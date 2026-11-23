using Application.Bases.Exceptions;
using Application.ReleaseMetricSourceConnections;
using Application.Services;
using Domain.AccessTokens;
using Domain.Environments;
using Microsoft.AspNetCore.Http;

namespace Application.UnitTests.ReleaseMetricSourceConnections;

public class ReleaseMetricSourceConnectionAccessGuardTests
{
    private readonly ResourceDescriptor _scope = new()
    {
        Organization = new IdNameKeyProps { Id = Guid.NewGuid() },
        Project = new IdNameKeyProps { Id = Guid.NewGuid() },
        Environment = new IdNameKeyProps { Id = Guid.NewGuid() }
    };
    private readonly Mock<IOrganizationService> _organizations = new(MockBehavior.Strict);
    private readonly DefaultHttpContext _httpContext = new();
    private readonly ReleaseMetricSourceConnectionAccessGuard _guard;

    public ReleaseMetricSourceConnectionAccessGuardTests()
    {
        var environments = new Mock<IEnvironmentService>(MockBehavior.Strict);
        environments.Setup(x => x.GetResourceDescriptorAsync(_scope.Environment.Id)).ReturnsAsync(_scope);
        var accessor = Mock.Of<IHttpContextAccessor>(x => x.HttpContext == _httpContext);
        _guard = new ReleaseMetricSourceConnectionAccessGuard(environments.Object, _organizations.Object, accessor);
    }

    [Fact]
    public async Task GetEnvironmentAsync_ReturnsDescriptorForOwningOrganization()
    {
        var actual = await _guard.GetEnvironmentAsync(_scope.Organization.Id, _scope.Environment.Id);

        Assert.Same(_scope, actual);
    }

    [Fact]
    public async Task GetEnvironmentAsync_RejectsEnvironmentOwnedByAnotherOrganization()
    {
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            _guard.GetEnvironmentAsync(Guid.NewGuid(), _scope.Environment.Id));
    }

    [Fact]
    public async Task GetEnvironmentAsync_AllowsPersonalTokenWhenCreatorIsStillAMember()
    {
        SetPersonalToken(isMember: true);

        var actual = await _guard.GetEnvironmentAsync(_scope.Organization.Id, _scope.Environment.Id);

        Assert.Same(_scope, actual);
        _organizations.VerifyAll();
    }

    [Fact]
    public async Task GetEnvironmentAsync_RejectsPersonalTokenWhenCreatorHasLeftOrganization()
    {
        SetPersonalToken(isMember: false);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            _guard.GetEnvironmentAsync(_scope.Organization.Id, _scope.Environment.Id));

        _organizations.VerifyAll();
    }

    [Fact]
    public async Task TestConnection_WhenPersonalTokenCreatorHasLeft_RejectsBeforeReadingConnectionOrUsingCredentials()
    {
        SetPersonalToken(isMember: false);
        var connections = new Mock<IReleaseMetricSourceConnectionService>(MockBehavior.Strict);
        var protector = new Mock<IReleaseMetricSourceCredentialProtector>(MockBehavior.Strict);
        var tester = new Mock<IPrometheusConnectionTester>(MockBehavior.Strict);
        var handler = new TestReleaseMetricSourceConnectionHandler(connections.Object, protector.Object, tester.Object, _guard);
        var request = new TestReleaseMetricSourceConnection(_scope.Organization.Id, _scope.Environment.Id,
            new TestReleaseMetricSourceConnectionPayload { ConnectionId = Guid.NewGuid() });

        await Assert.ThrowsAsync<ForbiddenException>(() => handler.Handle(request, CancellationToken.None));

        _organizations.VerifyAll();
        connections.VerifyNoOtherCalls();
        protector.VerifyNoOtherCalls();
        tester.VerifyNoOtherCalls();
    }

    private void SetPersonalToken(bool isMember)
    {
        var creatorId = Guid.NewGuid();
        _httpContext.Items[ApplicationConsts.AccessTokenItem] =
            new AccessToken(_scope.Organization.Id, creatorId, "personal", AccessTokenTypes.Personal, []);
        _organizations.Setup(x => x.ContainsUserAsync(_scope.Organization.Id, creatorId)).ReturnsAsync(isMember);
    }
}
