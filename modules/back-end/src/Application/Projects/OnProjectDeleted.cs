using Application.Environments;
using Domain.Projects;

namespace Application.Projects;

public class OnProjectDeleted : INotification
{
    public ProjectWithEnvs ProjectWithEnvs { get; }

    public OnProjectDeleted(ProjectWithEnvs projectWithEnvs)
    {
        ProjectWithEnvs = projectWithEnvs;
    }
}

public class OnProjectDeletedHandler : INotificationHandler<OnProjectDeleted>
{
    private readonly IPublisher _publisher;
    private readonly IPolicyService _policyService;

    public OnProjectDeletedHandler(IPublisher publisher, IPolicyService policyService)
    {
        _publisher = publisher;
        _policyService = policyService;
    }

    public async Task Handle(OnProjectDeleted notification, CancellationToken cancellationToken)
    {
        var envs = notification.ProjectWithEnvs.Environments;

        // publish environment deleted events
        foreach (var env in envs)
        {
            await _publisher.Publish(new OnEnvironmentDeleted(env), cancellationToken);
        }

        var creatorAccessPolicyKey = ProjectCreatorAccess.PolicyKey(notification.ProjectWithEnvs.Id);
        var creatorAccessPolicy = await _policyService.FindOneAsync(x => x.Key == creatorAccessPolicyKey);
        if (creatorAccessPolicy != null)
        {
            await _policyService.DeleteAsync(creatorAccessPolicy.Id);
        }
    }
}
