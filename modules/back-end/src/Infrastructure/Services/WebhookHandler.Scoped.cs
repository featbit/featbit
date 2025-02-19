using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Segments;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure.Services;

public class ScopedWebhookHandler(IServiceProvider serviceProvider) : IScopedWebhookHandler
{
    public async Task HandleAsync(FeatureFlag flag, DataChange dataChange, Guid operatorId)
    {
        using var scope = serviceProvider.CreateScope();
        var service = scope.ServiceProvider.GetRequiredService<IGeneralWebhookHandler>();
        await service.HandleAsync(flag, dataChange, operatorId);
    }

    public async Task HandleAsync(Guid envId, Segment segment, DataChange dataChange, Guid operatorId)
    {
        using var scope = serviceProvider.CreateScope();
        var service = scope.ServiceProvider.GetRequiredService<IGeneralWebhookHandler>();
        await service.HandleAsync(envId, segment, dataChange, operatorId);
    }
}