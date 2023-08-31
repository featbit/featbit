using Application.Caches;
using Domain.FeatureFlags;
using Domain.FlagRevisions;
using Domain.Messages;

namespace Application.FeatureFlags;

public class OnFeatureFlagChanged : INotification
{
    public FeatureFlag Flag { get; set; }

    public string Comment { get; set; }

    public OnFeatureFlagChanged(FeatureFlag flag, string comment = "")
    {
        Flag = flag;
        Comment = comment;
    }
}

public class OnFeatureFlagChangedHandler : INotificationHandler<OnFeatureFlagChanged>
{
    private readonly IFlagRevisionService _flagRevisionService;
    private readonly IMessageProducer _messageProducer;
    private readonly ICacheService _cache;

    public OnFeatureFlagChangedHandler(
        IFlagRevisionService flagRevisionService,
        IMessageProducer messageProducer,
        ICacheService cache)
    {
        _flagRevisionService = flagRevisionService;
        _messageProducer = messageProducer;
        _cache = cache;
    }

    public async Task Handle(OnFeatureFlagChanged notification, CancellationToken cancellationToken)
    {
        var flag = notification.Flag;

        // update cache
        await _cache.UpsertFlagAsync(flag);

        // create flag revision
        var revision = new FlagRevision(flag, notification.Comment);
        await _flagRevisionService.AddOneAsync(revision);

        // publish feature flag change message
        await _messageProducer.PublishAsync(Topics.FeatureFlagChange, flag);
    }
}