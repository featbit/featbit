using Application.AuditLogs;
using Application.Bases.Models;
using Application.Services;
using Domain.AuditLogs;
using Domain.Policies;
using Domain.Resources;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;

namespace Application.IntegrationTests.Mediation;

/// <summary>
/// The mediator as the API host builds it: request validation, the handlers, notification publishing
/// and service lifetimes. Only the audit log store is replaced; the request path is the real one.
/// </summary>
[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
public class MediationTests
{
    private readonly TestApp _app;

    public MediationTests(TestApp app)
    {
        _app = app;
    }

    // An organization-scoped audit log query by a caller who may manage IAM passes the access guard and
    // reads from IAuditLogService.
    private static QueryAuditLogs QueryRequest(string scope)
    {
        var organizationId = Guid.NewGuid();

        return new QueryAuditLogs
        {
            WorkspaceId = Guid.NewGuid(),
            OrganizationId = organizationId,
            Permissions =
            [
                new PolicyStatement
                {
                    Id = Guid.NewGuid().ToString(),
                    ResourceType = ResourceTypes.Iam,
                    Effect = EffectType.Allow,
                    Actions = [Permissions.CanManageIAM],
                    Resources = [RN.ForIam()]
                }
            ],
            Filter = new AuditLogQueryFilter { Scope = scope, ScopeId = organizationId }
        };
    }

    private static OnIamResourceChanged IamChange() => new(
        WorkspaceId: Guid.NewGuid(),
        OrganizationId: Guid.NewGuid(),
        RefType: AuditLogRefTypes.Member,
        Operation: Operations.Update,
        Resource: new ProfileAuditSnapshot(Guid.NewGuid(), "member", "iam/*", "member@featbit.test"),
        Change: new DataChange { Previous = "before", Current = "after" },
        OperatorId: Guid.NewGuid());

    private (IServiceScope Scope, Mock<IAuditLogService> AuditLogs) CreateScope()
    {
        var auditLogs = new Mock<IAuditLogService>();
        var factory = _app.WithServices(services =>
            services.Replace(ServiceDescriptor.Transient(_ => auditLogs.Object)));

        return (factory.Services.CreateScope(), auditLogs);
    }

    [Fact]
    public async Task Send_ValidRequest_ReturnsTheHandlerResult()
    {
        var (scope, auditLogs) = CreateScope();
        using var _ = scope;
        auditLogs
            .Setup(x => x.GetListAsync(It.IsAny<Guid>(), It.IsAny<AuditLogQueryFilter>()))
            .ReturnsAsync(new PagedResult<AuditLog>(0, []));
        var sender = scope.ServiceProvider.GetRequiredService<ISender>();

        var logs = await sender.Send(QueryRequest(AuditLogScopes.Organization), CancellationToken.None);

        Assert.Empty(logs.Items);
        auditLogs.Verify(x => x.GetListAsync(It.IsAny<Guid>(), It.IsAny<AuditLogQueryFilter>()), Times.Once);
    }

    [Fact]
    public async Task Send_RequestFailingValidation_ThrowsValidationExceptionWithoutRunningTheHandler()
    {
        var (scope, auditLogs) = CreateScope();
        using var _ = scope;
        var sender = scope.ServiceProvider.GetRequiredService<ISender>();

        var ex = await Assert.ThrowsAsync<ValidationException>(
            async () => await sender.Send(QueryRequest("NotAScope"), CancellationToken.None));

        Assert.Contains(ex.Errors, e => e.PropertyName == "Filter.Scope");
        auditLogs.Verify(x => x.GetListAsync(It.IsAny<Guid>(), It.IsAny<AuditLogQueryFilter>()), Times.Never);
    }

    [Fact]
    public async Task Send_HandlerThrows_PropagatesTheSameException()
    {
        var (scope, auditLogs) = CreateScope();
        using var _ = scope;
        var thrown = new InvalidOperationException("store unavailable");
        auditLogs
            .Setup(x => x.GetListAsync(It.IsAny<Guid>(), It.IsAny<AuditLogQueryFilter>()))
            .ThrowsAsync(thrown);
        var sender = scope.ServiceProvider.GetRequiredService<ISender>();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            async () => await sender.Send(QueryRequest(AuditLogScopes.Organization), CancellationToken.None));

        Assert.Same(thrown, ex);
    }

    [Fact]
    public async Task Publish_Notification_RunsItsHandler()
    {
        var (scope, auditLogs) = CreateScope();
        using var _ = scope;
        var publisher = scope.ServiceProvider.GetRequiredService<IPublisher>();

        await publisher.Publish(IamChange(), CancellationToken.None);

        auditLogs.Verify(x => x.AddOneAsync(It.IsAny<AuditLog>()), Times.Once);
    }

    [Fact]
    public async Task Publish_HandlerThrows_PropagatesTheSameException()
    {
        var (scope, auditLogs) = CreateScope();
        using var _ = scope;
        var thrown = new InvalidOperationException("store unavailable");
        auditLogs.Setup(x => x.AddOneAsync(It.IsAny<AuditLog>())).ThrowsAsync(thrown);
        var publisher = scope.ServiceProvider.GetRequiredService<IPublisher>();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            async () => await publisher.Publish(IamChange(), CancellationToken.None));

        Assert.Same(thrown, ex);
    }

    // Handlers depend on scoped services (the DbContext among them), so they must not outlive a request.
    [Fact]
    public void Services_SenderAndHandlers_AreTransient()
    {
        using var scope = _app.Services.CreateScope();
        var services = scope.ServiceProvider;

        Assert.NotSame(services.GetRequiredService<ISender>(), services.GetRequiredService<ISender>());
        Assert.NotSame(
            services.GetRequiredService<IRequestHandler<QueryAuditLogs, PagedResult<AuditLogVm>>>(),
            services.GetRequiredService<IRequestHandler<QueryAuditLogs, PagedResult<AuditLogVm>>>());
    }

    // A notification nothing handles is published without error, so a missing registration would
    // silently drop flag, segment and environment changes.
    [Fact]
    public void Services_EveryNotification_HasARegisteredHandler()
    {
        using var scope = _app.Services.CreateScope();
        var notifications = typeof(QueryAuditLogs).Assembly.GetTypes()
            .Where(t => t is { IsAbstract: false, IsInterface: false } && typeof(INotification).IsAssignableFrom(t))
            .ToArray();

        Assert.NotEmpty(notifications);
        Assert.All(notifications, notification =>
            Assert.NotEmpty(scope.ServiceProvider.GetServices(typeof(INotificationHandler<>).MakeGenericType(notification))));
    }
}
