using Domain.EndUsers;
using Domain.Messages;
using Domain.Usages;

namespace Streaming.Services;

public class ReportEndUserService(IMessageProducer producer, EndUserDeduplicator endUserDeduplicator) : IReportEndUserService
{
    public async Task ReportEndUserAndMauAsync(Guid envId, EndUser user)
    {
        var usage = new InsightUsage(envId);
        usage.AddUser(user.KeyId);
        var reportEndUser = endUserDeduplicator.TryMarkAsReported(envId, user.KeyId)
            ? producer.PublishAsync(Topics.EndUser, new EndUserMessage(envId, user))
            : Task.CompletedTask;

        await Task.WhenAll(reportEndUser, producer.PublishAsync(Topics.Usage, usage));
    }
}