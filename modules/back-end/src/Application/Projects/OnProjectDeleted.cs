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

    public OnProjectDeletedHandler(IPublisher publisher)
    {
        _publisher = publisher;
    }

    public async Task Handle(OnProjectDeleted notification, CancellationToken cancellationToken)
    {
        var envs = notification.ProjectWithEnvs.Environments;

        // publish environment deleted events
        foreach (var env in envs)
        {
            await _publisher.Publish(new OnEnvironmentDeleted(env), cancellationToken);
        }
    }
}