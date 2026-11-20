namespace Application.Bases.Behaviours;

/// <summary>
/// Publishes a notification to its handlers one at a time, in registration order, awaiting each,
/// and stops at the first handler that throws, letting its exception propagate unchanged.
/// </summary>
/// <remarks>
/// This is how MediatR published notifications. Mediator's built-in <see cref="ForeachAwaitPublisher"/>
/// carries on past a failing handler when there are several and throws an <see cref="AggregateException"/>
/// at the end, which would change the exception every caller of <c>Publish</c> sees.
/// <see cref="TaskWhenAllPublisher"/> runs handlers concurrently, which handlers sharing one scoped
/// <c>DbContext</c> can't tolerate.
/// </remarks>
public sealed class SequentialNotificationPublisher : INotificationPublisher
{
    public async ValueTask Publish<TNotification>(
        NotificationHandlers<TNotification> handlers,
        TNotification notification,
        CancellationToken cancellationToken)
        where TNotification : INotification
    {
        foreach (var handler in handlers)
        {
            await handler.Handle(notification, cancellationToken);
        }
    }
}
