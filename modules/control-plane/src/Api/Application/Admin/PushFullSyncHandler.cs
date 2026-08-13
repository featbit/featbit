using Domain.Messages;
using MediatR;
using Action = Domain.Messages.Action;

namespace Api.Application.Admin;

public class PushFullSync : IRequest<bool>;

public class PushFullSyncHandler(IMessageProducer messageProducer, ILogger<PushFullSyncHandler> logger) : IRequestHandler<PushFullSync, bool>
{
    private static readonly object EmptyMessage = new { };

    public async Task<bool> Handle(PushFullSync request, CancellationToken cancellationToken)
    {
        try
        {
            await messageProducer.PublishAsync(ControlPlaneTopics.ControlPlaneCommand, new ControlPlaneCommand { Action = Action.PushFullSync });
            return true;
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error occurred while handling PushFullSync request.");
            return false;
        }
    }
}