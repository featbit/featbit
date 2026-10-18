using Application.ControlPlane;
using Application.AuditLogs;
using Application.Bases;
using Application.Bases.Exceptions;
using Application.Users;
using Domain.AuditLogs;

namespace Application.FeatureFlags;

public class UpdateInsightCollectionPayload : ResourceChangeRequest
{
    public bool Enabled { get; set; }
}

public class UpdateInsightCollection : UpdateInsightCollectionPayload, IRequest<Guid>
{
    public Guid EnvId { get; set; }

    public string Key { get; set; }
}

public class UpdateInsightCollectionHandler(
    IFeatureFlagService service,
    ICurrentUser currentUser,
    IPublisher publisher) : IRequestHandler<UpdateInsightCollection, Guid>
{
    public async Task<Guid> Handle(UpdateInsightCollection request, CancellationToken cancellationToken)
    {
        var flag = await service.GetAsync(request.EnvId, request.Key);

        // if state is unchanged, we don't need to do anything
        if (flag.InsightsEnabled == request.Enabled)
        {
            return flag.Revision;
        }

        // if insights are being disabled, we need to check if there are any running experiments that require insights
        if (flag.InsightsEnabled && !request.Enabled)
        {
            var runningExperiments =
                await service.GetRunningExperimentsAsync(request.EnvId, flag.Id);
            if (runningExperiments.Any())
            {
                throw new BusinessException(ErrorCodes.BusinessRuleViolation);
            }
        }

        var dataChange = flag.UpdateInsightCollection(request.Enabled, currentUser.Id);

        var notification = new OnFeatureFlagChanged(
            flag, Operations.Update, dataChange, currentUser.Id, comment: request.Comment
        );
        await service.SaveChangeAsync(notification);
        await publisher.Publish(notification, cancellationToken);

        return flag.Revision;
    }
}
