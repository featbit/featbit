using Application.Environments;
using Domain.Projects;

namespace Application.Projects;

public class OnProjectAdded : INotification
{
    public ProjectWithEnvs ProjectWithEnvs { get; }

    public OnProjectAdded(ProjectWithEnvs projectWithEnvs)
    {
        ProjectWithEnvs = projectWithEnvs;
    }
}

public class OnProjectAddedHandler : INotificationHandler<OnProjectAdded>
{
    private readonly IPublisher _publisher;

    public OnProjectAddedHandler(IPublisher publisher)
    {
        _publisher = publisher;
    }

    public async Task Handle(OnProjectAdded notification, CancellationToken cancellationToken)
    {
        var envs = notification.ProjectWithEnvs.Environments;

        // publish environment added events
        foreach (var env in envs)
        {
            await _publisher.Publish(new OnEnvironmentAdded(env), cancellationToken);
        }
    }
}