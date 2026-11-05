using System.Linq.Expressions;
using System.Security.Claims;
using System.Text;
using Api.Authentication;
using Api;
using Api.Middlewares;
using Api.Authorization;
using Application.Bases.Exceptions;
using Application.Members;
using Application.Organizations;
using Application.Services;
using Application.Users;
using AutoMapper;
using Domain.Organizations;
using Domain.Users;
using Domain.Workspaces;
using Infrastructure.Identity;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Api.UnitTests.Authentication;

public class SsoOrganizationJoinAuthorizationTests
{
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _organizationId = Guid.NewGuid();
    private readonly Mock<IUserService> _users = new();
    private readonly Mock<IOrganizationService> _organizations = new();
    private readonly HttpContextAccessor _accessor = new();
    private readonly JwtOptions _jwt;
    private readonly SsoOrganizationJoinAuthorization _authorization;

    public SsoOrganizationJoinAuthorizationTests()
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("sso-join-tests-signing-key-at-least-32-bytes"));
        _jwt = new JwtOptions
        {
            Issuer = "test", Audience = "featbit-api",
            SigningSecurityKey = key, VerificationSecurityKey = key
        };
        _accessor.HttpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(UserClaims.Id, _userId.ToString())], Schemes.JwtBearer))
        };
        _users.Setup(x => x.GetWorkspacesAsync(_userId)).ReturnsAsync([new Workspace { Id = _workspaceId }]);
        var org = new Organization(_workspaceId, "org", "org") { Id = _organizationId };
        _organizations.Setup(x => x.AnyAsync(It.IsAny<Expression<Func<Organization, bool>>>()))
            .ReturnsAsync((Expression<Func<Organization, bool>> predicate) => predicate.Compile()(org));
        _organizations.Setup(x => x.GetUserOrganizationsAsync(_workspaceId, _userId)).ReturnsAsync([]);
        _authorization = new SsoOrganizationJoinAuthorization(_accessor, _jwt, _users.Object, _organizations.Object);
    }

    private void UseIssuedTicket(Guid? userId = null, Guid? workspaceId = null)
    {
        var loginContext = new DefaultHttpContext();
        loginContext.Request.Scheme = "https";
        _authorization.Issue(loginContext, userId ?? _userId, workspaceId ?? _workspaceId);
        var cookie = loginContext.Response.Headers.SetCookie.ToString();
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("secure", cookie, StringComparison.OrdinalIgnoreCase);
        _accessor.HttpContext!.Request.Headers.Cookie = cookie.Split(';')[0];
    }

    [Fact]
    public async Task SuccessfulSsoTicket_AllowsFirstJoinAndOrganizationSelection()
    {
        UseIssuedTicket();
        Assert.True(await _authorization.CanChooseOrganizationAsync(_workspaceId, _userId, []));
        Assert.True((await _authorization.GetJoinAuthorizationAsync(_workspaceId, _organizationId, _userId)).IsAllowed);
    }

    [Fact]
    public async Task WorkspaceMemberWithoutSsoTicket_CannotJoin()
    {
        Assert.False(await _authorization.CanChooseOrganizationAsync(_workspaceId, _userId, []));
        Assert.False((await _authorization.GetJoinAuthorizationAsync(_workspaceId, _organizationId, _userId)).IsAllowed);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task TicketForAnotherUserOrWorkspace_IsRejected(bool otherUser)
    {
        UseIssuedTicket(otherUser ? Guid.NewGuid() : _userId, otherUser ? _workspaceId : Guid.NewGuid());
        Assert.False((await _authorization.GetJoinAuthorizationAsync(_workspaceId, _organizationId, _userId)).IsAllowed);
    }

    [Fact]
    public async Task MembershipInAnotherOrganization_PreventsAdditionalJoin()
    {
        UseIssuedTicket();
        ICollection<Organization> joined = [new Organization(_workspaceId, "other", "other")];
        _organizations.Setup(x => x.GetUserOrganizationsAsync(_workspaceId, _userId))
            .ReturnsAsync(joined);
        Assert.False(await _authorization.CanChooseOrganizationAsync(_workspaceId, _userId, joined));
        _organizations.Verify(x => x.GetUserOrganizationsAsync(It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);
        _users.Verify(x => x.GetWorkspacesAsync(It.IsAny<Guid>()), Times.Never);
        Assert.False((await _authorization.GetJoinAuthorizationAsync(_workspaceId, _organizationId, _userId)).IsAllowed);
    }

    [Fact]
    public async Task ExistingTargetMember_CanRetryWithoutTicket()
    {
        _organizations.Setup(x => x.GetUserOrganizationsAsync(_workspaceId, _userId))
            .ReturnsAsync([new Organization(_workspaceId, "org", "org") { Id = _organizationId }]);
        Assert.True((await _authorization.GetJoinAuthorizationAsync(_workspaceId, _organizationId, _userId)).IsAllowed);
    }

    [Fact]
    public async Task RemovedWorkspaceMember_IsRejectedEvenWithTicket()
    {
        UseIssuedTicket();
        _users.Setup(x => x.GetWorkspacesAsync(_userId)).ReturnsAsync([]);
        Assert.False((await _authorization.GetJoinAuthorizationAsync(_workspaceId, _organizationId, _userId)).IsAllowed);
    }

    [Fact]
    public async Task TargetOrganizationOutsideWorkspace_IsRejectedEvenWithTicket()
    {
        UseIssuedTicket();
        Assert.False((await _authorization.GetJoinAuthorizationAsync(_workspaceId, Guid.NewGuid(), _userId)).IsAllowed);
    }

    [Theory]
    [InlineData("expired")]
    [InlineData("wrong-signature")]
    [InlineData("ordinary-access-token")]
    [InlineData("malformed")]
    public async Task InvalidTicket_IsRejected(string kind)
    {
        var now = DateTime.UtcNow;
        var signingKey = kind == "wrong-signature"
            ? new SymmetricSecurityKey(Encoding.UTF8.GetBytes("different-signing-key-at-least-32-bytes"))
            : _jwt.SigningSecurityKey;
        var token = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = _jwt.Issuer,
            Audience = kind == "ordinary-access-token" ? _jwt.Audience : $"{_jwt.Audience}:sso-organization-join",
            IssuedAt = now.AddHours(-1), NotBefore = now.AddHours(-1),
            Expires = kind == "expired" ? now.AddMinutes(-1) : now.AddMinutes(15),
            Subject = new ClaimsIdentity([
                new Claim(UserClaims.Id, _userId.ToString()),
                new Claim("sso_workspace", _workspaceId.ToString())
            ]),
            SigningCredentials = new SigningCredentials(signingKey, _jwt.Algorithm)
        });
        _accessor.HttpContext!.Request.Headers.Cookie =
            $"{SsoOrganizationJoinAuthorization.CookieName}={(kind == "malformed" ? "invalid" : token)}";
        Assert.False((await _authorization.GetJoinAuthorizationAsync(_workspaceId, _organizationId, _userId)).IsAllowed);
    }

    [Fact]
    public async Task OnboardingTicket_CannotBeUsedAsApiBearerToken()
    {
        UseIssuedTicket();
        var ticket = _accessor.HttpContext!.Request.Cookies[SsoOrganizationJoinAuthorization.CookieName];
        var result = await new JsonWebTokenHandler().ValidateTokenAsync(ticket, new TokenValidationParameters
        {
            ValidIssuer = _jwt.Issuer, ValidAudience = _jwt.Audience,
            IssuerSigningKey = _jwt.VerificationSecurityKey
        });
        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task WithoutTicket_DoesNotExposeWorkspaceOrganizations()
    {
        var handler = new GetOrganizationListHandler(_organizations.Object, Mock.Of<IMapper>(), _authorization);
        await handler.Handle(new GetOrganizationList
        {
            WorkspaceId = _workspaceId, UserId = _userId
        }, CancellationToken.None);
        _organizations.Verify(x => x.FindManyAsync(It.IsAny<Expression<Func<Organization, bool>>>()), Times.Never);
        _organizations.Verify(x => x.GetUserOrganizationsAsync(_workspaceId, _userId), Times.Once);
    }

    [Fact]
    public async Task ValidTicket_AllowsListingOrganizationsOnlyInAuthenticatedWorkspace()
    {
        UseIssuedTicket();
        var handler = new GetOrganizationListHandler(_organizations.Object, Mock.Of<IMapper>(), _authorization);
        await handler.Handle(new GetOrganizationList
        {
            WorkspaceId = _workspaceId, UserId = _userId
        }, CancellationToken.None);
        _organizations.Verify(x => x.FindManyAsync(It.Is<Expression<Func<Organization, bool>>>(predicate =>
            predicate.Compile()(new Organization(_workspaceId, "org", "org")) &&
            !predicate.Compile()(new Organization(Guid.NewGuid(), "other", "other")))), Times.Once);
        _organizations.Verify(x => x.GetUserOrganizationsAsync(_workspaceId, _userId), Times.Once);
    }

    [Fact]
    public async Task ExistingMemberships_OnlyReturnsJoinedOrganizations()
    {
        UseIssuedTicket();
        ICollection<Organization> joined = [new Organization(_workspaceId, "joined", "joined")];
        _organizations.Setup(x => x.GetUserOrganizationsAsync(_workspaceId, _userId)).ReturnsAsync(joined);
        var mapper = new Mock<IMapper>();
        var handler = new GetOrganizationListHandler(_organizations.Object, mapper.Object, _authorization);

        await handler.Handle(new GetOrganizationList
        {
            WorkspaceId = _workspaceId, UserId = _userId
        }, CancellationToken.None);

        mapper.Verify(x => x.Map<IEnumerable<OrganizationVm>>(joined), Times.Once);
        _organizations.Verify(x => x.FindManyAsync(It.IsAny<Expression<Func<Organization, bool>>>()), Times.Never);
        _organizations.Verify(x => x.GetUserOrganizationsAsync(_workspaceId, _userId), Times.Once);
        _users.Verify(x => x.GetWorkspacesAsync(It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task JoinHandlerWithoutTicket_CannotBypassMiddleware()
    {
        var sender = new Mock<ISender>();
        var handler = new JoinOrganizationHandler(_users.Object,
            Mock.Of<ICurrentUser>(x => x.Id == _userId), _authorization, sender.Object);
        await Assert.ThrowsAsync<ForbiddenException>(() => handler.Handle(new JoinOrganization
        {
            WorkspaceId = _workspaceId, OrganizationId = _organizationId
        }, CancellationToken.None));
        sender.Verify(x => x.Send(It.IsAny<AddMember>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Theory]
    [InlineData(UserOrigin.Local)]
    [InlineData(UserOrigin.Sso)]
    public async Task JoinHandlerWithTicket_WorksForExistingLocalAndSsoAccounts(string origin)
    {
        UseIssuedTicket();
        _users.Setup(x => x.GetAsync(_userId)).ReturnsAsync(new User(_userId, "user@example.com", "", origin: origin));
        var sender = new Mock<ISender>();
        sender.Setup(x => x.Send(It.IsAny<AddMember>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        var handler = new JoinOrganizationHandler(_users.Object,
            Mock.Of<ICurrentUser>(x => x.Id == _userId), _authorization, sender.Object);
        Assert.True(await handler.Handle(new JoinOrganization
        {
            WorkspaceId = _workspaceId, OrganizationId = _organizationId
        }, CancellationToken.None));
        sender.Verify(x => x.Send(It.Is<AddMember>(request => request.WorkspaceId == _workspaceId &&
            request.OrganizationId == _organizationId && request.Email == "user@example.com" &&
            request.PolicyIds.Count == 0 && request.GroupIds.Count == 0), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task JoinHandlerRetry_DoesNotReapplyDefaultPermissions()
    {
        _organizations.Setup(x => x.GetUserOrganizationsAsync(_workspaceId, _userId))
            .ReturnsAsync([new Organization(_workspaceId, "org", "org") { Id = _organizationId }]);
        var sender = new Mock<ISender>();
        var handler = new JoinOrganizationHandler(_users.Object,
            Mock.Of<ICurrentUser>(x => x.Id == _userId), _authorization, sender.Object);
        Assert.True(await handler.Handle(new JoinOrganization
        {
            WorkspaceId = _workspaceId, OrganizationId = _organizationId
        }, CancellationToken.None));
        sender.Verify(x => x.Send(It.IsAny<AddMember>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task MiddlewareAndHandler_ShareOneAuthorizationQuerySet(bool alreadyMember)
    {
        if (alreadyMember)
        {
            _organizations.Setup(x => x.GetUserOrganizationsAsync(_workspaceId, _userId))
                .ReturnsAsync([new Organization(_workspaceId, "org", "org") { Id = _organizationId }]);
        }
        else
        {
            UseIssuedTicket();
        }
        _users.Setup(x => x.GetAsync(_userId)).ReturnsAsync(new User(_userId, "user@example.com", ""));
        var sender = new Mock<ISender>();
        sender.Setup(x => x.Send(It.IsAny<AddMember>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        var context = _accessor.HttpContext!;
        context.Request.Headers[ApiConstants.WorkspaceHeaderKey] = _workspaceId.ToString();
        context.Request.Headers[ApiConstants.OrgIdHeaderKey] = _organizationId.ToString();
        context.SetEndpoint(new Endpoint(null, new EndpointMetadataCollection(new AllowOrganizationJoinAttribute()), "join"));
        var handlerReached = false;
        var middleware = new JwtContextValidationMiddleware(async _ =>
        {
            handlerReached = true;
            var handler = new JoinOrganizationHandler(_users.Object,
                Mock.Of<ICurrentUser>(x => x.Id == _userId), _authorization, sender.Object);
            Assert.True(await handler.Handle(new JoinOrganization
            {
                WorkspaceId = _workspaceId, OrganizationId = _organizationId
            }, CancellationToken.None));
        });

        await middleware.InvokeAsync(context, _users.Object, _organizations.Object, _authorization);

        Assert.True(handlerReached);
        VerifySingleAuthorizationQuerySet();
        sender.Verify(x => x.Send(It.IsAny<AddMember>(), It.IsAny<CancellationToken>()),
            alreadyMember ? Times.Never() : Times.Once());
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task RepeatedChecks_CacheBothAllowedAndDeniedResults(bool hasTicket)
    {
        if (hasTicket) UseIssuedTicket();
        for (var i = 0; i < 3; i++)
        {
            var decision = await _authorization.GetJoinAuthorizationAsync(_workspaceId, _organizationId, _userId);
            Assert.Equal(hasTicket, decision.IsAllowed);
        }
        VerifySingleAuthorizationQuerySet();
    }

    [Fact]
    public async Task ConcurrentChecks_ShareTheInFlightAuthorization()
    {
        UseIssuedTicket();
        var ownership = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        _organizations.Setup(x => x.AnyAsync(It.IsAny<Expression<Func<Organization, bool>>>())).Returns(ownership.Task);
        var checks = Enumerable.Range(0, 8)
            .Select(_ => _authorization.GetJoinAuthorizationAsync(_workspaceId, _organizationId, _userId)).ToArray();
        ownership.SetResult(true);

        Assert.All(await Task.WhenAll(checks), decision => Assert.True(decision.IsAllowed));
        VerifySingleAuthorizationQuerySet();
    }

    [Fact]
    public async Task JoiningAfterChoosing_RechecksWorkspaceMembership()
    {
        UseIssuedTicket();
        Assert.True(await _authorization.CanChooseOrganizationAsync(_workspaceId, _userId, []));
        _organizations.Verify(x => x.GetUserOrganizationsAsync(It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);
        _users.Setup(x => x.GetWorkspacesAsync(_userId)).ReturnsAsync([]);
        Assert.False((await _authorization.GetJoinAuthorizationAsync(_workspaceId, _organizationId, _userId)).IsAllowed);
        _users.Verify(x => x.GetWorkspacesAsync(_userId), Times.Exactly(2));
        _organizations.Verify(x => x.GetUserOrganizationsAsync(It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);
    }

    [Theory]
    [InlineData("user")]
    [InlineData("workspace")]
    [InlineData("organization")]
    public async Task CachedApproval_IsBoundToAllThreeIds(string changedId)
    {
        var otherId = Guid.NewGuid();
        _organizations.Setup(x => x.GetUserOrganizationsAsync(_workspaceId, _userId))
            .ReturnsAsync([new Organization(_workspaceId, "org", "org") { Id = _organizationId }]);
        // Both targets exist in this workspace, but the user is a member of only one.
        _organizations.Setup(x => x.AnyAsync(It.IsAny<Expression<Func<Organization, bool>>>()))
            .ReturnsAsync((Expression<Func<Organization, bool>> predicate) =>
                predicate.Compile()(new Organization(_workspaceId, "org", "org") { Id = _organizationId }) ||
                predicate.Compile()(new Organization(_workspaceId, "other", "other") { Id = otherId }));
        _users.Setup(x => x.GetWorkspacesAsync(otherId)).ReturnsAsync([]);

        Assert.True((await _authorization.GetJoinAuthorizationAsync(_workspaceId, _organizationId, _userId)).IsAllowed);
        Assert.False((await _authorization.GetJoinAuthorizationAsync(
            changedId == "workspace" ? otherId : _workspaceId,
            changedId == "organization" ? otherId : _organizationId,
            changedId == "user" ? otherId : _userId)).IsAllowed);
        _organizations.Verify(x => x.AnyAsync(It.IsAny<Expression<Func<Organization, bool>>>()), Times.Exactly(2));
    }

    [Fact]
    public async Task NewRequestScope_RechecksMembershipInsteadOfReusingApproval()
    {
        UseIssuedTicket();
        var services = new ServiceCollection();
        services.AddSingleton<IHttpContextAccessor>(_accessor);
        services.AddSingleton(_jwt);
        services.AddSingleton(_users.Object);
        services.AddSingleton(_organizations.Object);
        services.AddScoped<SsoOrganizationJoinAuthorization>();
        services.AddScoped<ISsoOrganizationJoinAuthorization>(provider => provider.GetRequiredService<SsoOrganizationJoinAuthorization>());
        using var provider = services.BuildServiceProvider();
        using (var scope = provider.CreateScope())
        {
            var authorization = scope.ServiceProvider.GetRequiredService<ISsoOrganizationJoinAuthorization>();
            Assert.Same(authorization, scope.ServiceProvider.GetRequiredService<SsoOrganizationJoinAuthorization>());
            Assert.True((await authorization.GetJoinAuthorizationAsync(_workspaceId, _organizationId, _userId)).IsAllowed);
        }

        _users.Setup(x => x.GetWorkspacesAsync(_userId)).ReturnsAsync([]);
        using (var scope = provider.CreateScope())
        {
            var authorization = scope.ServiceProvider.GetRequiredService<ISsoOrganizationJoinAuthorization>();
            Assert.False((await authorization.GetJoinAuthorizationAsync(_workspaceId, _organizationId, _userId)).IsAllowed);
        }
        _users.Verify(x => x.GetWorkspacesAsync(_userId), Times.Exactly(2));
    }

    private void VerifySingleAuthorizationQuerySet()
    {
        _users.Verify(x => x.GetWorkspacesAsync(_userId), Times.Once);
        _organizations.Verify(x => x.AnyAsync(It.IsAny<Expression<Func<Organization, bool>>>()), Times.Once);
        _organizations.Verify(x => x.GetUserOrganizationsAsync(_workspaceId, _userId), Times.Once);
        _organizations.Verify(x => x.ContainsUserAsync(It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);
    }
}
